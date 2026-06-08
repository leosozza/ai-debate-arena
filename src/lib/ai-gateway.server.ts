// Server-only Lovable AI Gateway helper.
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export const AVAILABLE_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (rápido)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (forte)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "openai/gpt-5", label: "GPT-5 (forte)" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano (barato)" },
] as const;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function apiKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY ausente. Configure Lovable AI.");
  return k;
}

function handleStatus(status: number, body: string) {
  if (status === 429) throw new Error("Limite de uso atingido. Tente em instantes.");
  if (status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
  throw new Error(`Falha na IA (${status}): ${body.slice(0, 200)}`);
}

export async function chatComplete(messages: ChatMessage[], model: string = DEFAULT_MODEL): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey() },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) handleStatus(res.status, await res.text());
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Resposta vazia da IA.");
  return text.trim();
}

/** Returns a ReadableStream<string> of text deltas, plus a promise that resolves with the full text. */
export async function chatStream(messages: ChatMessage[], model: string = DEFAULT_MODEL) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey() },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!res.ok || !res.body) handleStatus(res.status, await res.text());

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
