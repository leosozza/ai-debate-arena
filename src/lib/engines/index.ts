// Registry de engines por formato. Client-safe: usado tanto pelo motor
// server-side (multi-debate) quanto pelo cálculo isomórfico de progresso
// (multi-sequence). Sem efeitos colaterais nem imports server-only.

import type { FormatEngine } from "./types";
import { roundtableEngine } from "./roundtable";
import { presidentialEngine } from "./presidential";
import { eraClashEngine } from "./era-clash";
import { sagesCouncilEngine } from "./sages-council";
import { ideasWarEngine } from "./ideas-war";
import { centuryProblemEngine } from "./century-problem";
import { interviewEngine } from "./interview";
import { tribunalEngine } from "./tribunal";
import { duelFallbackEngine } from "./duel-fallback";

const REGISTRY: Record<string, FormatEngine> = {
  roundtable: roundtableEngine,
  presidential: presidentialEngine,
  era_clash: eraClashEngine,
  sages_council: sagesCouncilEngine,
  ideas_war: ideasWarEngine,
  century_problem: centuryProblemEngine,
  interview: interviewEngine,
  tribunal: tribunalEngine,
  duel: duelFallbackEngine,
};

/** Devolve a engine do formato. Cai no fallback se o id for desconhecido. */
export function getEngine(formatId: string): FormatEngine {
  return REGISTRY[formatId] ?? duelFallbackEngine;
}

export type { FormatEngine, Turn, Participant, Slim, SpeakerKind, VerdictKind } from "./types";
