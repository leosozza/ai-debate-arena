## Objetivo
1. Botão **Salvar voz** que persiste a escolha (provedor + 3 vozes) no debate — tanto no painel ⚙️ da Apresentação quanto na página Editar (que já salva).
2. **Clonagem de voz** vinculada à Persona: upload de áudio (ex.: do Eneas) → ElevenLabs IVC (com fallback MiniMax) → a voz clonada vira a voz padrão dessa persona em qualquer debate.
3. Suporte a **colar Voice ID manual** como último recurso quando upload falhar (ou o usuário já tiver clonado fora).

---

## Backend

### Migration
Adicionar duas colunas em `personas` para registrar a origem da voz clonada (UX e auditoria; sintese continua via `voice_provider`/`voice_id`):
- `voice_clone_source` (text, nullable) — `'upload-eleven' | 'upload-minimax' | 'manual'`
- `voice_clone_name` (text, nullable) — rótulo amigável

### Server functions novas (`src/lib/voice-clone.functions.ts`)
- `cloneVoiceEleven({ formData: FormData })` — input `FormData` com `name` + 1..N `files` (mp3/wav/m4a, ≤ ~10 MB cada, ≤ 25 MB total). Chama `POST https://api.elevenlabs.io/v1/voices/add` com `xi-api-key`. Retorna `{ voiceId, name }`. Trata 401/402/422 com mensagens claras (sem plano, créditos, áudio inválido).
- `cloneVoiceMinimax({ formData })` — fallback: faz upload em `https://api.minimax.io/v1/files/upload` (purpose `voice_clone`) e depois `POST /v1/voice_clone` com `file_id`, retornando `voice_id`. Mesmo tratamento de erro.
- `attachVoiceToPersona({ personaId, provider, voiceId, source, cloneName? })` — chama `updatePersona` por baixo (RLS já garante dono). Atualiza `voice_provider`, `voice_id`, `voice_clone_source`, `voice_clone_name`.

`createServerFn` suporta `FormData` no `inputValidator`; usar `data instanceof FormData` e mapear.

### Server function existente reutilizada
- `updateDebate` (já existe em `debate.functions.ts`) — usado pelo botão Salvar voz na Apresentação para gravar `voice_provider_{mod,a,b}` e `voice_id_{mod,a,b}`.

---

## Frontend

### Personas (`src/routes/_authenticated/personas.tsx`)
Nova seção **"Clonar voz"** dentro do formulário da persona, abaixo do `VoicePicker`:
- Input `<input type="file" accept="audio/*" multiple>` — pré-visualiza nomes + tamanhos (limite client-side 25 MB total).
- Campo `Rótulo` (auto-preenchido com nome da persona).
- Botão **"Clonar com ElevenLabs"** → tenta `cloneVoiceEleven`. Em falha (sem plano/créditos), oferece botão **"Tentar MiniMax"** que chama `cloneVoiceMinimax`.
- Sucesso → atualiza `form.voice_provider`/`form.voice_id` automaticamente e chama `attachVoiceToPersona` (se editando) ou apenas pré-preenche (se criando — salva no submit normal).
- Linha de "Voz personalizada (Voice ID manual)": dropdown de provedor + input texto + botão Aplicar. Útil para colar um ID criado fora.
- Indicador visual quando a persona já tem voz clonada: badge "🎙 Clonada (ElevenLabs)" ou similar usando `voice_clone_source`.

### Apresentação — painel ⚙️ (`src/routes/_authenticated/presentation.$id.tsx`)
Abaixo da lista de vozes, adicionar:
- Botão **"💾 Salvar essas vozes no debate"** — envia `updateDebate` com o provedor ativo + IDs ativos de mediador/A/B; mostra toast "Voz padrão deste debate atualizada".
- Texto auxiliar: "Aplica em próximas reproduções e fica gravado para todos."

### Editar debate (`debates.$id.edit.tsx`)
Já tem `VoicePicker` + Salvar. Adicionar:
- Botão atalho **"Clonar nova voz"** ao lado de cada `VoicePicker` que abre modal (Dialog do shadcn) com o mesmo fluxo de upload da página de personas, mas grava direto nos campos `voice_provider_{a|b|mod}` do form local (sem mexer em persona). Salva ao clicar Salvar do form.

---

## Segurança e limites
- Server functions ficam atrás de `requireSupabaseAuth`.
- Validar `FormData`: máx 6 arquivos, cada um ≤ 12 MB, mime começa com `audio/`.
- Nunca expor `ELEVENLABS_API_KEY` / `MINIMAX_API_KEY` ao cliente — secrets já existem.
- Mensagens de erro em português, sem vazar payload do provedor.

---

## Verificação
1. Apresentação → ⚙️ → trocar voz → clicar Salvar → recarregar página → escolhas persistem.
2. Personas → criar persona → upload de áudio curto → ver Voice ID gerado → debate que usa essa persona toca com a voz clonada.
3. ElevenLabs sem plano → erro 401 amigável + botão "Tentar MiniMax" aparece.
4. Colar Voice ID manual → preview toca (usa o `previewVoice` já existente).