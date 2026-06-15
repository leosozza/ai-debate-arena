## Objetivo
Remover totalmente o provider "browser" (Web Speech) do sistema de vozes. Kokoro vira o padrão e debates antigos que usavam navegador migram automaticamente ao abrir.

## Mudanças

### 1. Catálogo de vozes (`src/lib/voice-catalog.ts`)
- Remover `"browser"` do `VoiceProvider` union (vira `"kokoro" | "piper" | "eleven" | "minimax" | "replicate"`).
- Tirar `browser` de `PROVIDER_LABEL`, `isProvider`, e `voiceLabel`.
- `VOICE_CATALOG` deixa de precisar de `Exclude<..., "browser">`.

### 2. Schemas server (zod)
Trocar `z.enum(["browser", ...])` em:
- `src/lib/voice-clone.functions.ts`
- `src/lib/persona.functions.ts`
- `src/lib/debate.functions.ts`
- `src/lib/debate-participants.functions.ts`

Aceitar valor antigo `"browser"` no input mas normalizar para `"kokoro"` antes de gravar (compat com clientes antigos em cache).

### 3. VoicePicker (`src/components/VoicePicker.tsx`)
- Remover branch `p === "browser"` (preview via `SpeechSynthesis`, lista de `browserVoices`, select "Automática pt-BR").
- Default provider passa a ser `"kokoro"`.
- Lista de providers no `Select` perde `"browser"`.
- `pitchSupported = p === "minimax"`.

### 4. Apresentação (`src/routes/_authenticated/presentation.$id.tsx`)
- `DEFAULT_SLOT.provider` = `"kokoro"`, `voiceId` = `"pf_dora"` (mod), e regra equivalente por gênero para A/B.
- Helper `normalizeSlot()`: se `provider === "browser"` (vindo do DB), substitui por Kokoro com voz default por gênero da persona.
- Remover `browserSpeak()` e todos os fallbacks `slot.provider === "browser"` (passam a sintetizar via Kokoro).
- Tirar avisos "browserSlots" / "navegador não grava" do export e do "pré-gerar todas as vozes".

### 5. Telas de criação/edição
- `src/routes/_authenticated/new.tsx` e `debates.$id.edit.tsx`: defaults `voiceProvider*` = `"kokoro"` (com `voiceId` default por gênero).
- Migração ao carregar persona: `vp === "browser"` → `"kokoro"` + voz default.

### 6. Export (`src/components/ExportVideoButton.tsx`)
- Remover check `provider === "browser"` e erro `navegador_nao_grava` (já não pode acontecer).

### 7. Migração de banco (opcional, segura)
Migration SQL: `UPDATE` em `debates` (`voice_provider_mod/a/b`) e `personas` (`voice_provider`) trocando `'browser'` por `'kokoro'` e preenchendo `voice_id` com `'pf_dora'` (F) ou `'pm_alex'` (M) conforme `gender` quando nulo. Isso garante que mesmo o `_authenticated/debates.$id.arena.tsx` e demais leituras diretas funcionem.

## Notas técnicas
- A normalização client-side cobre debates abertos antes da migration rodar.
- Tipos: `VoiceProvider` mais restrito vai gerar erros TS nos arquivos listados — todos cobertos acima.
- Texto/UI: nenhum copy menciona "navegador" depois disso.
