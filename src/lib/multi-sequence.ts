// Pure helpers compartilhados entre cliente e servidor para calcular o
// tamanho da sequência de falas em formatos multi-participante. Não importa
// nada de server-only — pode ser consumido em loaders, componentes e SSE.

type Role = string;
type Slim = { slot: number; role: Role };

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

  if (formatId === "interview") {
    const interviewer = parts.find((p) => p.role === "interviewer") ?? parts[0];
    const guests = parts.filter((p) => p.slot !== interviewer.slot).length;
    // por bloco: vinheta + (pergunta + resposta) × guests + comentários; último bloco +1 veredito
    return b * (1 + guests * 2 + c) + 1;
  }

  if (formatId === "tribunal") {
    const pros = parts.filter((p) => p.role === "prosecutor").length;
    const def = parts.filter((p) => p.role === "defender").length;
    const judges = parts.filter((p) => p.role === "judge").length;
    const accused = parts.filter((p) => p.role === "debater" || p.role === "interviewee").length;
    // abertura + acusações + defesas do réu + defesas + interrogatórios + comentários + veredito
    return 1 + pros + accused + def + judges + c + 1;
  }

  // round-robin: blocos intermediários (vinheta + N abertura + N×rounds réplica + comentários)
  // bloco final (vinheta + N considerações + comentários + veredito)
  const inter = (b - 1) * (1 + n + rounds * n + c);
  const final = 1 + n + c + 1;
  return inter + final;
}
