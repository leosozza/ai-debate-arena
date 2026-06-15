// Client-safe re-export of the model catalog (no server-only imports).
export const AVAILABLE_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Lovable)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Lovable)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Lovable)" },
  { id: "google-direct/gemini-2.5-flash", label: "Gemini 2.5 Flash (Google API direta)" },
  { id: "google-direct/gemini-2.5-pro", label: "Gemini 2.5 Pro (Google API direta)" },
  { id: "google-direct/gemini-2.0-flash", label: "Gemini 2.0 Flash (Google API direta)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini (Lovable)" },
  { id: "openai/gpt-5", label: "GPT-5 (Lovable)" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano (Lovable)" },
] as const;
