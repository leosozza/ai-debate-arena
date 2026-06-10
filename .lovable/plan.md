
# Plataforma de Debates Históricos — Plano Macro

Hoje o app só faz **Duelo 1×1** (`debates` tem `debater_a/b_*` fixos). Os 7 novos formatos exigem N participantes (até 8), papéis (defesa/acusação/juiz/entrevistador), e equipes. Isso é uma reformulação grande, então o plano é fatiado em 5 fases — cada uma é uma rodada de implementação aprovável separadamente.

---

## Fase 1 — Catálogo de personas (próxima rodada)

**Objetivo:** popular o banco com as ~60 personas listadas, públicas, organizadas por categoria, com biografia e prompt de IA. Fotos: 8 personas-âncora geradas agora; resto fica lazy (botão "gerar avatar" já existe via `persona-image.functions.ts`).

**Mudanças de schema** (uma migração):
- `personas.category` — text nullable, com índice (filtro na UI).
- (mantém `is_public`, `user_id` — seed roda como o seu usuário e marca `is_public=true`).

**Conteúdo do seed** (60 personas, agrupadas pelas 9 categorias que você listou). Para cada uma:
- `name`, `description` (1–2 frases jornalísticas), `category`,
- `persona_prompt` (~120–180 palavras: voz, tom, ideologia, época, vocabulário, "como debate" — derivado de obras/discursos reais),
- `is_public: true`,
- `image_url: null` por padrão.

**Script de seed**: `scripts/seed-personas.ts` rodável via `bun run`, idempotente (upsert por `name + user_id`). Recebe seu `user_id` por env.

**Fotos âncora (8)**: gerar com `imagegen` em `src/assets/personas/`, estilo retrato uniforme ("retrato pintura óleo, fundo escuro neutro, iluminação dramática, square 1024"). Sugestão de quem ganha foto pronta: Sócrates, Einstein, Marx, Adam Smith, Jesus, Pelé, Napoleão, Elon Musk (1 por categoria).

**UI**: tela `/personas` ganha filtro por categoria (chips no topo) e seção "Catálogo público" separada das "Minhas personas".

---

## Fase 2 — Schema multi-participante + Formatos novos (base)

**Objetivo:** permitir que um debate tenha N participantes com papéis, sem quebrar os debates 1×1 existentes.

**Migração**:
- Nova tabela `debate_participants` (`debate_id`, `persona_id`, `slot` int, `role` enum: `debater | moderator | judge | prosecutor | defender | interviewer | team_a | team_b`, `display_name`, `image_url`, `voice_provider`, `voice_id`).
- `debates.format` enum: `duel | roundtable | presidential | tribunal | interview | era_clash | sages_council | ideas_war | century_problem` (default `duel` para retrocompat).
- Campos `debater_a_*` / `debater_b_*` ficam como cache do formato `duel`; novos formatos só usam `debate_participants`.

**Backend (`debate.functions.ts`)**:
- `generateBlock` recebe `format` + lista de participantes e despacha para um prompt-builder por formato. Cada formato vira um pequeno módulo (`src/lib/formats/{duel,roundtable,tribunal,...}.ts`) que define: ordem de fala, número de blocos, regras de réplica, e o prompt do moderador.

**Apresentação (`presentation.$id.tsx`)**:
- Generaliza o stage atual (hoje fixo A/B) para grid dinâmico de N participantes destacando quem fala. Reaproveita `DebaterIntroCard` para o card de abertura (já side-by-side; vira layout N-up).

**Fluxo de criação (`/new`)**:
- Seletor de **Formato** vem antes da escolha de personas, e define quantos slots aparecem e quais papéis precisam ser preenchidos (ex.: Tribunal pede 1 réu + ≥1 acusador + ≥1 defensor + ≥1 juiz).

---

## Fase 3 — Implementação dos 7 formatos

Um por vez, na ordem de menor → maior risco:

1. **Mesa Redonda (3–6)** — extensão direta do 1×1: mais slots, mediador faz pergunta, cada um responde, depois "debate aberto" (2 rodadas livres).
2. **Conselho dos Sábios** — variação reflexiva da mesa redonda, tom "respeitoso", sem ataques diretos.
3. **Entrevista Impossível** — 1 entrevistador (pode ser o próprio mediador com persona customizável) + 1 entrevistado. Blocos = perguntas temáticas.
4. **Debate Entre Eras** — 1×1 com flag "histórico vs contemporâneo" → afeta só os prompts (contextualização extra), reusa engine de duel.
5. **Tribunal da História** — 1 réu + N acusadores + N defensores + N juízes. Estrutura fixa: acusação → defesa → perguntas dos juízes → veredito coletivo.
6. **Debate Presidencial (4–8)** — tempo de fala, direito de resposta, réplica, tréplica. Engine de turnos com "interrupções controladas".
7. **Guerra das Ideias (equipes)** — Time A vs Time B; cada bloco alterna qual time abre; veredito por equipe.

Cada formato entrega: prompt-builder + tela de criação + render de stage + integração com export MP4 (Fase 5).

---

## Fase 4 — Disclaimer obrigatório

- Componente `<AIDisclaimer />` com o texto exato que você passou.
- **Card inicial do programa** (1ª tela do MP4 e da apresentação) — fundo escuro, logo do app, texto centralizado, dura ~4 s ou até toque. Adicionado no `presentation.$id.tsx` antes do `DebaterIntroCard` e em `video-export.ts` como primeiro frame.
- **Rodapé fixo** discreto na apresentação ao vivo e na tela de criação ("Conteúdo gerado por IA — não são citações reais").
- Também incluído por padrão no início dos textos exportados (roteiro, descrição YouTube/TikTok/Instagram).

---

## Fase 5 — Exportações estendidas

Reaproveita o pipeline de `video-export.ts` e o roteiro já estruturado:

- **Roteiro completo** — markdown/.txt, com timestamps por bloco.
- **Narração por participante** — zip de mp3s separados (já temos TTS por persona; só agrupar).
- **Shorts (9:16, ≤60 s)** — picker de "melhor trecho" (LLM seleciona 1 turno de impacto) + render vertical no `video-export`.
- **Legendas (.srt / .vtt)** — gerar a partir dos timings dos áudios TTS já existentes.
- **Texto para YouTube** — título + descrição com timestamps + tags + disclaimer.
- **Texto para TikTok / Instagram** — caption curta + hashtags, gerada por LLM com base no tema/personas.

Tudo numa tela única "Exportar" depois do veredito, com checkboxes do que quer.

---

## Detalhes técnicos resumidos

**Stack:** TanStack Start + Supabase (Lovable Cloud). Tudo via `createServerFn` em `*.functions.ts`, RLS pra `debate_participants` espelhando a de `debates`. Catálogo de personas continua usando a policy pública existente.

**Sem mudar agora:** sistema de TTS, modelos de IA, autenticação, integração de imagem de persona, fluxo de aprovação por turno.

**Onde nada quebra:** debates antigos ficam com `format='duel'` e continuam usando `debater_a/b_*`. Renderização nova só ativa para `format != 'duel'`.

---

## Próximos passos

Se aprovar o macro, começo pela **Fase 1** (migração `category` + script de seed das 60 personas + 8 fotos âncora + filtro por categoria em `/personas`). Cada fase seguinte volta com seu próprio plano enxuto antes de implementar.
