// Server-only helper for calling Replicate via the Lovable connector gateway.
const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";

function authHeaders(): Record<string, string> {
  const lov = process.env.LOVABLE_API_KEY;
  const rep = process.env.REPLICATE_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY ausente.");
  if (!rep) throw new Error("Replicate não está conectado neste projeto.");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": rep,
  };
}

export interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string | null;
}

export async function createPrediction(
  model: string, // "owner/name"
  input: Record<string, unknown>,
): Promise<ReplicatePrediction> {
  const res = await fetch(`${GATEWAY}/models/${model}/predictions`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) {
    const b = await res.text();
    throw new Error(`Replicate create falhou (${res.status}): ${b.slice(0, 200)}`);
  }
  return (await res.json()) as ReplicatePrediction;
}

export async function pollPrediction(
  id: string,
  opts: { maxMs?: number } = {},
): Promise<ReplicatePrediction> {
  const maxMs = opts.maxMs ?? 120_000;
  const start = Date.now();
  let delay = 1500;
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 1000, 6000);
    const res = await fetch(`${GATEWAY}/predictions/${id}`, { headers: authHeaders() });
    if (!res.ok) {
      const b = await res.text();
      throw new Error(`Replicate poll falhou (${res.status}): ${b.slice(0, 200)}`);
    }
    const pred = (await res.json()) as ReplicatePrediction;
    if (pred.status === "succeeded") return pred;
    if (pred.status === "failed" || pred.status === "canceled") {
      throw new Error(`Replicate: ${pred.error ?? pred.status}`);
    }
  }
  throw new Error("Replicate timeout esperando a predição.");
}

export async function runPrediction(
  model: string,
  input: Record<string, unknown>,
  opts?: { maxMs?: number },
): Promise<unknown> {
  const created = await createPrediction(model, input);
  if (created.status === "succeeded") return created.output;
  const done = await pollPrediction(created.id, opts);
  return done.output;
}

/** Upload an audio/image File to Replicate; returns a persistent URL (urls.get). */
export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("content", file, file.name);
  const res = await fetch(`${GATEWAY}/files`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  if (!res.ok) {
    const b = await res.text();
    throw new Error(`Replicate upload falhou (${res.status}): ${b.slice(0, 200)}`);
  }
  const json = (await res.json()) as { urls?: { get?: string } };
  const url = json.urls?.get;
  if (!url) throw new Error("Replicate: upload sem URL.");
  return url;
}

/** Download a URL returned by Replicate and convert to base64 (for inline audio). */
export async function fetchAsBase64(url: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar saída do Replicate (${res.status}).`);
  const mime = res.headers.get("content-type") ?? "audio/mpeg";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return { base64: btoa(bin), mime };
}
