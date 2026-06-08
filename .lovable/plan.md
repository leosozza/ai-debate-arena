## O que vou fazer

### 1. Voz por persona (salva)
- Migration: adicionar em `personas` as colunas `voice_provider` (`browser|eleven|minimax`), `voice_id` (texto). Mesma coisa em `debates` para Mediador, A e B (`voice_provider_*`, `voice_id_*`).
- Formulário de persona (`/personas`): novo bloco "Voz" com seletor de provedor + dropdown de vozes (catálogo MiniMax/ElevenLabs; para "Navegador" salva só o nome da voz do SO).
- Server fns `createPersona`/`updatePersona`: aceitar os novos campos.

### 2. Voz no debate (sobrescreve a da persona)
- Em `/new`: novo card "Vozes" com 3 linhas (Mediador, A, B) — provedor + voz. Ao carregar uma persona via dropdown, pré-preenche com a voz dela.
- `createDebate` passa esses campos.
- No modo apresentação, a voz por padrão vem do debate (que veio da persona); painel ⚙️ continua existindo só para override em tempo real.

### 3. Editar debate (só metadados)
- Nova rota `/_authenticated/debates.$id.edit.tsx`: edita tema, nomes/personas A e B, modelos, tom e vozes. Não mexe em falas geradas.
- Server fn `updateDebate` (mesmo padrão de `updatePersona`).
- Botão "Editar" na página `/debates/$id` (ao lado de "Modo apresentação").

### 4. Nova página de intro da arena
- Nova rota `/_authenticated/debates.$id.arena.tsx` — "Arena de Batalha":
  - Fundo animado (já existe `ArenaBackground`), tema em destaque grande, sinopse curta (gerada por IA on-demand e cacheada na coluna `synopsis` de `debates`).
  - Card dos 2 debatedores com cor de lado, nome, 1 linha da persona e badge da voz selecionada.
  - Animação de entrada (fade/scale escalonado) + CTA "Iniciar apresentação" → navega para `/debates/$id/present`.
- Botão "🎬 Modo apresentação" em `/debates/$id` passa a apontar para `/arena` (a intro), que por sua vez leva ao `/present`.
- Nova server fn `generateSynopsis` (usa `chatComplete`, salva em `debates.synopsis`).

### Detalhes técnicos
- **Migration única**: adiciona em `personas`: `voice_provider text`, `voice_id text`; em `debates`: `voice_provider_mod/a/b text`, `voice_id_mod/a/b text`, `synopsis text`. Sem CHECK; valores default `NULL`. Tipos regenerados após apply.
- **Catálogo compartilhado**: novo `src/lib/voice-catalog.ts` exporta `BROWSER` (placeholder), `ELEVEN`, `MINIMAX` para reutilizar nos pickers de persona/debate/edit/present.
- **Componente `<VoicePicker>`** (`src/components/VoicePicker.tsx`) — UI única (provedor + voz) usada nos 4 lugares.
- **Present mode**: ao montar, se `debate.voice_provider_*` existir, usa-os como default; mantém o painel ⚙️ para override de sessão (não persiste).
- **Sinopse**: gerada sob demanda na primeira visita à arena se `synopsis` for null; loading com shimmer.

### Arquivos novos
- `supabase/migrations/<ts>_voices_and_synopsis.sql`
- `src/lib/voice-catalog.ts`
- `src/components/VoicePicker.tsx`
- `src/routes/_authenticated/debates.$id.edit.tsx`
- `src/routes/_authenticated/debates.$id.arena.tsx`

### Arquivos editados
- `src/lib/persona.functions.ts` — campos de voz em create/update + select
- `src/lib/debate.functions.ts` — campos de voz em create + novo `updateDebate` + `generateSynopsis`
- `src/routes/_authenticated/personas.tsx` — `<VoicePicker>` no form
- `src/routes/_authenticated/new.tsx` — card "Vozes" + pré-fill ao carregar persona
- `src/routes/_authenticated/debates.$id.tsx` — botão Editar; "Modo apresentação" → `/arena`
- `src/routes/_authenticated/debates.$id.present.tsx` — defaults vindos do debate

### Fora do escopo
- Editar falas já geradas (você escolheu "só metadados").
- Mudar player/streaming do present (não foi pedido nesta rodada).
