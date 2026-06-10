// Catálogo de formatos de programa. Client-safe (usado pela UI e pelos prompts).
// O formato "duel" (1×1) é o legado e continua usando as colunas
// debater_a_* / debater_b_* em `debates`. Os novos formatos usam a tabela
// `debate_participants` (slot 0..N-1, role específico).

export type DebateFormatId =
  | "duel"
  | "roundtable"
  | "presidential"
  | "tribunal"
  | "interview"
  | "era_clash"
  | "sages_council"
  | "ideas_war"
  | "century_problem";

export type ParticipantRole =
  | "debater"
  | "moderator"
  | "judge"
  | "prosecutor"
  | "defender"
  | "interviewer"
  | "interviewee"
  | "team_a"
  | "team_b";

export type DebateFormat = {
  id: DebateFormatId;
  label: string;
  emoji: string;
  tagline: string;
  description: string;
  /** Faixa de debatedores/convidados (NÃO conta mediador). */
  minDebaters: number;
  maxDebaters: number;
  /** Papéis fixos exigidos além dos debatedores (ex.: 1 entrevistador). */
  fixedRoles?: Array<{ role: ParticipantRole; label: string; min: number; max: number }>;
  /** Se true, ainda não tem engine própria — usa pipeline "duelo" como fallback. */
  isNew?: boolean;
};

export const DEBATE_FORMATS: DebateFormat[] = [
  {
    id: "duel",
    label: "Duelo 1×1",
    emoji: "⚔️",
    tagline: "Clássico A × B com mediador",
    description: "O formato original: dois debatedores opostos, mediador e veredito.",
    minDebaters: 2,
    maxDebaters: 2,
  },
  {
    id: "roundtable",
    label: "Mesa Redonda",
    emoji: "🪑",
    tagline: "3 a 6 convidados em debate aberto",
    description: "Vários pontos de vista sobre o mesmo tema. Mediador distribui falas e provoca contraposições.",
    minDebaters: 3,
    maxDebaters: 6,
    isNew: true,
  },
  {
    id: "presidential",
    label: "Debate Presidencial",
    emoji: "🎙️",
    tagline: "4 a 8 candidatos, tempos cronometrados",
    description: "Estilo TV: pergunta do mediador, resposta, réplica, tréplica. Cada um defende sua plataforma.",
    minDebaters: 4,
    maxDebaters: 8,
    isNew: true,
  },
  {
    id: "tribunal",
    label: "Tribunal da História",
    emoji: "⚖️",
    tagline: "1 réu, acusação × defesa, jurados decidem",
    description: "Julgamento simulado: promotores acusam, defensores defendem, jurados deliberam um veredito.",
    minDebaters: 2,
    maxDebaters: 5,
    fixedRoles: [
      { role: "interviewee", label: "Réu", min: 1, max: 1 },
      { role: "judge", label: "Jurado(s)", min: 1, max: 3 },
    ],
    isNew: true,
  },
  {
    id: "interview",
    label: "Entrevista Impossível",
    emoji: "🎤",
    tagline: "1 entrevistador × 1 entrevistado",
    description: "Conversa íntima e provocativa, sem mediador. Perguntas curtas, respostas longas.",
    minDebaters: 0,
    maxDebaters: 0,
    fixedRoles: [
      { role: "interviewer", label: "Entrevistador", min: 1, max: 1 },
      { role: "interviewee", label: "Entrevistado", min: 1, max: 1 },
    ],
    isNew: true,
  },
  {
    id: "era_clash",
    label: "Debate Entre Eras",
    emoji: "⏳",
    tagline: "Personagem histórico × contemporâneo",
    description: "Duelo clássico com twist: um vem do passado, o outro do presente. Choque de mundos.",
    minDebaters: 2,
    maxDebaters: 2,
    isNew: true,
  },
  {
    id: "sages_council",
    label: "Conselho dos Sábios",
    emoji: "🦉",
    tagline: "3 a 5 sábios em diálogo reflexivo",
    description: "Tom respeitoso, sem combate. Pensadores buscam síntese e novas perguntas, não vitória.",
    minDebaters: 3,
    maxDebaters: 5,
    isNew: true,
  },
  {
    id: "ideas_war",
    label: "Guerra das Ideias",
    emoji: "🛡️",
    tagline: "Time A × Time B",
    description: "Times defendem visões opostas, alternando abertura e réplicas. Veredito é coletivo por time.",
    minDebaters: 4,
    maxDebaters: 8,
    isNew: true,
  },
  {
    id: "century_problem",
    label: "Problema do Século",
    emoji: "🧩",
    tagline: "Personagens de épocas distintas resolvem 1 problema",
    description: "Não é debate — é colaboração entre figuras de épocas diferentes diante de um desafio atual.",
    minDebaters: 3,
    maxDebaters: 5,
    isNew: true,
  },
];

export function getFormat(id: string): DebateFormat | undefined {
  return DEBATE_FORMATS.find((f) => f.id === id);
}
