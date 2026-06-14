// Estilo por fase: tamanho máximo, ritmo, pausas. Usado pelo prompt builder
// (define o "Máximo N palavras") e pelos wrappers de TTS (ritmo / SSML).
// Client-safe — sem imports server-only.

export type Pace = "slow" | "medium" | "fast";

export type PhaseStyle = {
  /** Limite de palavras para o gerador de texto. */
  maxWords: number;
  /** Ritmo lógico — mapeado para SSML rate e para speed do MiniMax. */
  pace: Pace;
  /** Pausa em ms a injetar após pontos finais / travessões. */
  pauseMs: number;
};

const DEFAULT: PhaseStyle = { maxWords: 150, pace: "medium", pauseMs: 350 };

function match(phase: string, ...keys: string[]) {
  const p = phase.toLowerCase();
  return keys.some((k) => p.includes(k));
}

/** Devolve o estilo para uma fase. role = "moderator" | persona role. */
export function styleForPhase(phase: string, role?: string): PhaseStyle {
  // Mediador
  if (role === "moderator") {
    if (match(phase, "veredito")) return { maxWords: 200, pace: "slow", pauseMs: 600 };
    if (match(phase, "abertura")) return { maxWords: 130, pace: "medium", pauseMs: 350 };
    if (match(phase, "vinheta")) return { maxWords: 70, pace: "medium", pauseMs: 300 };
    if (match(phase, "pergunta-incisiva")) return { maxWords: 50, pace: "fast", pauseMs: 200 };
    if (match(phase, "síntese")) return { maxWords: 70, pace: "medium", pauseMs: 400 };
    if (match(phase, "pergunta")) return { maxWords: 60, pace: "medium", pauseMs: 250 };
    if (match(phase, "reviravolta")) return { maxWords: 70, pace: "medium", pauseMs: 400 };
    return DEFAULT;
  }
  // Comentaristas
  if (role === "c0" || role === "c1" || match(phase, "comentário")) {
    return { maxWords: 80, pace: "medium", pauseMs: 300 };
  }
  // Tribunal
  if (role === "prosecutor" || role === "defender") return { maxWords: 170, pace: "medium", pauseMs: 400 };
  if (role === "judge") return { maxWords: 110, pace: "medium", pauseMs: 350 };
  // Entrevista
  if (role === "interviewer" || match(phase, "pergunta")) return { maxWords: 60, pace: "fast", pauseMs: 200 };
  if (role === "interviewee" || match(phase, "resposta")) return { maxWords: 170, pace: "medium", pauseMs: 350 };
  // Personas — por fase
  if (match(phase, "considerações finais")) return { maxWords: 70, pace: "slow", pauseMs: 500 };
  if (match(phase, "fechamento")) return { maxWords: 35, pace: "slow", pauseMs: 600 };
  if (match(phase, "réplica")) return { maxWords: 90, pace: "fast", pauseMs: 250 };
  if (match(phase, "ação")) return { maxWords: 80, pace: "medium", pauseMs: 300 };
  if (match(phase, "ângulo") || match(phase, "contribuição")) return { maxWords: 130, pace: "medium", pauseMs: 400 };
  if (match(phase, "abertura")) return { maxWords: 130, pace: "medium", pauseMs: 350 };
  if (match(phase, "acusação")) return { maxWords: 170, pace: "medium", pauseMs: 400 };
  if (match(phase, "defesa")) return { maxWords: 170, pace: "medium", pauseMs: 400 };
  return DEFAULT;
}

/** Multiplicador de speed para o MiniMax (1.0 = neutro). */
export function paceToSpeed(pace: Pace): number {
  return pace === "fast" ? 1.08 : pace === "slow" ? 0.92 : 1.0;
}

/** rate SSML correspondente (ElevenLabs). */
export function paceToSsmlRate(pace: Pace): string {
  return pace === "fast" ? "fast" : pace === "slow" ? "slow" : "medium";
}
