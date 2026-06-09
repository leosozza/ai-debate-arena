// Client-safe catalog of Replicate voice presets (minimax/speech-02-hd via gateway).
export const REPLICATE_VOICES = [
  { id: "Wise_Woman", label: "Wise Woman (F)" },
  { id: "Friendly_Person", label: "Friendly Person (N)" },
  { id: "Calm_Woman", label: "Calm Woman (F)" },
  { id: "Casual_Guy", label: "Casual Guy (M)" },
  { id: "Deep_Voice_Man", label: "Deep Voice Man (M)" },
  { id: "Patient_Man", label: "Patient Man (M)" },
  { id: "Inspirational_girl", label: "Inspirational Girl (F)" },
  { id: "Lively_Girl", label: "Lively Girl (F)" },
  { id: "Determined_Man", label: "Determined Man (M)" },
  { id: "Elegant_Man", label: "Elegant Man (M)" },
  { id: "Imposing_Manner", label: "Imposing Manner (M)" },
  { id: "Sweet_Girl_2", label: "Sweet Girl (F)" },
] as const;

export const REPLICATE_TTS_MODEL = "minimax/speech-02-hd";
export const REPLICATE_CLONE_TTS_MODEL = "lucataco/xtts-v2";
