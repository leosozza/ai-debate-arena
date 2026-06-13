import type { FormatEngine, Turn, Participant, Slim } from "./types";
import { pushCommentators } from "./types";

function partitionTeams<T extends { slot: number; team?: string | null }>(parts: T[]): {
  teamA: T[];
  teamB: T[];
} {
  const sorted = [...parts].sort((a, b) => a.slot - b.slot);
  const teamA: T[] = [];
  const teamB: T[] = [];
  // Se houver team explícito, usar; senão, dividir por slot par/ímpar (fallback).
  const hasTeam = sorted.some((p) => p.team);
  if (hasTeam) {
    for (const p of sorted) (p.team === "B" ? teamB : teamA).push(p);
  } else {
    for (const p of sorted) (p.slot % 2 === 0 ? teamA : teamB).push(p);
  }
  return { teamA, teamB };
}

export const ideasWarEngine: FormatEngine = {
  id: "ideas_war",
  tone:
    "Tom de Guerra das Ideias — você é o árbitro entre dois TIMES com visões opostas. Anuncie placar simbólico de TIME a cada bloco, não de indivíduos.",
  verdictKind: "team",
  verdictPromptExtra:
    "Veredito POR TIME: declare o time vencedor com base na coerência coletiva e cite o MVP de cada lado (quem puxou a linha de raciocínio mais forte). Nada de ranking individual entre times.",
  phaseHint(phase, role) {
    if (role === "moderator") return "";
    if (phase === "abertura")
      return "Você fala PELO seu time: estabeleça a tese coletiva, não opiniões pessoais. Até 130 palavras.";
    if (/^réplica/.test(phase))
      return "Rebata o TIME ADVERSÁRIO (não um indivíduo específico): mostre por que a visão deles falha em conjunto. Até 110 palavras.";
    if (phase === "considerações finais")
      return "Fechamento pelo time: a frase que você quer que represente seu lado.";
    return "";
  },
  buildSequence(parts: Participant[], blocks, rounds, cCount) {
    const { teamA, teamB } = partitionTeams(parts);
    const seq: Turn[] = [];
    for (let b = 0; b < blocks; b++) {
      const isFinal = b === blocks - 1;
      seq.push({ speaker: "moderator", phase: `vinheta ${b + 1}`, block_index: b });
      if (isFinal) {
        for (const s of [...teamA, ...teamB])
          seq.push({ speaker: s.slot, phase: "considerações finais", block_index: b });
        pushCommentators(seq, b, true, cCount);
        seq.push({ speaker: "moderator", phase: "veredito", block_index: b });
      } else {
        // abertura: time A inteiro, depois time B inteiro
        for (const s of teamA) seq.push({ speaker: s.slot, phase: "abertura", block_index: b });
        for (const s of teamB) seq.push({ speaker: s.slot, phase: "abertura", block_index: b });
        // réplicas: alternar A/B por round
        for (let r = 1; r <= rounds; r++) {
          const len = Math.max(teamA.length, teamB.length);
          for (let i = 0; i < len; i++) {
            if (teamA[i])
              seq.push({ speaker: teamA[i].slot, phase: `réplica ${r}`, block_index: b });
            if (teamB[i])
              seq.push({ speaker: teamB[i].slot, phase: `réplica ${r}`, block_index: b });
          }
        }
        pushCommentators(seq, b, false, cCount);
      }
    }
    return seq;
  },
  sequenceLength(parts: Slim[], blocks, rounds, cCount) {
    const n = parts.length;
    const inter = (blocks - 1) * (1 + n + rounds * n + cCount);
    const final = 1 + n + cCount + 1;
    return inter + final;
  },
};
