// Server-only Firecrawl helper. Uses v2 /search with markdown scraping.
const ENDPOINT = "https://api.firecrawl.dev/v2/search";

export interface FirecrawlSource {
  title: string;
  url: string;
  markdown: string;
}

function apiKey() {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("FIRECRAWL_API_KEY ausente. Conecte o Firecrawl.");
  return k;
}

export async function firecrawlSearch(
  query: string,
  opts: { limit?: number; lang?: string; perSourceCharLimit?: number; timeoutMs?: number } = {},
): Promise<FirecrawlSource[]> {
  const { limit = 5, lang, perSourceCharLimit = 6000, timeoutMs = 25000 } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        query,
        limit,
        ...(lang ? { lang } : {}),
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401) throw new Error("Firecrawl: credencial inválida.");
      if (res.status === 402) throw new Error("Firecrawl: créditos esgotados.");
      throw new Error(`Firecrawl (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      data?: { web?: Array<{ url?: string; title?: string; markdown?: string; description?: string }> } | Array<{ url?: string; title?: string; markdown?: string; description?: string }>;
    };

    const raw = Array.isArray(data.data)
      ? data.data
      : data.data?.web ?? [];

    return raw
      .filter((r) => r.url)
      .map((r) => ({
        title: (r.title ?? r.url ?? "").slice(0, 200),
        url: r.url!,
        markdown: (r.markdown ?? r.description ?? "").slice(0, perSourceCharLimit),
      }));
  } finally {
    clearTimeout(timer);
  }
}
