import type { FormatEngine, Turn } from "./types";
import { pushCommentators } from "./types";

// Duelo 1×1 com twist temporal: um personagem do passado, outro do presente
// (ou de outra era). A engine herda a estrutura do duel multi (abertura ×
// rounds × considerações), mas injeta hint de choque temporal toda fala.
export const eraClashEngine: FormatEngine = {
  id: "era_clash",
  tone:
    "Tom de duelo entre eras — você é o mediador que enquadra o CHOQUE TEMPORAL a cada bloco: o que um vê e o outro NÃO consegue ver por causa de seu século.",
  verdictKind: "individual",
  verdictPromptExtra:
    "No veredito, julgue: qual visão ENVELHECEU MELHOR e qual ficou refém da sua época. Cite o que cada um previu (ou deixou de prever).",
  phaseHint(phase, role) {
    if (role === "moderator") return "";
    if (phase === "abertura")
      return "Lembre-se: você fala a partir do seu tempo. Marque a perspectiva da sua era ao abrir.";
    if (/^réplica/.test(phase))
      return "Rebata o outro mostrando o LIMITE da era dele: o que ele não pode ver / não viveu. Sem anacronismo: você só sabe o que se sabia no seu tempo.";
    if (phase === "considerações finais")
      return "Considerações finais: o legado da sua época sobre este tema.";
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
