// Mapa client-safe de imagens-âncora geradas em massa.
// Vite resolve cada import para uma URL pública do bundle.
import socrates from "@/assets/personas/socrates.jpg";
import nietzsche from "@/assets/personas/nietzsche.jpg";
import jesus from "@/assets/personas/jesus.jpg";
import marx from "@/assets/personas/marx.jpg";
import adamSmith from "@/assets/personas/adam-smith.jpg";
import einstein from "@/assets/personas/einstein.jpg";
import elonMusk from "@/assets/personas/elon-musk.jpg";
import napoleon from "@/assets/personas/napoleon.jpg";
import pele from "@/assets/personas/pele.jpg";

/** Mapa nome-da-persona → URL pública da imagem-âncora. */
export const PERSONA_ANCHOR_IMAGES: Record<string, string> = {
  "Sócrates": socrates,
  "Friedrich Nietzsche": nietzsche,
  "Jesus de Nazaré": jesus,
  "Karl Marx": marx,
  "Adam Smith": adamSmith,
  "Albert Einstein": einstein,
  "Elon Musk": elonMusk,
  "Napoleão Bonaparte": napoleon,
  "Pelé": pele,
};
