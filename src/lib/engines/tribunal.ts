import type { FormatEngine, Turn } from "./types";
import { pushCommentators } from "./types";

// Tribunal da História: rito formal único bloco — abertura do juiz,
// acusações, defesa do réu, defesas, interrogatório dos jurados, veredito.
export const tribunalEngine: FormatEngine = {
  id: "tribunal",
  tone:
    "Tom solene de tribunal — argumentação rigorosa, respeito ao rito, sem teatro de baixa qualidade. Você preside a sessão.",
  verdictKind: "individual",
  verdictPromptExtra:
    "Pronuncie a SENTENÇA: condenado ou absolvido, com base nos argumentos efetivamente apresentados. Cite trechos e justifique sob critérios históricos.",
  phaseHint(_phase, role) {
    if (role === "prosecutor")
      return "Você é a ACUSAÇÃO: sustente a acusação com argumentos, fatos históricos e consequências. Até 170 palavras.";
    if (role === "defender")
      return "Você é a DEFESA: refute a acusação, contextualize, ofereça atenuantes. Até 170 palavras.";
    if (role === "judge")
      return "Você é JURADO: questione os pontos fracos de AMBOS os lados com imparcialidade. Até 110 palavras.";
    if (role === "debater" || role === "interviewee")
      return "Você é o RÉU: defenda-se em primeira pessoa do que está sendo dito contra você. Até 170 palavras.";
    return "";
  },
  buildSequence(parts, _blocks, _rounds, cCount) {
    const speakers = [...parts].sort((a, b) => a.slot - b.slot);
    const pros = speakers.filter((p) => p.role === "prosecutor");
    const def = speakers.filter((p) => p.role === "defender");
    const judges = speakers.filter((p) => p.role === "judge");
    const accused = speakers.filter((p) => p.role === "debater" || p.role === "interviewee");
    const seq: Turn[] = [];
    seq.push({ speaker: "moderator", phase: "abertura", block_index: 0 });
    for (const p of pros) seq.push({ speaker: p.slot, phase: "acusação", block_index: 0, role: "prosecutor" });
    for (const a of accused) seq.push({ speaker: a.slot, phase: "defesa do réu", block_index: 0, role: "debater" });
    for (const d of def) seq.push({ speaker: d.slot, phase: "defesa", block_index: 0, role: "defender" });
    for (const j of judges) seq.push({ speaker: j.slot, phase: "interrogatório", block_index: 0, role: "judge" });
    pushCommentators(seq, 0, true, cCount);
    seq.push({ speaker: "moderator", phase: "veredito", block_index: 0 });
    return seq;
  },
  sequenceLength(parts, _blocks, _rounds, cCount) {
    const pros = parts.filter((p) => p.role === "prosecutor").length;
    const def = parts.filter((p) => p.role === "defender").length;
    const judges = parts.filter((p) => p.role === "judge").length;
    const accused = parts.filter((p) => p.role === "debater" || p.role === "interviewee").length;
    return 1 + pros + accused + def + judges + cCount + 1;
  },
};
