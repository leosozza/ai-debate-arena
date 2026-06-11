// Lista estática das vozes Piper pt-BR (sem import dinâmico → segura no SSR).
export const PIPER_VOICES = [
  { id: "pt_BR-faber-medium", label: "🇧🇷 Faber (M)" },
  { id: "pt_BR-cadu-medium", label: "🇧🇷 Cadu (M)" },
  { id: "pt_BR-jeff-medium", label: "🇧🇷 Jeff (M)" },
  { id: "pt_BR-edresson-low", label: "🇧🇷 Edresson (M, leve)" },
] as const;
