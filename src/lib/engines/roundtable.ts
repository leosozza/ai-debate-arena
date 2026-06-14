import type { FormatEngine, Participant, Slim, Turn } from "./types";
import { pushCommentators } from "./types";

export const roundtableEngine: FormatEngine = {
  id: "roundtable",
  tone:
    "Tom de mesa-redonda de TV — vivo, direto, com troca de ideias entre os convidados. Você é o âncora: provoca, distribui falas e cobra contraposições sem deixar a conversa esfriar.",
  verdictKind: "individual",
  verdictPromptExtra:
    "Encerre destacando QUEM brilhou na mesa, quem trouxe o argumento mais forte e quem ficou apagado. Cite nomes e momentos reais.",
  allowsTwist: true,
  phaseHint(phase, role) {
    if (role === "moderator") return "";
    if (/réplica/.test(phase))
      return "Você está numa mesa redonda de TV: rebata UM ponto específico de OUTRO convidado citando-o pelo nome. Sem combate frontal — provocação inteligente.";
    if (phase === "abertura")
      return "Apresente seu ângulo do tema em até 3 frases, deixando ganchos para os outros convidados retomarem.";
    if (phase === "considerações finais")
      return "Faça um fechamento curto: a tese que você quer que fique na cabeça do espectador.";
    return "";
  },
  buildSequence(parts, blocks, rounds, cCount) {
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
        for (const s of speakers)
          seq.push({ speaker: s.slot, phase: "abertura", block_index: b });
        for (let r = 1; r <= rounds; r++) {
          for (const s of speakers)
            seq.push({ speaker: s.slot, phase: `réplica ${r}`, block_index: b });
        }
        pushCommentators(seq, b, false, cCount);
      }
    }
    return seq;
  },
  sequenceLength(parts, blocks, rounds, cCount) {
    const n = parts.length;
    const inter = (blocks - 1) * (1 + n + rounds * n + cCount);
    const final = 1 + n + cCount + 1;
    return inter + final;
  },
};
