// Pure helpers compartilhados entre cliente e servidor para calcular o
// tamanho da sequência de falas em formatos multi-participante. Delega para
// a engine do formato em src/lib/engines, garantindo que UI e servidor
// concordem sobre o total de turnos.

import { getEngine } from "./engines";

type Slim = { slot: number; role: string; team?: string | null };

export function multiSequenceLength(
  formatId: string,
  parts: Slim[],
  blocks: number,
  rounds: number,
  commentators: number = 0,
): number {
  const n = parts.length;
  if (n < 2) return 0;
  const b = Math.max(1, blocks);
  const c = Math.max(0, Math.min(2, commentators));
  return getEngine(formatId).sequenceLength(parts, b, rounds, c);
}
