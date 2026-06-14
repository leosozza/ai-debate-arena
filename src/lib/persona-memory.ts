// Memória de curto prazo por persona, derivada do transcript existente.
// Sem custo de IA — só regex + slice. Reduz contradições e cria callbacks
// naturais ("como eu disse antes...", "rebatendo o que X me acusou de...").

type Msg = { role: string; phase: string; content: string };

function lastSentences(text: string, n: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const parts = clean.split(/(?<=[.!?])\s+/).filter((s) => s.length > 8);
  return parts.slice(-n);
}

/**
 * Devolve um bloco para injetar no system prompt do próximo falante.
 * - "VOCÊ JÁ DISSE": 3 últimas frases das próprias falas.
 * - "DISSERAM SOBRE VOCÊ": 3 últimas frases de outros que citaram o nome.
 */
export function personaMemoryDigest(
  transcript: Msg[],
  selfRole: string,
  selfName: string,
): string {
  if (!selfRole || !selfName) return "";
  const own = transcript.filter((m) => m.role === selfRole);
  const ownSentences = own.flatMap((m) => lastSentences(m.content, 2)).slice(-3);

  const nameRx = new RegExp(
    selfName.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i",
  );
  const others = transcript.filter((m) => m.role !== selfRole && nameRx.test(m.content));
  const aboutSentences = others
    .flatMap((m) => lastSentences(m.content, 2).filter((s) => nameRx.test(s)))
    .slice(-3);

  const lines: string[] = [];
  if (ownSentences.length) {
    lines.push(`MEMÓRIA — você mesmo já disse: ${ownSentences.map((s) => `"${s}"`).join(" / ")}. Mantenha coerência; pode retomar ou aprofundar, evite contradizer-se.`);
  }
  if (aboutSentences.length) {
    lines.push(`MEMÓRIA — falaram sobre você: ${aboutSentences.map((s) => `"${s}"`).join(" / ")}. Considere responder ou rebater nominalmente.`);
  }
  return lines.length ? `\n\n${lines.join("\n")}` : "";
}
