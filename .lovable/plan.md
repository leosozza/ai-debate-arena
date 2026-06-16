## Objetivo

Permitir refazer em lote todos os vídeos por fala que já estavam prontos com o jingle, agora que a cama musical foi removida.

## Como funciona hoje

- O cache (`mp4PartsCache` no IndexedDB) guarda cada MP4 por `(debateId, msgId)`. Como já existem MP4s salvos, abrir o painel marca tudo como `done` e a fila não regera nada.
- Já existe `retryAudiosForMsgIds([...])` que re-sintetiza áudios (TTS bate no cache, então não cobra crédito de novo) e em seguida chama `runPerSpeechExport(id)` para cada um, gerando o MP4.

## Mudança

Adicionar um botão **"Refazer todos sem jingle"** no painel per-speech (`src/components/ExportVideoButton.tsx`), ao lado dos botões já existentes (Gerar / Continuar fila / Refazer áudios). Comportamento:

1. Confirmação rápida (`window.confirm`): "Apagar os vídeos já gerados e refazer todos sem o jingle?"
2. Apaga do IndexedDB os MP4s de todas as falas do debate (`mp4PartDelete` em loop).
3. Reseta o estado de cada `part`: `status: "pending"`, limpa `videoBlob`/`videoUrl`/`audioUrl`/`progressPct`/`error`.
4. Chama `retryAudiosForMsgIds(allMsgIds)` — que rebusca os áudios (cache TTS já evita custo) e dispara a fila de render. Com a correção anterior, os MP4s saem **sem** o jingle.

### Bônus (correção pequena no mesmo lugar)

- O botão atual **"Refazer áudios"** só pega itens em `error` sem áudio. Vou ajustar o título/tooltip para deixar claro a diferença ("Refazer áudios faltantes" vs. o novo "Refazer todos sem jingle").

## Arquivos a alterar

- `src/components/ExportVideoButton.tsx` — adicionar a função `redoAllWithoutJingle()` e o botão correspondente no header do painel per-speech.

Nada muda em cache/encoder/server.
