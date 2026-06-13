// Catálogo unificado de vozes (client-safe).
import { ELEVEN_VOICES } from "./eleven-voices";
import { MINIMAX_VOICES } from "./tts.functions";
import { REPLICATE_VOICES } from "./replicate-voices";
import { KOKORO_VOICES } from "./kokoro-voices";
import { PIPER_VOICES } from "./piper-voices";

export type VoiceProvider = "browser" | "kokoro" | "piper" | "eleven" | "minimax" | "replicate";

export type VoiceGender = "m" | "f";
export interface CatalogVoice { id: string; label: string; gender?: VoiceGender }

export const VOICE_CATALOG: Record<Exclude<VoiceProvider, "browser">, ReadonlyArray<CatalogVoice>> = {
  kokoro: KOKORO_VOICES,
  piper: PIPER_VOICES,
  eleven: ELEVEN_VOICES,
  minimax: MINIMAX_VOICES,
  replicate: REPLICATE_VOICES,
};

/** Filtra o catálogo de um provider por gênero. Vozes sem gênero declarado
 *  são mantidas (não temos como provar o oposto). Se não houver vozes do
 *  gênero pedido, devolve o catálogo inteiro (evita lista vazia). */
export function filterVoicesByGender(provider: Exclude<VoiceProvider, "browser">, gender: VoiceGender | null | undefined): ReadonlyArray<CatalogVoice> {
  const all = VOICE_CATALOG[provider] ?? [];
  if (!gender) return all;
  const filtered = all.filter((v) => !v.gender || v.gender === gender);
  return filtered.length ? filtered : all;
}

export const PROVIDER_LABEL: Record<VoiceProvider, string> = {
  browser: "Navegador (grátis)",
  kokoro: "Kokoro · neural (grátis)",
  piper: "Piper · neural (grátis)",
  eleven: "ElevenLabs",
  minimax: "MiniMax",
  replicate: "Replicate",
};

export function isProvider(v: unknown): v is VoiceProvider {
  return v === "browser" || v === "kokoro" || v === "piper" || v === "eleven" || v === "minimax" || v === "replicate";
}

export function voiceLabel(provider: VoiceProvider | null | undefined, id: string | null | undefined): string {
  if (!provider) return "Padrão";
  if (provider === "browser") return id ? `Navegador · ${id}` : "Navegador (auto)";
  const found = VOICE_CATALOG[provider].find((v) => v.id === id);
  return `${PROVIDER_LABEL[provider]} · ${found?.label ?? id ?? "auto"}`;
}
