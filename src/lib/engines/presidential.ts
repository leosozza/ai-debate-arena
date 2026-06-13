import type { FormatEngine, Turn } from "./types";
import { pushCommentators } from "./types";

// Presidencial: por bloco, o mediador faz uma pergunta direcionada a cada
// candidato; cada candidato responde; o candidato seguinte (rotacionado) tem
// direito de réplica. Determinístico, sem hash, fácil de reproduzir.
export const presidentialEngine: FormatEngine = {
  id: "presidential",
  tone:
    "Tom de debate presidencial de TV — firme, cronometrado, com direito de resposta, sem desrespeito. Você é o âncora-mediador, direciona perguntas pelo nome.",
  verdictKind: "individual",
  verdictPromptExtra:
    "Faça um placar do desempenho: quem soou mais presidencial, quem se contradisse, quem cresceu na réplica. Cite candidatos pelo nome.",
  phaseHint(phase, role) {
    if (role === "moderator") return "";
    if (/^resposta/.test(phase))
      return "Você é o CANDIDATO interpelado: responda em até 90 segundos (~140 palavras), citando uma proposta concreta. Sem ataques pessoais.";
    if (/^réplica/.test(phase))
      return "Você é o CANDIDATO com direito de RÉPLICA: rebata DIRETAMENTE a fala anterior, em até 60s (~90 palavras), citando o adversário pelo nome.";
    if (phase === "considerações finais")
      return "Considerações finais de campanha: uma frase-síntese da sua plataforma para fechar.";
    return "";
  },
  buildSequence(parts, blocks, _rounds, cCount) {
    const speakers = [...parts].sort((a, b) => a.slot - b.slot);
    const n = speakers.length;
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
        for (let i = 0; i < n; i++) {
          const s = speakers[i];
          const next = speakers[(i + 1) % n];
          seq.push({ speaker: "moderator", phase: `pergunta ${b + 1}`, block_index: b });
          seq.push({ speaker: s.slot, phase: `resposta ${b + 1}.${i + 1}`, block_index: b });
          seq.push({ speaker: next.slot, phase: `réplica ${b + 1}.${i + 1}`, block_index: b });
        }
        pushCommentators(seq, b, false, cCount);
      }
    }
    return seq;
  },
  sequenceLength(parts, blocks, _rounds, cCount) {
    const n = parts.length;
    const inter = (blocks - 1) * (1 + n * 3 + cCount);
    const final = 1 + n + cCount + 1;
    return inter + final;
  },
};
