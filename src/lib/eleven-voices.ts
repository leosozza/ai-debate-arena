// Client-safe catalog of ElevenLabs voices (no server-only imports).
// These are ElevenLabs' default/legacy public voices; they work with the
// multilingual model for Portuguese. Users can change per debater.
export const ELEVEN_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel (F)", gender: "f" as const },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella (F)", gender: "f" as const },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi (F)", gender: "f" as const },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam (M)", gender: "m" as const },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni (M)", gender: "m" as const },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh (M)", gender: "m" as const },
] as const;

export const DEFAULT_ELEVEN = {
  moderator: "21m00Tcm4TlvDq8ikWAM", // Rachel
  a: "pNInz6obpgDQGcFmaJgB", // Adam
  b: "ErXwobaYiN019PkySvjV", // Antoni
};
