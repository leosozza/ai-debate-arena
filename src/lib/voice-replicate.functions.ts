import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { runPrediction, uploadFile, fetchAsBase64 } from "./replicate.server";
import { REPLICATE_MODELS, resolveReplicateVoice, type ReplicateModelKey } from "./replicate-voices";

const TtsInput = z.object({
  text: z.string().trim().min(1).max(5000),
  voiceId: z.string().trim().min(1).max(2048),
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

function buildInput(model: ReplicateModelKey, voiceParam: string, text: string): {
  input: Record<string, unknown>;
  useVersion: boolean;
  maxMs: number;
} {
  switch (model) {
    case "minimax-hd":
    case "minimax-turbo":
      return {
        input: { text, voice_id: voiceParam, speed: 1, language_boost: "Portuguese" },
        useVersion: false,
        maxMs: 180_000,
      };
    case "chatterbox": {
      const input: Record<string, unknown> = {
        prompt: text,
        language_id: "pt",
        exaggeration: 0.5,
        cfg_weight: 0.5,
      };
      if (voiceParam && /^https?:\/\//i.test(voiceParam)) {
        input.audio_prompt_path = voiceParam;
      }
      return { input, useVersion: false, maxMs: 180_000 };
    }
    case "fish": {
      const input: Record<string, unknown> = { text };
      if (voiceParam && /^https?:\/\//i.test(voiceParam)) {
        input.reference_audio = voiceParam;
      }
      return { input, useVersion: true, maxMs: 240_000 };
    }
    case "xtts":
      return {
        input: { text, speaker: voiceParam, language: "pt" },
        useVersion: true,
        maxMs: 180_000,
      };
    case "google":
      return {
        input: { text, voice: voiceParam, language_code: "pt-BR" },
        useVersion: false,
        maxMs: 120_000,
      };
    case "eleven-v3":
      // voiceParam = ID de voz ElevenLabs; language_code ISO 639-1.
      return {
        input: { text, voice_id: voiceParam, language_code: "pt" },
        useVersion: false,
        maxMs: 150_000,
      };
    case "inworld":
      // voiceParam = nome da voz Inworld (multilíngue).
      return {
        input: { text, voice: voiceParam },
        useVersion: false,
        maxMs: 120_000,
      };
  }
}

/** TTS via Replicate. Modelo é resolvido pelo prefixo no voiceId. */
export const replicateTts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TtsInput.parse(d))
  .handler(async ({ data }) => {
    const { model, voiceParam } = resolveReplicateVoice(data.voiceId);
    const { input, useVersion, maxMs } = buildInput(model, voiceParam, data.text);
    const modelPath = REPLICATE_MODELS[model];

    const output = await runPrediction(modelPath, input, { maxMs, useVersion });
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
