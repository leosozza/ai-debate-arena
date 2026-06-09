// Client-safe catalog of Replicate voice presets (minimax/speech-02-hd via gateway).
// O modelo minimax/speech-02-hd no Replicate aceita os mesmos voice_ids do MiniMax.
export const REPLICATE_VOICES = [
  // === Presets em inglês (recomendados p/ PT-BR também) ===
  { id: "Wise_Woman", label: "EN · Wise Woman (F)" },
  { id: "Friendly_Person", label: "EN · Friendly Person" },
  { id: "Calm_Woman", label: "EN · Calm Woman (F)" },
  { id: "Casual_Guy", label: "EN · Casual Guy (M)" },
  { id: "Deep_Voice_Man", label: "EN · Deep Voice Man (M)" },
  { id: "Patient_Man", label: "EN · Patient Man (M)" },
  { id: "Young_Knight", label: "EN · Young Knight (M)" },
  { id: "Determined_Man", label: "EN · Determined Man (M)" },
  { id: "Lovely_Girl", label: "EN · Lovely Girl (F)" },
  { id: "Decent_Boy", label: "EN · Decent Boy (M)" },
  { id: "Imposing_Manner", label: "EN · Imposing Manner (M)" },
  { id: "Elegant_Man", label: "EN · Elegant Man (M)" },
  { id: "Abbess", label: "EN · Abbess (F)" },
  { id: "Sweet_Girl_2", label: "EN · Sweet Girl (F)" },
  { id: "Exuberant_Girl", label: "EN · Exuberant Girl (F)" },
  { id: "Inspirational_girl", label: "EN · Inspirational Girl (F)" },
  { id: "Lively_Girl", label: "EN · Lively Girl (F)" },
  { id: "Charming_Lady", label: "EN · Charming Lady (F)" },
  { id: "Charming_Santa", label: "EN · Charming Santa (M)" },
  { id: "Grinch", label: "EN · Grinch (M)" },

  // === Apresentadores / Audiobook ===
  { id: "presenter_male", label: "Apresentador (M)" },
  { id: "presenter_female", label: "Apresentadora (F)" },
  { id: "audiobook_male_1", label: "Audiobook M 1" },
  { id: "audiobook_male_2", label: "Audiobook M 2" },
  { id: "audiobook_female_1", label: "Audiobook F 1" },
  { id: "audiobook_female_2", label: "Audiobook F 2" },

  // === MiniMax PT/EN multilíngue ===
  { id: "male-qn-qingse", label: "Masc · Qingse" },
  { id: "male-qn-jingying", label: "Masc · Jingying" },
  { id: "male-qn-badao", label: "Masc · Badao (firme)" },
  { id: "male-qn-daxuesheng", label: "Masc · Universitário" },
  { id: "female-shaonv", label: "Fem · Shaonv (jovem)" },
  { id: "female-yujie", label: "Fem · Yujie (madura)" },
  { id: "female-chengshu", label: "Fem · Chengshu" },
  { id: "female-tianmei", label: "Fem · Tianmei (doce)" },

  // === Personagens ===
  { id: "clever_boy", label: "Personagem · Clever Boy" },
  { id: "cute_boy", label: "Personagem · Cute Boy" },
  { id: "lovely_girl", label: "Personagem · Lovely Girl" },
  { id: "cartoon_pig", label: "Personagem · Cartoon Pig" },
  { id: "bingjiao_didi", label: "Personagem · Bingjiao Didi" },
  { id: "junlang_nanyou", label: "Personagem · Junlang Nanyou" },
  { id: "chunzhen_xuedi", label: "Personagem · Chunzhen Xuedi" },
  { id: "lengdan_xiongzhang", label: "Personagem · Lengdan Xiongzhang" },
  { id: "badao_shaoye", label: "Personagem · Badao Shaoye" },
  { id: "tianxin_xiaoling", label: "Personagem · Tianxin Xiaoling" },
  { id: "qiaopi_mengmei", label: "Personagem · Qiaopi Mengmei" },
  { id: "wumei_yujie", label: "Personagem · Wumei Yujie" },
  { id: "diadia_xuemei", label: "Personagem · Diadia Xuemei" },
  { id: "danya_xuejie", label: "Personagem · Danya Xuejie" },

  // === Idiomas (multilíngue) ===
  { id: "Spanish_Narrator", label: "ES · Narrador (M)" },
  { id: "Spanish_SereneWoman", label: "ES · Serene Woman (F)" },
  { id: "French_Male_Speech_New", label: "FR · Male Speech" },
  { id: "French_Female_News Anchor", label: "FR · Female News Anchor" },
  { id: "Italian_BraveHeroine", label: "IT · Brave Heroine (F)" },
  { id: "German_PlayfulMan", label: "DE · Playful Man (M)" },
  { id: "Japanese_IntellectualSenior", label: "JA · Senior (M)" },
  { id: "Japanese_KindLady", label: "JA · Kind Lady (F)" },
  { id: "Korean_CheerfulBoyfriend", label: "KO · Boyfriend (M)" },
  { id: "Korean_ElegantPrincess", label: "KO · Princess (F)" },
] as const;

export const REPLICATE_TTS_MODEL = "minimax/speech-02-hd";
export const REPLICATE_CLONE_TTS_MODEL = "lucataco/xtts-v2";
