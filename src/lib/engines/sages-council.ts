import type { FormatEngine, Turn } from "./types";
import { pushCommentators } from "./types";

// Conselho dos Sábios: sem combate. Cada fala referencia a anterior,
// e o mediador faz uma SÍNTESE intermediária a cada 2 contribuições.
// Veredito é uma síntese coletiva (3-4 parágrafos do mediador).
export const sagesCouncilEngine: FormatEngine = {
  id: "sages_council",
  tone:
    "Tom respeitoso e reflexivo de um conselho de sábios — sem ataques diretos, buscando sabedoria conjunta. Sua função é tecer pontes entre as contribuições.",
  verdictKind: "synthesis",
  verdictPromptExtra:
    "Encerre com uma SÍNTESE COLETIVA em 3 a 4 parágrafos: o que o conselho descobriu junto, as novas perguntas que ficaram, e a sabedoria final destilada. Não rankeie sábios — celebre a construção comum.",
  phaseHint(phase, role) {
    if (role === "moderator") {
      if (phase.startsWith("síntese"))
        return "Faça uma SÍNTESE breve (até 70 palavras): conecte os dois últimos sábios, aponte concordâncias e tensões, e provoque a próxima reflexão.";
      return "";
    }
    if (phase === "contribuição")
      return "Você contribui para o conselho: REFERENCIE explicitamente o sábio anterior (cite-o pelo nome), estenda, complemente ou ofereça outro ângulo. SEM combate. Até 130 palavras.";
    if (phase === "considerações finais")
      return "Fechamento sábio: uma pergunta ou um aforismo curto que sintetize sua visão. Até 70 palavras.";
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
          seq.push({ speaker: s.slot, phase: "considerações finais", block_index: b });
        pushCommentators(seq, b, true, cCount);
        seq.push({ speaker: "moderator", phase: "veredito", block_index: b });
      } else {
        let count = 0;
        for (const s of speakers) {
          seq.push({ speaker: s.slot, phase: "contribuição", block_index: b });
          count++;
          if (count % 2 === 0)
            seq.push({ speaker: "moderator", phase: `síntese ${b + 1}.${count / 2}`, block_index: b });
        }
        pushCommentators(seq, b, false, cCount);
      }
    }
    return seq;
  },
  sequenceLength(parts, blocks, _rounds, cCount) {
    const n = parts.length;
    const synths = Math.floor(n / 2);
    const inter = (blocks - 1) * (1 + n + synths + cCount);
    const final = 1 + n + cCount + 1;
    return inter + final;
  },
};
