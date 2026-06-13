## Objetivo

Substituir o fallback round-robin único por **engines próprias** para cada formato que ainda compartilha pipeline genérico. Cada engine define: (1) sequência de turnos, (2) tom e prompts do mediador, (3) hints específicos por papel/fala, (4) formato do veredito. `duel`, `interview` e `tribunal` já têm comportamento próprio — vamos formalizá-los no mesmo padrão e criar os 6 que faltam.

## Formatos sem engine própria hoje

| Formato | Característica que precisa virar engine |
|---|---|
| `roundtable` | Mesa de TV: mediador provoca, todos respondem, contra-pontos cruzados, sem combate frontal. |
| `presidential` | Pergunta cronometrada → resposta → direito de réplica do citado (não round-robin cego). |
| `era_clash` | 2 personagens, mas mediador enquadra "choque de mundos" (passado vs presente) toda fala. |
| `sages_council` | Sem combate: cada fala constrói sobre a anterior, mediador busca síntese, veredito = síntese coletiva. |
| `ideas_war` | Times A/B: abertura por time, réplica alternada entre times, veredito **por time** (não individual). |
| `century_problem` | Colaboração: mediador apresenta problema, cada época propõe ângulo, "veredito" = solução combinada. |

## Arquitetura

Criar `src/lib/engines/` com **um arquivo por formato** + um `index.ts` que registra. Cada engine exporta:

```ts
type FormatEngine = {
  id: DebateFormatId;
  /** Sequência determinística (turnos × blocos). */
  buildSequence(parts: Participant[], blocks: number, rounds: number, cCount: number): Turn[];
  /** Conta turnos sem montar o array (otimização do progresso na UI). */
  sequenceLength(parts: Slim[], blocks: number, rounds: number, cCount: number): number;
  /** Tom/persona do mediador, injetado no system prompt. */
  moderatorTone: string;
  /** Prompts por fase. Recebe contexto e devolve {system, user}. */
  buildPrompt(ctx: PromptContext): { system: string; user: string };
  /** Formato do veredito (texto livre vs por time vs síntese). */
  verdictKind: "individual" | "team" | "synthesis";
};
```

`multi-debate.functions.ts` vira fino: escolhe a engine pelo `debate.format` e delega. `multi-sequence.ts` também consulta `engine.sequenceLength` em vez de ter switch interno.

## Detalhe por engine

**`roundtable`** — vinheta → mediador provoca pergunta → cada convidado responde 1×, depois 1 round de réplica cruzada (mediador escolhe quem responde a quem se `dynamic_flow`). Veredito individual: quem brilhou.

**`presidential`** — vinheta → mediador faz pergunta a candidato X → resposta (90s) → candidato Y citado tem direito de réplica (60s) → mediador passa próximo. Réplica é gatilhada por menção, não rodízio. Veredito: ranking dos candidatos.

**`era_clash`** — herda duel, mas todo prompt injeta "você fala de [séc XVIII] / [séc XXI]". Mediador faz transições contextualizando o choque temporal. Veredito: qual visão envelheceu melhor.

**`sages_council`** — sem "abertura/réplica". Cada turno é "contribuição" que **deve referenciar** o sábio anterior. Mediador faz síntese a cada 2 contribuições. Veredito: síntese coletiva (3-4 parágrafos do mediador).

**`ideas_war`** — agrupa parts por `team` (A/B). Abertura do time A → abertura do time B → réplica A → réplica B (alternado por time, não por slot). Veredito: pontuação por time + MVP por time.

**`century_problem`** — mediador apresenta um problema atual. Cada personagem propõe ângulo da sua época (não rebate). Última rodada: cada um sugere uma ação. Veredito: solução combinada que junta os ângulos.

## Mudanças concretas

**Novos:**
- `src/lib/engines/types.ts` (FormatEngine, PromptContext, Turn)
- `src/lib/engines/roundtable.ts`
- `src/lib/engines/presidential.ts`
- `src/lib/engines/era-clash.ts`
- `src/lib/engines/sages-council.ts`
- `src/lib/engines/ideas-war.ts`
- `src/lib/engines/century-problem.ts`
- `src/lib/engines/interview.ts` (move o que já existe)
- `src/lib/engines/tribunal.ts` (move o que já existe)
- `src/lib/engines/index.ts` (registry + `getEngine(formatId)`)

**Editados:**
- `src/lib/multi-debate.functions.ts` — vira shell que carrega engine + executa
- `src/lib/multi-sequence.ts` — delega para `engine.sequenceLength`
- `src/lib/debate-formats.ts` — remover flag `isNew` dos 6 formatos
- `src/routes/_authenticated/presentation.$id.tsx` — suportar `verdictKind: team`/`synthesis` (card de veredito diferente)
- `src/components/MultiScoreboard.tsx` — se `team` agrupar por time

**Migração de banco:** `debates` já tem `verdict_multi jsonb`. Estender shape para `{ kind: "individual"|"team"|"synthesis", payload: ... }` sem migração — só interpretação no app. Manter compatibilidade lendo o legado.

## Fora de escopo

- Tempos cronometrados reais (presidencial fica com "tempo simbólico" via tamanho do prompt).
- Re-treinamento de personas existentes.
- UI específica de criação por formato (já feita na fase A).

## Perguntas

1. **Ordem de entrega**: (a) tudo de uma vez (6 engines + refactor), (b) por lote — primeiro `roundtable` + `presidential` (mais usados), depois `era_clash` + `sages_council`, por fim `ideas_war` + `century_problem`, ou (c) refator estrutural primeiro (mover interview/tribunal pro registry, sem novos formatos) e depois engines novas?
2. **Veredito de `ideas_war`**: pontuação por time **+ MVP individual** dos dois lados, ou só ranking de time (sem destaque individual)?
3. **Mediador em `sages_council`**: deve **participar** com sínteses intermediárias (a cada 2 falas), ou só abrir e fechar (mais silencioso, dando espaço aos sábios)?
4. **`century_problem`**: o "veredito" final é falado **pelo mediador** apresentando a solução combinada, ou cada personagem faz uma fala curta de fechamento contribuindo com sua parte da solução?
