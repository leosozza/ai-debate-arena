import type { FormatEngine, Turn } from "./types";
import { pushCommentators } from "./types";

// Problema do Século: o mediador apresenta UM problema atual. Cada personagem,
// de sua época, oferece um ângulo (não rebate ninguém). Última rodada: cada
// um sugere UMA ação. Mediador combina tudo numa solução-síntese final, e
// cada personagem dá uma última frase de fechamento contribuindo com sua
// parte da solução combinada.
export const centuryProblemEngine: FormatEngine = {
  id: "century_problem",
  tone:
    "Tom colaborativo e curatorial — você é o anfitrião que junta cabeças de épocas diferentes diante de UM problema do nosso século. Não é debate: é construção. Você não rankeia, você sintetiza.",
  verdictKind: "synthesis",
  verdictPromptExtra:
    "Encerre apresentando a SOLUÇÃO COMBINADA: integre o ângulo de cada personagem (cite-os pelo nome) num plano de ação único em 3-4 parágrafos. Não declare vencedor — celebre a engenharia coletiva.",
  phaseHint(phase, role) {
    if (role === "moderator") return "";
    if (phase === "ângulo")
      return "Ofereça o ÂNGULO da sua época sobre o problema (não rebata ninguém): o que sua tradição/era percebe que os outros podem não perceber. Até 130 palavras.";
    if (phase === "ação")
      return "Sugira UMA ação concreta que sua época teria proposto para enfrentar este problema. Direto, até 80 palavras.";
    if (phase === "fechamento")
      return "Uma frase única: a parte da solução que você acha que NÃO PODE FALTAR no plano combinado.";
    return "";
  },
  buildSequence(parts, blocks, _rounds, cCount) {
    const speakers = [...parts].sort((a, b) => a.slot - b.slot);
    const seq: Turn[] = [];
    for (let b = 0; b < blocks; b++) {
      const isFinal = b === blocks - 1;
      seq.push({ speaker: "moderator", phase: `vinheta ${b + 1}`, block_index: b });
      if (isFinal) {
        for (const s of speakers)
          seq.push({ speaker: s.slot, phase: "ação", block_index: b });
        pushCommentators(seq, b, true, cCount);
        seq.push({ speaker: "moderator", phase: "veredito", block_index: b });
        for (const s of speakers)
          seq.push({ speaker: s.slot, phase: "fechamento", block_index: b });
      } else {
        for (const s of speakers)
          seq.push({ speaker: s.slot, phase: "ângulo", block_index: b });
        pushCommentators(seq, b, false, cCount);
      }
    }
    return seq;
  },
  sequenceLength(parts, blocks, _rounds, cCount) {
    const n = parts.length;
    const inter = (blocks - 1) * (1 + n + cCount);
    const final = 1 + n + cCount + 1 + n;
    return inter + final;
  },
};
