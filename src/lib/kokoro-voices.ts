// Lista estática das vozes Kokoro (sem nenhum import dinâmico/CDN), para poder
// ser importada com segurança no bundle do servidor (SSR/Cloudflare).
export const KOKORO_VOICES = [
  { id: "pf_dora", label: "🇧🇷 Dora (F)", gender: "f" as const },
  { id: "pm_alex", label: "🇧🇷 Alex (M)", gender: "m" as const },
  { id: "pm_santa", label: "🇧🇷 Santa (M, grave)", gender: "m" as const },
] as const;
