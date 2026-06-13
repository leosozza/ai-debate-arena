## Problema

O debate `5ec60ae8…` está em formato **Mesa Redonda** com 5 debatedores (Jesus, Buda, Dalai Lama, Confúcio, Lao‑Tsé) — confirmado em `debates.format='roundtable'` e 3 linhas em `debate_participants` (slots 2/3/4). O engine multi‑participante já gerou 40 mensagens com roles `a`, `b`, `ex2`, `ex3`, `ex4`. A UI, porém, continua tratando como duelo:

- **`debates.$id.tsx`** rotula os dois primeiros como "Lado A / Lado B", aplica cores `side-a` / `side-b` e mostra o placar binário A×B (Scoreboard).
- **`presentation.$id.tsx`** (Modo Apresentação): cabeçalho com ícone `Swords`, palco fixo em 2 colunas A `VS` B (`StageDebaterPanel side="a"|"b"`), VoicePicker só de A/B, vinheta `OpeningVignette` só com A/B, `ClosingCard` só com A/B, glow/badge "IA A/B".
- **Veredito**: `generateVerdict` retorna `winner: a|b|empate` + `scoreA/scoreB` — impossível ranquear N participantes.

## Escopo aprovado

Tudo: tela de detalhe + Modo Apresentação + veredito multi‑participante.

## Mudanças

### 1) `src/routes/_authenticated/debates.$id.tsx`

- Construir uma lista única `speakers[]` (a, b, ex2…exN) a partir de `debate` + `extras`, com `displayRoleLabel` vindo de `getFormat(format).fixedRoles` quando aplicável (Acusação/Defesa/Réu/Jurado/Entrevistador/Entrevistado) e caindo em "Convidado N" para `roundtable` / `presidential` / `era_clash` / `sages_council` / `ideas_war` / `century_problem`.
- Substituir as cores fixas `side-a` / `side-b` por uma paleta indexada por slot (já existe `PALETTE` em `roleColor`); aplicar a mesma paleta ao `CastStrip` (hoje só A/B usam `accent: "side-a|b"` e o restante `"accent"`).
- Esconder o botão **"Veredito + placar"** e o componente `Scoreboard` quando `format !== "duel"`, exibindo no lugar `MultiScoreboard` (novo, ver item 3).

### 2) `src/routes/_authenticated/presentation.$id.tsx`

- Reusar o mesmo `speakers[]` (a, b, ex2…exN). Render condicional pelo formato:
  - **Duel (atual)**: mantém o palco 2‑col `A VS B` e `Swords`.
  - **Não‑duel**: novo `MultiStage` que:
    - mostra **um único painel grande de quem fala agora** (avatar + Teleprompter + VoiceWave) — substitui a régua VS, e absorve o overlay `extraSpeaker` que hoje fica flutuando sobre o palco;
    - mostra **strip inferior com todos os participantes em miniatura** (HologramAvatar pequeno, nome, "falando agora" destacado);
    - troca o ícone `Swords` por um ícone neutro (`Users` ou o emoji do formato vindo de `getFormat`).
  - `OpeningVignette` recebe `participants[]` ao invés de `aName/bName` (apresenta os N nomes).
  - `ClosingCard` recebe `winners[]` (top‑3) ao invés de `a/b` no formato não‑duelo.
- `VoicePicker` em Settings: gerar dinamicamente um picker por participante (Mediador + A + B + cada `extra`). Persistir os extras em `debate_participants.voice_provider/voice_id` via novo `setParticipantVoice` server fn (já existe coluna).
- Manter o `prepTasks` cobrindo vinhetas dos N debatedores (não só A/B).

### 3) Veredito multi‑participante

- Novo tipo `MultiVerdict` em `src/lib/debate.functions.ts`:
  ```ts
  type MultiVerdict = {
    ranking: Array<{ key: "a"|"b"|`ex${number}`; name: string; score: number }>;
    criteria: Array<{ name: string; weight?: number; scores: Record<string, number> }>;
    summary: string;
    mvp_quote?: string;
  };
  ```
- Novo server fn `generateMultiVerdict({ debateId })` — espelha `generateVerdict`, mas o prompt pede notas por participante (lista derivada de `debate_participants`) e o pós‑processamento monta `ranking[]` ordenado.
- Persistir em uma coluna nova `debates.verdict_multi jsonb` (migration). O `verdict` atual fica intocado para retrocompatibilidade dos duelos.
- Novo componente `MultiScoreboard` (em `src/components/MultiScoreboard.tsx`) com barras horizontais ordenadas por score, medalha 🥇🥈🥉 nos três primeiros, e tabela de critérios N‑colunas.
- `debates.$id.tsx` decide qual gerar/exibir pelo `format`.

### 4) Limpezas pequenas

- `roleTone(role, slot)` (já existe) passa a ser a fonte de verdade do tom do holograma — remover usos diretos de "blue/gold" presos a A/B fora dela.
- `CastStrip`: aceitar `accent: "palette"` com índice de slot, mapeando para as 5 cores já definidas (`side-a`, `side-b`, `chart-4`, `chart-5`, `primary`).

## Migration

```sql
ALTER TABLE public.debates ADD COLUMN IF NOT EXISTS verdict_multi jsonb;
```
(Sem novas policies/grants — herda as da tabela.)

## Fora de escopo (proponho para depois)

- Reescrever o engine de geração (já está OK — mensagens com role `ex<slot>` chegam corretas).
- Refazer `ExportVideoButton` / `ExportPackDialog` para N participantes — hoje exportam A×B; manter como está e abrir issue separada.
- Edit page (`debates.$id.edit.tsx`) — já permite gerenciar `debate_participants`; nada a mudar aqui agora.

## Validação após implementar

1. Abrir `/debates/5ec60ae8-04fd-423e-94c1-d409396a9f4a`: cast strip mostra 5 nomes com 5 cores distintas, sem rótulos "Lado A/B"; botão "Veredito + placar" gera `MultiScoreboard` com 5 linhas ordenadas.
2. Abrir `🎬 Modo apresentação`: palco mostra 1 falante por vez (Jesus → Buda → Dalai Lama → Confúcio → Lao‑Tsé), strip inferior com os 5; Settings tem 6 VoicePickers (mediador + 5).
3. Conferir que um debate antigo em `format='duel'` continua idêntico (palco A×B, Scoreboard binário).
