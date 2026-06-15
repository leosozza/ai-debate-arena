// Lista estática das vozes Kokoro (sem nenhum import dinâmico/CDN), para poder
// ser importada com segurança no bundle do servidor (SSR/Cloudflare).
// IMPORTANTE: manter sincronizado com o modelo `onnx-community/Kokoro-82M-v1.0-ONNX`.
// `pm_santa` foi removido — não existe mais nessa versão do modelo.
export const KOKORO_VOICES = [
  { id: "pf_dora", label: "🇧🇷 Dora (F)", gender: "f" as const },
  { id: "pm_alex", label: "🇧🇷 Alex (M)", gender: "m" as const },
] as const;

export const KOKORO_VOICE_IDS: ReadonlySet<string> = new Set(KOKORO_VOICES.map((v) => v.id));

/** Se `voiceId` não existir no catálogo Kokoro, devolve um fallback sensato. */
export function kokoroFallback(voiceId: string | null | undefined, gender?: "m" | "f"): string {
  const id = (voiceId ?? "").trim();
  if (id && KOKORO_VOICE_IDS.has(id)) return id;
  return gender === "f" ? "pf_dora" : "pm_alex";
}
