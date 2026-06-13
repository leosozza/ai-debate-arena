# Plano — Persona com gênero, mediador, arenas e comentaristas

## 1. Gênero manual na persona (corrige voz dos extras)

**Banco** (migration): adicionar coluna `gender` em `public.personas` — `text check (gender in ('m','f') or gender is null)`, default `null`.

**UI** (`src/routes/_authenticated/personas.tsx`): no formulário de criar/editar persona, adicionar radio "Gênero" → Masculino / Feminino / Não definido. Salva via `updatePersona`/`createPersona`.

**Server** (`src/lib/persona.functions.ts`): aceitar `gender` nas duas server fns + retornar no `listPersonas`.

**Auto-seleção de voz** (`src/lib/persona-gender.ts` + `ExtraParticipantsPanel.tsx` + `new.tsx`):
- Nova função `personaGenderFrom(persona)` que primeiro lê `persona.gender` e só cai na heurística atual como fallback.
- Em `applyPersona` (A/B e extras): se voz da persona for `browser`/nula, usa `defaultVoiceForGender` com o gênero da persona.

## 2. Mediador — só ajustes visuais (catálogo já existe)

`src/routes/_authenticated/new.tsx`:
- Mover a seção "Mediador do programa" para **logo após o formato**, em destaque (hoje vem no fim, fácil de não notar).
- Adicionar emoji + voz-preview rápido no card (botão ▶ usa o `VoicePicker` já existente). Sem mudança no `mediators.ts`.

## 3. Arenas — 2 por formato (mantido)

Sem alteração. Já temos 18 cenários (2 × 9 formatos). Não vou criar arenas novas — confirma se quer fica nas 18 atuais, mas pelo seu "2 por formato" entendi que está OK como está.

## 4. Comentaristas em todos os formatos

**UI** (`src/routes/_authenticated/new.tsx`):
- Tirar o `form.format === "duel"` que esconde o card de comentaristas.
- Remover o `setCommentators([])` no `onClick` dos formatos não-duelo.

**Engine multi** (`src/lib/multi-debate.functions.ts`):
- Após cada `veredito` parcial OU ao final de cada `bloco` (último turno do bloco antes do próximo `vinheta`), se `debate.commentators?.length > 0` e `!dynamic_flow`, inserir 1-2 turnos `role="commentator_1"/"commentator_2"`, `phase="comentário bloco N"`.
- Reaproveita o mesmo padrão já usado em `generateNextTurn` do duelo (procurar no código atual o `commentator_*` para reusar o helper de prompt; se não houver helper, espelhar o prompt do duelo).
- Atualizar `buildSequence` para inserir os slots de comentaristas entre blocos.

## Ordem de execução
1. Migration `gender` em personas (pede aprovação).
2. Após aprovação, atualizar server fns + UI da persona + auto-voz.
3. UI do mediador em destaque.
4. Comentaristas em multi (UI + engine).

## Fora de escopo (não vou mexer)
- Refactor A/B → painel único por formato.
- Criar arenas novas.
- IA inferindo gênero automaticamente.
