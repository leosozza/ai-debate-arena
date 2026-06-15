// Client-safe catalog of Replicate voice presets.
//
// Convenção do `voiceId` (resolvida em voice-replicate.functions.ts):
//   - "<voice_id>"            → minimax/speech-02-hd (default, ótimo PT-BR via language_boost)
//   - "mmt:<voice_id>"        → minimax/speech-02-turbo (rápido/barato)
//   - "cb:"                   → resemble-ai/chatterbox-multilingual (PT, voz default)
//   - "cb:<https-url>"        → chatterbox com áudio de referência (clone)
//   - "fish:<https-url>"      → lucataco/fish-speech-1.5 (clone premium)
//   - "xtts:<https-url>"      → lucataco/xtts-v2 (clone legado)
//   - "<https-url>"           → xtts-v2 (compat com presets antigos)

export const REPLICATE_MODELS = {
  "minimax-hd": "minimax/speech-2.8-hd", // #1 em benchmark (era speech-02-hd)
  "minimax-turbo": "minimax/speech-2.8-turbo",
  google: "google/gemini-3.1-flash-tts", // 70+ idiomas, 30 vozes, alta qualidade
  "eleven-v3": "elevenlabs/v3", // ElevenLabs v3 via Replicate (tags de áudio)
  inworld: "inworld/realtime-tts-2", // muito expressivo, 100+ idiomas
  chatterbox: "resemble-ai/chatterbox-multilingual",
  fish: "lucataco/fish-speech-1.5",
  xtts: "lucataco/xtts-v2",
} as const;

export type ReplicateModelKey = keyof typeof REPLICATE_MODELS;

// ===== Catálogo curado em português brasileiro =====
// Todas usam MiniMax HD (preset puro, barato/rápido) + language_boost="Portuguese"
// no servidor. Vinheta visual no label indica categoria.
const PT_BR_CURATED: ReadonlyArray<{ id: string; label: string }> = [
  // ⭐ Google Gemini TTS (alta qualidade, 70+ idiomas, language_code pt-BR)
  { id: "g:Charon", label: "⭐ Google · Charon (M, grave)" },
  { id: "g:Puck", label: "⭐ Google · Puck (M)" },
  { id: "g:Fenrir", label: "⭐ Google · Fenrir (M, forte)" },
  { id: "g:Kore", label: "⭐ Google · Kore (F)" },
  { id: "g:Aoede", label: "⭐ Google · Aoede (F)" },
  { id: "g:Leda", label: "⭐ Google · Leda (F, jovem)" },
  { id: "g:Orus", label: "⭐ Google · Orus (M, firme)" },
  { id: "g:Zephyr", label: "⭐ Google · Zephyr (F, leve)" },
  // 🎙️ ElevenLabs v3 (via Replicate) — IDs de voz ElevenLabs
  { id: "el:21m00Tcm4TlvDq8ikWAM", label: "🎙️ ElevenLabs v3 · Rachel (F)" },
  { id: "el:pNInz6obpgDQGcFmaJgB", label: "🎙️ ElevenLabs v3 · Adam (M)" },
  { id: "el:ErXwobaYiN019PkySvjV", label: "🎙️ ElevenLabs v3 · Antoni (M)" },
  { id: "el:EXAVITQu4vr4xnSDxMaL", label: "🎙️ ElevenLabs v3 · Bella (F)" },
  // 🌀 Inworld (muito expressivo, multilíngue)
  { id: "iw:Hades", label: "🌀 Inworld · Hades (M, grave)" },
  { id: "iw:Marcus", label: "🌀 Inworld · Marcus (M)" },
  { id: "iw:Theodore", label: "🌀 Inworld · Theodore (M, sábio)" },
  { id: "iw:Olivia", label: "🌀 Inworld · Olivia (F)" },
  { id: "iw:Serena", label: "🌀 Inworld · Serena (F)" },
  { id: "iw:Luna", label: "🌀 Inworld · Luna (F, suave)" },
  // Apresentação / TV
  { id: "presenter_male", label: "🇧🇷 Apresentador de TV (M)" },
  { id: "presenter_female", label: "🇧🇷 Apresentadora de TV (F)" },
  { id: "Deep_Voice_Man", label: "🇧🇷 Locutor grave (M)" },
  { id: "Friendly_Person", label: "🇧🇷 Repórter amigável (F)" },
  // Narração / Audiobook
  { id: "audiobook_male_1", label: "🇧🇷 Narrador audiobook (M)" },
  { id: "audiobook_female_1", label: "🇧🇷 Narradora audiobook (F)" },
  { id: "audiobook_male_2", label: "🇧🇷 Narrador documentário (M)" },
  { id: "audiobook_female_2", label: "🇧🇷 Narradora suave (F)" },
  // Personagens
  { id: "Casual_Guy", label: "🇧🇷 Jovem casual (M)" },
  { id: "Lively_Girl", label: "🇧🇷 Jovem animada (F)" },
  { id: "Patient_Man", label: "🇧🇷 Senhor sábio (M)" },
  { id: "Imposing_Manner", label: "🇧🇷 Vilão imponente (M)" },
  { id: "Sweet_Girl_2", label: "🇧🇷 Doce e leve (F)" },
  { id: "Determined_Man", label: "🇧🇷 Determinado / coach (M)" },
  // Variantes Turbo (mais rápido) — mesmos timbres, menor latência
  { id: "mmt:presenter_male", label: "⚡ Apresentador (M) · Turbo" },
  { id: "mmt:presenter_female", label: "⚡ Apresentadora (F) · Turbo" },
  { id: "mmt:audiobook_male_1", label: "⚡ Narrador (M) · Turbo" },
  { id: "mmt:audiobook_female_1", label: "⚡ Narradora (F) · Turbo" },
  // Chatterbox default (PT nativo, sem referência)
  { id: "cb:", label: "🌎 Chatterbox PT (voz padrão · multilíngue)" },
];

// ===== Catálogo original (mantido) =====
const LEGACY: ReadonlyArray<{ id: string; label: string }> = [
  // Presets em inglês
  { id: "Wise_Woman", label: "EN · Wise Woman (F)" },
  { id: "Calm_Woman", label: "EN · Calm Woman (F)" },
  { id: "Young_Knight", label: "EN · Young Knight (M)" },
  { id: "Lovely_Girl", label: "EN · Lovely Girl (F)" },
  { id: "Decent_Boy", label: "EN · Decent Boy (M)" },
  { id: "Elegant_Man", label: "EN · Elegant Man (M)" },
  { id: "Abbess", label: "EN · Abbess (F)" },
  { id: "Exuberant_Girl", label: "EN · Exuberant Girl (F)" },
  { id: "Inspirational_girl", label: "EN · Inspirational Girl (F)" },
  { id: "Charming_Lady", label: "EN · Charming Lady (F)" },
  { id: "Charming_Santa", label: "EN · Charming Santa (M)" },
  { id: "Grinch", label: "EN · Grinch (M)" },

  // MiniMax originais
  { id: "male-qn-qingse", label: "Masc · Qingse" },
  { id: "male-qn-jingying", label: "Masc · Jingying" },
  { id: "male-qn-badao", label: "Masc · Badao (firme)" },
  { id: "male-qn-daxuesheng", label: "Masc · Universitário" },
  { id: "female-shaonv", label: "Fem · Shaonv (jovem)" },
  { id: "female-yujie", label: "Fem · Yujie (madura)" },
  { id: "female-chengshu", label: "Fem · Chengshu" },
  { id: "female-tianmei", label: "Fem · Tianmei (doce)" },

  // Personagens
  { id: "clever_boy", label: "Personagem · Clever Boy" },
  { id: "cute_boy", label: "Personagem · Cute Boy" },
  { id: "lovely_girl", label: "Personagem · Lovely Girl" },
  { id: "cartoon_pig", label: "Personagem · Cartoon Pig" },

  // Outros idiomas
  { id: "Spanish_Narrator", label: "ES · Narrador (M)" },
  { id: "French_Male_Speech_New", label: "FR · Male Speech" },
  { id: "Italian_BraveHeroine", label: "IT · Brave Heroine (F)" },
  { id: "German_PlayfulMan", label: "DE · Playful Man (M)" },
  { id: "Japanese_KindLady", label: "JA · Kind Lady (F)" },
  { id: "Korean_ElegantPrincess", label: "KO · Princess (F)" },
];

export const REPLICATE_VOICES = [...PT_BR_CURATED, ...LEGACY] as const;

// Mantidos pra compat com imports antigos
export const REPLICATE_TTS_MODEL = REPLICATE_MODELS["minimax-hd"];
export const REPLICATE_CLONE_TTS_MODEL = REPLICATE_MODELS.xtts;

/** Resolve qual modelo + input usar a partir do voiceId (prefixos opcionais). */
export function resolveReplicateVoice(voiceId: string): {
  model: ReplicateModelKey;
  voiceParam: string; // voice_id (preset) OU URL (clone)
} {
  const v = voiceId.trim();
  if (v.startsWith("g:")) return { model: "google", voiceParam: v.slice(2) };
  if (v.startsWith("el:")) return { model: "eleven-v3", voiceParam: v.slice(3) };
  if (v.startsWith("iw:")) return { model: "inworld", voiceParam: v.slice(3) };
  if (v.startsWith("mmt:")) return { model: "minimax-turbo", voiceParam: v.slice(4) };
  if (v.startsWith("cb:")) return { model: "chatterbox", voiceParam: v.slice(3) };
  if (v.startsWith("fish:")) return { model: "fish", voiceParam: v.slice(5) };
  if (v.startsWith("xtts:")) return { model: "xtts", voiceParam: v.slice(5) };
  // URL crua de áudio → Fish Speech (clone zero-shot mais consistente).
  if (/^https?:\/\//i.test(v)) return { model: "fish", voiceParam: v };
  return { model: "minimax-hd", voiceParam: v };
}
