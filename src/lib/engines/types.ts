// Client-safe types for per-format engines. Used by both multi-debate
// (server) and multi-sequence (isomorphic helper for the UI progress bar).

export type SpeakerKind = "moderator" | "c0" | "c1" | number;

export type Turn = {
  speaker: SpeakerKind;
  phase: string;
  block_index: number;
  role?: string;
};

export type Slim = { slot: number; role: string; team?: string | null };

export type Participant = {
  slot: number;
  role: string;
  display_name: string;
  persona_prompt: string;
  model: string | null;
  team: string | null;
};

export type VerdictKind = "individual" | "team" | "synthesis";

export type FormatEngine = {
  id: string;
  /** Sequência determinística completa de turnos. */
  buildSequence(
    parts: Participant[],
    blocks: number,
    rounds: number,
    cCount: number,
  ): Turn[];
  /** Conta turnos sem precisar dos prompts (para o progresso da UI). */
  sequenceLength(parts: Slim[], blocks: number, rounds: number, cCount: number): number;
  /** Tom do mediador injetado no system prompt. */
  tone: string;
  /** Pista específica do formato para o falante (persona) por fase. */
  phaseHint(phase: string, role?: string): string;
  /** Instrução extra para o veredito (texto livre vs por time vs síntese). */
  verdictKind: VerdictKind;
  /** Modificador para o user prompt do veredito do mediador (string vazia = padrão). */
  verdictPromptExtra: string;
};

/** Helper para empilhar comentaristas no fim de um bloco. */
export function pushCommentators(
  seq: Turn[],
  blockIndex: number,
  isFinal: boolean,
  cCount: number,
) {
  const label = isFinal ? "comentário final" : `comentário bloco ${blockIndex + 1}`;
  for (let c = 0; c < cCount; c++) {
    seq.push({
      speaker: c === 0 ? "c0" : "c1",
      phase: label,
      block_index: blockIndex,
    });
  }
}
