## Ideia

Em vez de renderizar o debate inteiro (ou por blocos grandes) numa única passagem do navegador — que estoura a RAM e derruba a aba —, **cada fala vira um MP4 curto** (5–40 s cada). Como cada fala é um pedaço pequeno, a aba nunca acumula muita memória, e se uma falha você re-roda só aquela.

Depois você tem três opções:
1. **Baixar cada fala** separada (ZIP opcional).
2. **Baixar o vídeo único** de todas as falas concatenadas.
3. **Baixar por bloco** (junta só as falas daquele bloco).

## Fluxo na UI (`ExportVideoButton.tsx`)

Substituo o botão "Exportar MP4 (completo)" por um painel "Exportar":

```text
[ Gerar vídeos (1 por fala) ]   ← roda a fila

Progresso: Fala 7/33 — "Karl Marx, réplica 2" ✓
[barra de progresso]

Quando todas prontas:
  [ Baixar vídeo único (juntar) ]   [ Baixar tudo (ZIP) ]
  Lista:
    ✓ 01 — Mediador, abertura          [▶ ouvir] [⬇ baixar] [↻ refazer]
    ✓ 02 — Karl Marx, argumento 1      [▶]       [⬇]        [↻]
    ✗ 03 — Enéas Carneiro, réplica 1   [↻ tentar de novo]
    …
```

- Cada linha mostra status (pendente / renderizando / pronto / erro) e permite **re-renderizar só aquela fala** sem refazer o resto.
- O estado da fila persiste no Storage: se você fechar a aba no meio, ao voltar continua de onde parou (as falas já prontas ficam salvas).

## Como funciona por baixo

### 1. Pipeline por fala (`src/lib/video-export-per-speech.ts` — novo)
Reaproveita 90% do `video-export-webcodecs.ts`, mas:
- Recebe **uma única fala** (ou um pequeno grupo: ex.: card de transição + fala).
- Monta áudio + vídeo + música de fundo só daquele trecho.
- Sai com um `Blob` MP4 de ~1–8 MB.
- Faz `URL.revokeObjectURL` e `ac.close()` no fim → memória volta ao zero entre falas.

### 2. Orquestrador na UI
- Lê a lista de mensagens do debate.
- Para cada uma: gera o MP4, sobe pro Storage (bucket `debate-exports`, pasta `<debateId>/parts/<msgId>.mp4`) e marca como pronta.
- Concorrência = 1 (sequencial) para não estourar RAM.
- Entre cada fala: `await new Promise(r => setTimeout(r, 200))` para o GC respirar.

### 3. Juntar no final ("Baixar vídeo único")
Duas estratégias, com fallback automático:

- **Plano A — concat sem reencode (rápido, baixa RAM):** carrega `ffmpeg.wasm` (já está no projeto, usado pelo fallback), faz `ffmpeg -f concat -safe 0 -i list.txt -c copy final.mp4`. Como todas as partes foram codificadas com o mesmo encoder/resolução/fps/sample-rate, o concat sem reencode funciona. Tempo: ~5–15 s para 33 falas.
- **Plano B — fallback:** se o concat sem reencode falhar (raro, geralmente por diferença de timebase), reencode rápido com `-c:v libx264 -preset ultrafast -c:a aac`.

O arquivo final também é salvo no Storage como `<debateId>/full.mp4` e aparece na lista de "Vídeos salvos" que já existe (`DebateExportsList.tsx`).

### 4. "Baixar tudo (ZIP)"
Usa `JSZip` (adiciono como dep) para baixar as N partes do Storage e empacotar localmente. Útil para quem quer editar no Premiere/DaVinci.

## Onde mexer

- **Novo:** `src/lib/video-export-per-speech.ts` — função `exportSingleSpeech(debate, message, opts)` retornando `Blob`.
- **Novo:** `src/lib/video-export-concat.ts` — função `concatMp4Parts(urls[]): Promise<Blob>` usando ffmpeg.wasm.
- **Reescrito:** `src/components/ExportVideoButton.tsx` — vira um painel com fila, lista de falas, ações por linha. A lógica antiga (`exportDirect`, `exportAllBlocksSequentially`, `exportBlock`, etc.) é substituída.
- **Refatorado:** `src/lib/video-export-webcodecs.ts` — extrai a parte de "renderizar um trecho" para ser reusada por fala única (sem mudar comportamento da exportação por bloco, que mantenho como fallback escondido por enquanto).
- **DB:** sem mudança de schema. As partes ficam só no Storage (não preciso indexar no `debate_exports`); só o `full.mp4` final é registrado, como hoje.
- **Storage:** mesma bucket `debate-exports`, nova subpasta `parts/`.

## O que isso resolve

- **Não trava mais:** cada render usa <100 MB de RAM mesmo num debate de 15 min. A aba não fecha.
- **Resiliente:** se uma fala der erro, você re-roda só ela, sem perder as 32 anteriores.
- **Flexível:** dá pra baixar individual (útil pra cortes em redes sociais), por bloco, ou tudo junto.
- **Mais rápido percebido:** as primeiras falas ficam prontas em ~20 s — você já pode começar a baixar/usar antes do final.

## O que **não** vou fazer

- Render server-side (continua sendo mudança grande; só se mesmo assim houver problema).
- Mudar a apresentação ao vivo no navegador (só mexo no exportador).
- Mexer no cache de TTS (continua reaproveitando o áudio já gerado).

## Como verificar depois

1. Recarregar `/debates/cea98432-…` → "Exportar".
2. Clicar "Gerar vídeos (1 por fala)" e ver a fila avançar fala a fala sem fechar a aba.
3. Ao terminar: "Baixar vídeo único" → MP4 final com tudo, ou baixar 1–2 falas pra conferir áudio/vídeo isolado.
4. Forçar erro (desligar internet em uma fala) → linha fica vermelha com botão "↻ tentar de novo"; ao retomar, só essa é refeita.

Quer que eu siga por aí?
