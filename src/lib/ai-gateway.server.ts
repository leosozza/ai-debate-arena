// Server-only AI Gateway helper.
// Supports two providers:
//   - Lovable AI Gateway (default, models like "google/gemini-3-flash-preview")
//   - Google AI Studio direto via endpoint OpenAI-compatible (models prefixed "google-direct/")
// Quando o Lovable retorna 402 (créditos esgotados) e há GEMINI_API_KEY,
// automaticamente faz fallback para o modelo Gemini equivalente.

const LOVABLE_ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GOOGLE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export const AVAILABLE_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Lovable)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Lovable)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Lovable)" },
  { id: "google-direct/gemini-2.5-flash", label: "Gemini 2.5 Flash (Google API direta)" },
  { id: "google-direct/gemini-2.5-pro", label: "Gemini 2.5 Pro (Google API direta)" },
  { id: "google-direct/gemini-2.0-flash", label: "Gemini 2.0 Flash (Google API direta)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini (Lovable)" },
  { id: "openai/gpt-5", label: "GPT-5 (Lovable)" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano (Lovable)" },
] as const;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function lovableKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY ausente. Configure Lovable AI.");
  return k;
}

function geminiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

/** Decide endpoint + headers + body model for a given logical model id. */
function resolveTarget(model: string): { endpoint: string; headers: Record<string, string>; modelName: string; provider: "lovable" | "google-direct" } {
  if (model.startsWith("google-direct/")) {
    const key = geminiKey();
    if (!key) throw new Error("GEMINI_API_KEY ausente. Adicione sua chave do Google AI Studio.");
    return {
      endpoint: GOOGLE_ENDPOINT,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      modelName: model.replace(/^google-direct\//, ""),
      provider: "google-direct",
    };
  }
  return {
    endpoint: LOVABLE_ENDPOINT,
    headers: { "Content-Type": "application/json", "Lovable-API-Key": lovableKey() },
    modelName: model,
    provider: "lovable",
  };
}

/** Map a Lovable Gemini model to the closest google-direct equivalent for automatic fallback. */
function fallbackModel(model: string): string | null {
  if (!geminiKey()) return null;
  if (model.startsWith("google-direct/")) return null;
  if (model.startsWith("google/")) {
    if (model.includes("pro")) return "google-direct/gemini-2.5-pro";
    return "google-direct/gemini-2.5-flash";
  }
  // OpenAI models — fall back to gemini flash as best-effort when Lovable falha por crédito.
  return "google-direct/gemini-2.5-flash";
}

function handleStatus(status: number, body: string): never {
  if (status === 429) throw new Error("Limite de uso atingido. Tente em instantes.");
  if (status === 402) throw new Error("CREDITS_EXHAUSTED");
  throw new Error(`Falha na IA (${status}): ${body.slice(0, 200)}`);
}

async function fetchWithTimeout(input: string, init: RequestInit, ms = 75000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`A IA não respondeu em ${Math.round(ms / 1000)}s (timeout). Tente novamente.`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 800): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : "";
      if (msg === "CREDITS_EXHAUSTED" || msg.includes("LOVABLE_API_KEY") || msg.includes("GEMINI_API_KEY") || msg.includes("Resposta vazia")) throw e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function doChatComplete(model: string, messages: ChatMessage[]): Promise<string> {
  return withRetry(async () => {
    const t = resolveTarget(model);
    const res = await fetchWithTimeout(t.endpoint, {
      method: "POST",
      headers: t.headers,
      body: JSON.stringify({ model: t.modelName, messages }),
    });
    if (!res.ok) handleStatus(res.status, await res.text());
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Resposta vazia da IA.");
    return text.trim();
  });
}

export async function chatComplete(messages: ChatMessage[], model: string = DEFAULT_MODEL): Promise<string> {
  try {
    return await doChatComplete(model, messages);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "CREDITS_EXHAUSTED") {
      const fb = fallbackModel(model);
      if (fb) {
        console.warn(`[ai-gateway] Lovable sem créditos. Fazendo fallback para ${fb}.`);
        return await doChatComplete(fb, messages);
      }
      throw new Error("Créditos de IA esgotados. Adicione créditos no workspace ou configure GEMINI_API_KEY.");
    }
    throw e;
  }
}

/** Streaming chat completion. Returns text deltas + a getFullText() once done. */
export async function chatStream(messages: ChatMessage[], model: string = DEFAULT_MODEL) {
  let target = resolveTarget(model);
  let res = await fetchWithTimeout(target.endpoint, {
    method: "POST",
    headers: target.headers,
    body: JSON.stringify({ model: target.modelName, messages, stream: true }),
  });

  if (!res.ok) {
    // Try to map credit-exhausted to fallback before streaming starts.
    if (res.status === 402) {
      const fb = fallbackModel(model);
      if (fb) {
        console.warn(`[ai-gateway] Lovable sem créditos (stream). Fallback para ${fb}.`);
        target = resolveTarget(fb);
        res = await fetchWithTimeout(target.endpoint, {
          method: "POST",
          headers: target.headers,
          body: JSON.stringify({ model: target.modelName, messages, stream: true }),
        });
      }
    }
    if (!res.ok || !res.body) {
      const body = await res.text();
      handleStatus(res.status, body);
    }
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const stream = new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(payload);
            const delta: string | undefined = json.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              controller.enqueue(delta);
            }
          } catch {
            // ignore parse errors on partial chunks
          }
        }
        return;
      }
    },
  });

  return { stream, getFullText: () => full };
}
