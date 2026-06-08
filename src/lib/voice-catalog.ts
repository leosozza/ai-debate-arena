// Catálogo unificado de vozes (client-safe).
import { ELEVEN_VOICES } from "./eleven-voices";
import { MINIMAX_VOICES } from "./tts.functions";

export type VoiceProvider = "browser" | "eleven" | "minimax";

export const VOICE_CATALOG: Record<Exclude<VoiceProvider, "browser">, ReadonlyArray<{ id: string; label: string }>> = {
  eleven: ELEVEN_VOICES,
  minimax: MINIMAX_VOICES,
};

export const PROVIDER_LABEL: Record<VoiceProvider, string> = {
  browser: "Navegador",
  eleven: "ElevenLabs",
  minimax: "MiniMax",
};

export function isProvider(v: unknown): v is VoiceProvider {
  return v === "browser" || v === "eleven" || v === "minimax";
}

export function voiceLabel(provider: VoiceProvider | null | undefined, id: string | null | undefined): string {
  if (!provider) return "Padrão";
  if (provider === "browser") return id ? `Navegador · ${id}` : "Navegador (auto)";
  const found = VOICE_CATALOG[provider].find((v) => v.id === id);
  return `${PROVIDER_LABEL[provider]} · ${found?.label ?? id ?? "auto"}`;
}
