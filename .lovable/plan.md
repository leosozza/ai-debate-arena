# Plano — 7 correções e melhorias

## 🔴 Crítico

### 1. Vazamento de memória nos caches de TTS
**Arquivos:** `src/lib/kokoro-tts.ts`, `src/lib/piper-tts.ts`
- Adicionar LRU simples: `Map` com limite de **200** entradas.
- Ao despejar entrada antiga, chamar `URL.revokeObjectURL(blobUrl)` para liberar memória do navegador.
- Aplicar tanto no cache de áudio gerado quanto em qualquer cache de modelo/voz que segure blobs.

### 2. Toggle "comentaristas" vazando para formatos multi
**Arquivo:** `src/routes/_authenticated/new.tsx` (e `debates.$id.edit.tsx` se aplicável)
- Renderizar o toggle `enable_commentators` **somente quando `format === "duel"`**.
- Ao trocar para qualquer formato multi: forçar `enable_commentators = false` no estado para não persistir lixo.
- Garantir que `presentation.$id.tsx` ignore comentaristas em multi (defesa em profundidade).

## 🟠 Importante

### 3. Segurança em deletes (ownership explícita)
**Arquivos:** `src/lib/debate.functions.ts`, `src/lib/debate-participants.functions.ts`, `src/lib/persona.functions.ts`, `src/lib/voice-presets.functions.ts` (4 alvos)
- Em cada server fn de `delete*`, adicionar `.eq("user_id", context.userId)` na query do delete (mesmo já tendo RLS — defesa em profundidade).
- Para `debate_participants` (que não tem `user_id` direto), validar via `assertOwnsDebate(debateId, userId)` antes do delete.
- Retornar erro claro ("Não autorizado") quando `count === 0`.

### 4. Retry com backoff no AI Gateway
**Arquivo:** `src/lib/ai-gateway.server.ts`
- Envolver `fetch` em `chatComplete` com retry: **3 tentativas**, backoff exponencial (500ms → 1500ms → 4500ms) + jitter.
- Retentar apenas em: `AbortError`/timeout, status `429`, `500-599`.
- Não retentar `4xx` (exceto 429) — falha permanente.
- Timeout por tentativa: 60s via `AbortController`.

## ✨ UX

### 5. Tons por papel (tribunal/multi)
**Arquivo:** `src/components/CastStrip.tsx` (função `accentForSlot` + lookup novo)
- Adicionar `accentForRole(role)`:
  - `prosecutor` → `side-b` (azul)
  - `defender` → `chart-4` (dourado)
  - `judge` → `primary` (neutro/destaque)
  - `interviewer` → `accent`
  - resto → cai no `accentForSlot` atual
- Em `MultiScoreboard`, `ClosingCardMulti` e `presentation.$id.tsx`, preferir `accentForRole(role)` quando disponível, com fallback para slot.

### 6. Botão "Refazer última" fala
**Arquivos:** `src/routes/_authenticated/presentation.$id.tsx` + nova server fn em `src/lib/debate.functions.ts`
- Nova server fn `redoLastTurn({ debateId })`:
  - Verifica ownership.
  - Pega última mensagem (`order_index` desc).
  - Deleta.
  - Roteia para `generateNextTurn` (duel) ou `generateParticipantTurn` (multi) conforme `debate.format`.
- UI: botão discreto "↻ Refazer última" no painel de controle do apresentador, ao lado do play/pause. Desabilitado quando não há mensagens ou `status === "completed"`.

## Pendências já confirmadas pelo usuário
- ✅ Migrations já aplicadas (types.ts atualizado).

## Ordem de execução
1. (#1, #2) críticos primeiro — código pequeno e isolado.
2. (#3, #4) segurança/robustez backend.
3. (#5, #6) UX por cima.
