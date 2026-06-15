// Client-safe catalog of ElevenLabs voices (no server-only imports).
// Vozes públicas padrão da ElevenLabs — todas funcionam com o modelo
// multilingual v2 em Português. O usuário pode trocar por persona.
export const ELEVEN_VOICES = [
  // Femininas
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel (F) · calma, narração", gender: "f" as const },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah / Bella (F) · suave", gender: "f" as const },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi (F) · jovem, intensa", gender: "f" as const },
  { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli (F) · jovem, emotiva", gender: "f" as const },
  { id: "ThT5KcBeYPX3keUQqHPh", label: "Dorothy (F) · britânica", gender: "f" as const },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda (F) · narração", gender: "f" as const },
  { id: "jsCqWAovK2LkecY7zXl4", label: "Freya (F) · expressiva", gender: "f" as const },
  { id: "z9fAnlkpzviPz146aGWa", label: "Glinda (F) · personagem", gender: "f" as const },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice (F) · britânica", gender: "f" as const },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura (F) · animada", gender: "f" as const },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily (F) · britânica suave", gender: "f" as const },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica (F) · jovem expressiva", gender: "f" as const },
  { id: "SAz9YHcvj6GT2YYXdXww", label: "River (F) · neutra confiante", gender: "f" as const },
  { id: "LcfcDJNUP1GQjkzn1xUU", label: "Emily (F) · meditação", gender: "f" as const },
  { id: "oWAxZDx7w5VEj9dCyTzz", label: "Grace (F) · sulista EUA", gender: "f" as const },

  // Masculinas
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam (M) · grave, narração", gender: "m" as const },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni (M) · quente", gender: "m" as const },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh (M) · jovem profundo", gender: "m" as const },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold (M) · firme", gender: "m" as const },
  { id: "yoZ06aMxZJJ28mfd3POQ", label: "Sam (M) · casual", gender: "m" as const },
  { id: "CYw3kZ02Hs0563khs1Fj", label: "Dave (M) · britânico conversacional", gender: "m" as const },
  { id: "GBv7mTt0atIp3Br8iCZE", label: "Thomas (M) · meditação", gender: "m" as const },
  { id: "ZQe5CZNOzWyzPSCn5a3c", label: "James (M) · australiano", gender: "m" as const },
  { id: "Yko7PKHZNXotIFUBG7I9", label: "Matthew (M) · britânico", gender: "m" as const },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George (M) · britânico maduro", gender: "m" as const },
  { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie (M) · australiano natural", gender: "m" as const },
  { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger (M) · confiante", gender: "m" as const },
  { id: "N2lVS1w4EtoT3dr4eOWO", label: "Callum (M) · intenso", gender: "m" as const },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (M) · articulado", gender: "m" as const },
  { id: "bIHbv24MWmeRgasZH58o", label: "Will (M) · amigável", gender: "m" as const },
  { id: "cjVigY5qzO86Huf0OWal", label: "Eric (M) · meia-idade", gender: "m" as const },
  { id: "iP95p4xoKVk53GoZ742B", label: "Chris (M) · casual", gender: "m" as const },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian (M) · grave narrador", gender: "m" as const },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel (M) · britânico autoridade", gender: "m" as const },
  { id: "pqHfZKP75CvOlQylNhV4", label: "Bill (M) · idoso narrador", gender: "m" as const },
] as const;

export const DEFAULT_ELEVEN = {
  moderator: "21m00Tcm4TlvDq8ikWAM", // Rachel
  a: "pNInz6obpgDQGcFmaJgB", // Adam
  b: "ErXwobaYiN019PkySvjV", // Antoni
};
