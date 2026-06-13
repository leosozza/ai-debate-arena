// Gênero conhecido das personas do catálogo → usado para sugerir uma voz
// padrão do gênero certo quando a persona ainda não tem voz definida.
// (Personas fora do catálogo retornam null e não são forçadas.)
import type { VoiceProvider } from "./voice-catalog";

const FEMALE = new Set<string>(["marie curie", "margaret thatcher"]);

const CATALOG = new Set<string>([
  "sócrates", "platão", "aristóteles", "baruch spinoza", "rené descartes",
  "friedrich nietzsche", "immanuel kant", "jean-jacques rousseau", "voltaire",
  "jean-paul sartre", "jesus de nazaré", "buda", "confúcio", "lao-tsé",
  "santo agostinho", "tomás de aquino", "martinho lutero", "dalai lama",
  "karl marx", "adam smith", "john maynard keynes", "milton friedman",
  "thomas sowell", "friedrich hayek", "david ricardo", "enéas carneiro",
  "getúlio vargas", "juscelino kubitschek", "luiz inácio lula da silva",
  "jair bolsonaro", "ulysses guimarães", "tancredo neves", "winston churchill",
  "theodore roosevelt", "abraham lincoln", "nelson mandela", "margaret thatcher",
  "mahatma gandhi", "albert einstein", "nikola tesla", "isaac newton",
  "galileu galilei", "charles darwin", "marie curie", "stephen hawking",
  "leonardo da vinci", "santos dumont", "elon musk", "steve jobs", "bill gates",
  "henry ford", "sun tzu", "júlio césar", "alexandre, o grande",
  "napoleão bonaparte", "gêngis khan", "pelé", "diego maradona", "lionel messi",
  "cristiano ronaldo", "muhammad ali", "ayrton senna",
]);

/** "m" | "f" para personas conhecidas; null para desconhecidas (custom). */
export function personaGender(name: string | null | undefined): "m" | "f" | null {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return null;
  if (FEMALE.has(n)) return "f";
  if (CATALOG.has(n)) return "m";
  return null;
}

/** Resolve o gênero de uma persona: campo explícito > heurística por nome. */
export function personaGenderFrom(
  p: { gender?: string | null; name?: string | null } | null | undefined,
): "m" | "f" | null {
  if (!p) return null;
  if (p.gender === "m" || p.gender === "f") return p.gender;
  return personaGender(p.name);
}

/** Voz GRÁTIS padrão (Kokoro) do gênero indicado. */
export function defaultVoiceForGender(g: "m" | "f"): { provider: VoiceProvider; voiceId: string } {
  return g === "f"
    ? { provider: "kokoro", voiceId: "pf_dora" }
    : { provider: "kokoro", voiceId: "pm_alex" };
}
