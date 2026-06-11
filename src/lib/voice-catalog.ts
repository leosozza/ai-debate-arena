// Catálogo unificado de vozes (client-safe).
import { ELEVEN_VOICES } from "./eleven-voices";
import { MINIMAX_VOICES } from "./tts.functions";
import { REPLICATE_VOICES } from "./replicate-voices";
import { KOKORO_VOICES } from "./kokoro-tts";

export type VoiceProvider = "browser" | "kokoro" | "eleven" | "minimax" | "replicate";

export const VOICE_CATALOG: Record<Exclude<VoiceProvider, "browser">, ReadonlyArray<{ id: string; label: string }>> = {
  kokoro: KOKORO_VOICES,
  eleven: ELEVEN_VOICES,
  minimax: MINIMAX_VOICES,
  replicate: REPLICATE_VOICES,
};

export const PROVIDER_LABEL: Record<VoiceProvider, string> = {
  browser: "Navegador (grátis)",
  kokoro: "Kokoro · neural (grátis)",
  eleven: "ElevenLabs",
  minimax: "MiniMax",
  replicate: "Replicate",
};

export function isProvider(v: unknown): v is VoiceProvider {
  return v === "browser" || v === "kokoro" || v === "eleven" || v === "minimax" || v === "replicate";
}

export function voiceLabel(provider: VoiceProvider | null | undefined, id: string | null | undefined): string {
  if (!provider) return "Padrão";
  if (provider === "browser") return id ? `Navegador · ${id}` : "Navegador (auto)";
  const found = VOICE_CATALOG[provider].find((v) => v.id === id);
  return `${PROVIDER_LABEL[provider]} · ${found?.label ?? id ?? "auto"}`;
}
