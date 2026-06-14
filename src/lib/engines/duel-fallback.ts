import type { FormatEngine, Turn } from "./types";
import { pushCommentators } from "./types";

// Fallback round-robin para qualquer formato sem engine dedicada (inclui o
// "duel" lido pelo motor multi com dois participantes). Mantém o
// comportamento histórico para retrocompatibilidade.
export const duelFallbackEngine: FormatEngine = {
  id: "duel",
  tone:
    "Tom de programa de debate de TV — vivo, direto, com troca de ideias entre os convidados.",
  verdictKind: "individual",
  verdictPromptExtra: "",
  allowsTwist: true,
  phaseHint(_phase, _role) {
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
