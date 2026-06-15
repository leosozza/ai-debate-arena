// Catálogo unificado de vozes (client-safe).
import { ELEVEN_VOICES } from "./eleven-voices";
import { MINIMAX_VOICES } from "./tts.functions";
import { REPLICATE_VOICES } from "./replicate-voices";
import { KOKORO_VOICES } from "./kokoro-voices";
import { PIPER_VOICES } from "./piper-voices";

export type VoiceProvider = "kokoro" | "piper" | "eleven" | "minimax" | "replicate";

export type VoiceGender = "m" | "f";
export interface CatalogVoice { id: string; label: string; gender?: VoiceGender }

export const VOICE_CATALOG: Record<VoiceProvider, ReadonlyArray<CatalogVoice>> = {
  kokoro: KOKORO_VOICES,
  piper: PIPER_VOICES,
  eleven: ELEVEN_VOICES,
  minimax: MINIMAX_VOICES,
  replicate: REPLICATE_VOICES,
};

/** Filtra o catálogo de um provider por gênero. Vozes sem gênero declarado
 *  são mantidas (não temos como provar o oposto). Se não houver vozes do
 *  gênero pedido, devolve o catálogo inteiro (evita lista vazia). */
export function filterVoicesByGender(provider: VoiceProvider, gender: VoiceGender | null | undefined): ReadonlyArray<CatalogVoice> {
  const all = VOICE_CATALOG[provider] ?? [];
  if (!gender) return all;
  const filtered = all.filter((v) => !v.gender || v.gender === gender);
  return filtered.length ? filtered : all;
}

export const PROVIDER_LABEL: Record<VoiceProvider, string> = {
  kokoro: "Kokoro · neural (grátis)",
  piper: "Piper · neural (grátis)",
  eleven: "ElevenLabs",
  minimax: "MiniMax",
  replicate: "Replicate",
};

export function isProvider(v: unknown): v is VoiceProvider {
  return v === "kokoro" || v === "piper" || v === "eleven" || v === "minimax" || v === "replicate";
}

/** Normaliza valores vindos do banco/cache antigo: trata "browser" e nulos
 *  como Kokoro (padrão grátis recomendado). */
export function normalizeProvider(v: unknown): VoiceProvider {
  return isProvider(v) ? v : "eleven";
}

export function voiceLabel(provider: VoiceProvider | null | undefined, id: string | null | undefined): string {
  if (!provider) return "Padrão";
  const found = VOICE_CATALOG[provider].find((v) => v.id === id);
  return `${PROVIDER_LABEL[provider]} · ${found?.label ?? id ?? "auto"}`;
}

/** Voz padrão (ElevenLabs) por gênero — usada quando uma persona/debate antigo
 *  estava marcado como "browser" ou nulo. */
export const DEFAULT_VOICE_BY_GENDER: Record<VoiceGender, { provider: VoiceProvider; voiceId: string }> = {
  f: { provider: "eleven", voiceId: "EXAVITQu4vr4xnSDxMaL" }, // Bella
  m: { provider: "eleven", voiceId: "pNInz6obpgDQGcFmaJgB" }, // Adam
};
