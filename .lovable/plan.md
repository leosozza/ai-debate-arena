## Problema

Na tela de apresentação/editor (`src/routes/_authenticated/presentation.$id.tsx`), o cache de áudio é apenas em memória (`audioCache.current: Map`). Toda vez que o usuário abre o editor, dá refresh, ou clica em "Exportar MP4", os áudios são gerados de novo — gastando crédito ElevenLabs/Replicate e travando o fluxo.

O `ExportVideoButton` já usa cache persistente em IndexedDB (`src/lib/tts-cache.ts`), mas o editor não — e os dois nem compartilham as mesmas chaves, então o áudio gerado num lugar não é reaproveitado no outro.

## Mudanças

### 1. `src/routes/_authenticated/presentation.$id.tsx`
- Importar `ttsCacheGet`, `ttsCachePut`, `ttsCachePrune`, `blobToUrl`, `dataUrlToBlob`, `hashContent` de `@/lib/tts-cache`.
- Rodar `ttsCachePrune()` uma vez ao montar.
- Em `fetchAudioUrl(slot, msgId, text)`:
  1. Calcular chave unificada: `${slot.provider}|${voiceId}|${msgId}|${hashContent(clean)}` (mesma forma usada pelo `ExportVideoButton`, sem incluir `settings` — speed/pitch/volume são aplicados no `<audio>` no playback para replicate/eleven; para minimax, incluir `|${speed}|${pitch}|${vol}` no sufixo da chave porque afetam a síntese).
  2. Antes de chamar o provider, tentar `ttsCacheGet(key)` → se achar, criar `blobToUrl(blob)` e devolver.
  3. Depois de sintetizar, converter `url` em Blob (`dataUrlToBlob` se `data:`, senão `fetch`) e salvar via `ttsCachePut(key, blob, duration?)`. Como o editor não conhece a duração nesse ponto, salvar `duration: 0` (o exportador recalcula de qualquer forma; e o getter ainda devolve a duração se tiver).
- Manter `audioCache.current` como cache quente da sessão (URLs já vivas) para evitar recriar `Object URL` toda hora.

### 2. `src/components/ExportVideoButton.tsx`
- Ajustar a função `cacheKey` para usar exatamente o mesmo formato: `${slot.provider}|${slot.voiceId}|${m.id}|${hashContent(m.content)}` (já é o formato atual — confirmar) e, no caso de minimax, sufixar com `|${speed}|${pitch}|${vol}`.
- Sem outras mudanças funcionais.

### 3. `src/lib/tts-cache.ts`
- Tornar `duration` opcional no `Entry` para suportar entradas salvas pelo editor sem essa info. Quando `ttsCacheGet` devolver `duration === 0`, o exportador recalcula via `getAudioDuration(url)` (já faz isso de qualquer forma — basta não confiar cegamente no valor).

## Resultado esperado

- Tocar a fala no editor sintetiza uma vez e grava no IndexedDB.
- Reabrir o editor, dar refresh, ou clicar em "Exportar MP4" reaproveita o mesmo áudio — zero chamada à ElevenLabs/Replicate para as falas já geradas.
- Só re-gera quando: texto da fala muda (hash diferente), voz/provider muda, ou passa de 30 dias (prune existente).
