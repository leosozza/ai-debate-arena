// Client-safe catalog of ElevenLabs voices (no server-only imports).
// These are ElevenLabs' default/legacy public voices; they work with the
// multilingual model for Portuguese. Users can change per debater.
export const ELEVEN_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel (F)" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella (F)" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi (F)" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam (M)" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni (M)" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh (M)" },
] as const;

export const DEFAULT_ELEVEN = {
  moderator: "21m00Tcm4TlvDq8ikWAM", // Rachel
  a: "pNInz6obpgDQGcFmaJgB", // Adam
  b: "ErXwobaYiN019PkySvjV", // Antoni
};
