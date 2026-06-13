import type { FormatEngine, Turn } from "./types";
import { pushCommentators } from "./types";

// Entrevista Impossível: 1 entrevistador × 1+ entrevistados. Sem mediador
// externo — o próprio entrevistador conduz. Cada bloco: vinheta breve,
// depois pergunta → resposta para cada convidado.
export const interviewEngine: FormatEngine = {
  id: "interview",
  tone:
    "Tom de entrevista de TV — perguntas instigantes, ritmo íntimo, sem combate.",
  verdictKind: "individual",
  verdictPromptExtra:
    "Encerre com um balanço da entrevista: as revelações mais marcantes do(s) entrevistado(s) e o que ficou em aberto.",
  phaseHint(phase, role) {
    if (role === "interviewer")
      return "Você é o ENTREVISTADOR: faça UMA pergunta curta, instigante e direta. Sem prefácios longos. Até 60 palavras.";
    if (role === "interviewee")
      return "Você é o ENTREVISTADO: responda com profundidade e personalidade, em até 170 palavras.";
    return "";
  },
  buildSequence(parts, blocks, _rounds, cCount) {
    const speakers = [...parts].sort((a, b) => a.slot - b.slot);
    const interviewer = parts.find((p) => p.role === "interviewer") ?? speakers[0];
    const guests = speakers.filter((p) => p.slot !== interviewer?.slot);
    const seq: Turn[] = [];
    for (let b = 0; b < blocks; b++) {
      const isFinal = b === blocks - 1;
      seq.push({ speaker: "moderator", phase: `vinheta ${b + 1}`, block_index: b });
      for (const g of guests) {
        seq.push({ speaker: interviewer.slot, phase: `pergunta ${b + 1}`, block_index: b, role: "interviewer" });
        seq.push({ speaker: g.slot, phase: `resposta ${b + 1}`, block_index: b, role: "interviewee" });
      }
      pushCommentators(seq, b, isFinal, cCount);
      if (isFinal) seq.push({ speaker: "moderator", phase: "veredito", block_index: b });
    }
    return seq;
  },
  sequenceLength(parts, blocks, _rounds, cCount) {
    const interviewer = parts.find((p) => p.role === "interviewer") ?? parts[0];
    const guests = parts.filter((p) => p.slot !== interviewer.slot).length;
    return blocks * (1 + guests * 2 + cCount) + 1;
  },
};
