## O que vou fazer

Transformar o debate em **programa de TV com múltiplos blocos**, cada bloco com seu próprio sub-tema gerado pela IA. Hoje é uma sessão única: abertura → réplicas 1..N → considerações finais → veredito. Vou colocar isso **dentro de cada bloco**, e o veredito acontece só no fim do último bloco.

### Estrutura nova de um debate

```text
Tema principal: "Inteligência artificial vai substituir programadores?"

▸ BLOCO 1/4 — "Impacto no mercado de trabalho hoje"
   mediador: vinheta + apresenta o sub-tema
   A: posição    B: posição
   A: réplica    B: réplica   (× rounds)

▸ BLOCO 2/4 — "Qualidade do código gerado"
   ... mesmo formato ...

▸ BLOCO 3/4 — "Criatividade e arquitetura"
▸ BLOCO 4/4 — "Considerações finais e veredito"
   A: fechamento  B: fechamento
   mediador: veredito
```

Com 3-5 blocos × (1 vinheta + 2 aberturas + 2×rounds réplicas) ≈ 20-30 min de áudio.

### 1. Migration

Adicionar em `debates`:
- `blocks_count int not null default 4` (2-6)
- `block_subtopics jsonb` (array gerado pela IA: `[{title, focus}]`, cacheado na 1ª geração)

Adicionar em `debate_messages`:
- `block_index int not null default 0` (qual bloco é a fala)

Sem CHECK; defaults preservam debates existentes (tudo cai no bloco 0).

### 2. Geração das falas (`src/lib/debate.functions.ts`)

- Novo helper `generateBlockSubtopics(debate)`: chama Lovable AI para produzir N sub-temas curtos a partir do tema principal, salva em `debates.block_subtopics`. Roda **na 1ª chamada de `generateNextMessage`** se ainda for null.
- Reescrever `fixedSeq`/`fixedSeqLength` para gerar a sequência **bloco por bloco**:
  ```
  para cada bloco b em 0..N-1:
    moderator/vinheta (phase="vinheta bloco b+1")
    a/abertura, b/abertura
    a/réplica r, b/réplica r   (r = 1..rounds)
  bloco final adiciona:
    a/considerações finais, b/considerações finais
    moderator/veredito
  ```
- `block_index` é calculado a partir do índice na sequência e gravado em cada mensagem.
- O prompt do gerador inclui o **sub-tema do bloco atual** ("Foque exclusivamente em: <subtopic>") + o tema principal como contexto. Mediador na vinheta apresenta o bloco em 1-2 frases.
- `dynamic_flow` segue funcionando, mas restrito ao bloco atual (o mediador só pode escolher A ou B até completarem `rounds` réplicas do bloco; depois força transição pro próximo).

### 3. Form de criação (`/new`)

- Novo campo "Blocos" (slider 2-6, default 4) ao lado de "Rodadas". UI mostra estimativa: `~ blocos × (3 + rounds×2) × 30s`.
- `createDebate` recebe `blocksCount`.

### 4. Form de edição (`/edit`)

- Mesmo campo "Blocos". `updateDebate` aceita só se ainda não houver falas geradas (caso contrário, bloqueia com hint "apague as falas para mudar a estrutura").

### 5. Página do debate (`/debates/$id`)

- Agrupar as falas por `block_index` na timeline: card `BLOCO 1 — <subtopic>` com as falas dentro. Sem mudar lógica de geração — só apresentação.

### 6. Modo apresentação (`/debates/$id/present`)

- Detectar mudança de `block_index` entre fala atual e próxima. Quando vai mudar:
  - Exibir **cartela full-screen animada** ("BLOCO 2 DE 4 — <subtopic>") por ~3s, com efeito de entrada estilo programa de TV (faixa diagonal + número grande + subtema).
  - Depois toca normal a próxima fala (que é o mediador apresentando o bloco).
- Header do present mostra agora: `Tema · Bloco 2/4 — <subtopic>`.
- Mini-timeline de bolinhas vira **agrupada por bloco** (separadores verticais entre blocos).

### Detalhes técnicos

- Cartela = novo componente `<BlockIntroCard block, total, subtopic, onDone />` em `src/components/BlockIntroCard.tsx` — usa motion, auto-dismiss após 2.8s, pode pular com click.
- A geração de sub-temas usa o mesmo `chatComplete` que `generateSynopsis` já usa, modelo `google/gemini-3-flash-preview`, JSON estrito `{ subtopics: [{title, focus}] }`.
- Se a geração falhar, fallback: `["Parte 1", "Parte 2", ...]` (não quebra o debate).
- `verdict` continua só no fim; veredito leva em conta toda a transcrição (já é assim).

### Arquivos

**Novo:**
- `src/components/BlockIntroCard.tsx`
- `supabase/migrations/<ts>_debate_blocks.sql`

**Editado:**
- `src/lib/debate.functions.ts` — geração de sub-temas, nova `fixedSeq` com blocos, prompts com sub-tema, gravar `block_index`, validação em `updateDebate`.
- `src/routes/_authenticated/new.tsx` — slider de blocos.
- `src/routes/_authenticated/debates.$id.edit.tsx` — slider de blocos.
- `src/routes/_authenticated/debates.$id.tsx` — agrupamento visual por bloco.
- `src/routes/_authenticated/debates.$id.present.tsx` — cartela de bloco + header com sub-tema + timeline agrupada.

### Fora do escopo

- Não vou mexer no layout "TV" das laterais do present (mediador no topo, A esquerda, B direita) — isso ficou pendente da rodada anterior e não é o que você pediu agora. Avisa se quiser que eu encaixe junto.
- Não vou re-gerar debates já existentes; eles continuam como bloco único (0).
