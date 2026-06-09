import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { runPrediction, uploadFile, fetchAsBase64 } from "./replicate.server";
import { REPLICATE_TTS_MODEL, REPLICATE_CLONE_TTS_MODEL } from "./replicate-voices";

const TtsInput = z.object({
  text: z.string().trim().min(1).max(5000),
  voiceId: z.string().trim().min(1).max(2048), // preset id OR URL (for XTTS clone)
});

function pickUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === "string") return output[0];
  if (output && typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (typeof obj.audio === "string") return obj.audio;
    if (typeof obj.url === "string") return obj.url;
  }
  return null;
}

/** TTS via Replicate. If voiceId looks like a URL, route through XTTS-v2 (cloned). */
export const replicateTts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TtsInput.parse(d))
  .handler(async ({ data }) => {
    const isCloned = /^https?:\/\//i.test(data.voiceId);
    const model = isCloned ? REPLICATE_CLONE_TTS_MODEL : REPLICATE_TTS_MODEL;
    const input: Record<string, unknown> = isCloned
      ? { text: data.text, speaker: data.voiceId, language: "pt", cleanup_voice: true }
      : { text: data.text, voice_id: data.voiceId, speed: 1, language_boost: "Portuguese" };

    const output = await runPrediction(model, input, { maxMs: 90_000 });
    const url = pickUrl(output);
    if (!url) throw new Error("Replicate TTS: resposta sem áudio.");
    const { base64, mime } = await fetchAsBase64(url);
    return { audioBase64: base64, mime };
  });

/** Clone (zero-shot) — upload reference audio, get a persistent URL used as "voiceId". */
export const cloneVoiceReplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Envio inválido (esperado FormData).");
    const name = String(d.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 80) throw new Error("Rótulo deve ter 2 a 80 caracteres.");
    const file = d.getAll("files").find((f): f is File => f instanceof File && f.size > 0);
    if (!file) throw new Error("Envie 1 arquivo de áudio (10–60s de fala clara).");
    if (!file.type.startsWith("audio/")) throw new Error(`"${file.name}" não é áudio.`);
    if (file.size > 12 * 1024 * 1024) throw new Error("Arquivo excede 12 MB.");
    return { name, file };
  })
  .handler(async ({ data }) => {
    const url = await uploadFile(data.file);
    return {
      provider: "replicate" as const,
      voiceId: url,
      name: data.name,
      source: "upload-replicate" as const,
    };
  });
