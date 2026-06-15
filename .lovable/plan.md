## Diagnóstico

O exportador atual (`src/lib/video-export.ts`) usa **`ffmpeg.wasm` single-thread** (core `0.12.10` pelo unpkg, sem `-mt`). Cada fala vira um segmento `.mp4` com `libx264` (`-preset veryfast`), depois um `concat`, depois mais uma passada pra música, mais uma pra SFX, mais uma pra "beds". Resultado:

- **N+3 passadas de libx264 em WASM single-thread** — pra um debate de 4 blocos com ~30 falas, são 30+ encodes seguidos no mesmo thread. O navegador fica sem responder, parece travar.
- Sem SharedArrayBuffer, não dá pra ativar o `core-mt` (precisaria de COOP/COEP).
- A barra de progresso passa por "Renderizando vídeo" mas o ffmpeg.wasm não emite progresso granular nas múltiplas passadas, então parece "congelado".

## Solução: trocar para WebCodecs + mp4-muxer

O navegador moderno (Chrome, Edge, Safari 17+, Firefox 130+) tem **`VideoEncoder` nativo** com aceleração de hardware H.264. Combinado com **`mp4-muxer`** (npm, ~30KB, MIT) dá pra montar o MP4 num passo só, frame-a-frame, **10–50× mais rápido** que o ffmpeg.wasm.

### Como vai ficar

1. **`src/lib/video-export-webcodecs.ts`** (novo) — exporta a mesma função `exportDebateMp4(...)` com a mesma assinatura. Por dentro:
   - Detecta suporte: `'VideoEncoder' in window && await VideoEncoder.isConfigSupported({ codec: 'avc1.42E01F', width:1280, height:720 })`. Se não suportar → cai no caminho atual (ffmpeg.wasm).
   - Cria `OffscreenCanvas(1280, 720)`, `VideoEncoder` (avc1, ~2.5 Mbps, keyframe a cada 2s), `Mp4Muxer` (fastStart fragmentado).
   - Pra cada clip: decodifica o áudio uma única vez via `AudioContext.decodeAudioData` → mistura tudo num único `AudioBuffer` final (com música de fundo somada em volume reduzido). Em paralelo, desenha o frame da fala no canvas e encoda 30fps pela duração do clip (mesmo desenho repetido = compressão eficiente, peso pequeno).
   - **Áudio**: encoda o `AudioBuffer` final pra AAC com `AudioEncoder` ('mp4a.40.2') e adiciona como track no muxer.
   - Finaliza → `Blob('video/mp4')`. Acabou.
2. **`onProgress`** chamado a cada N frames + nas etapas "preparando áudio / encodando vídeo / encodando áudio / finalizando" — dá feedback real.
3. **Mesma resolução (1280×720) e fps (30)**, mas com botão pra cair pra 854×480 se o usuário quiser ainda mais rápido (fica pra depois — esta entrega mantém 720p).
4. **Fallback**: se `VideoEncoder` não existir, ou se o `isConfigSupported` falhar, ou se rolar exceção, chama `exportDebateMp4Ffmpeg` (caminho atual, renomeado pra `video-export-ffmpeg.ts`). Toast informando "navegador sem suporte rápido — usando encoder lento".
5. **Timeout de sanidade**: se o encode passar de 5 minutos sem progresso, aborta e mostra erro claro em vez de "girar pra sempre".
6. **Telemetria leve no console**: `console.info("[export] webcodecs done in", ms)` pra você ver no preview se está pegando o caminho rápido.

### O que NÃO muda

- A assinatura `exportDebateMp4(args)` continua igual — `ExportVideoButton.tsx` não muda.
- Os clipes (TimelineClip), trims, música, SFX, legendas e o layout do canvas continuam idênticos. É só o encoder que troca.
- O caminho "salvar no debate" (bucket `debate-videos`) feito na rodada passada continua funcionando — ele opera em cima do `Blob` final.

### Dependência nova

- `bun add mp4-muxer` (~30KB, MIT, sem peers).

## Fora de escopo

- Não vou implementar fila no servidor (a sugestão do snippet) — o export é client-side e isso adicionaria muita infra pra um problema que o WebCodecs resolve no navegador. Se mesmo com WebCodecs ficar lento em vídeos muito longos, aí sim entra fila.
- Não vou ativar o `ffmpeg-core-mt` (precisaria COOP/COEP no `__root.tsx` + start.ts, risco de quebrar outras coisas como imagens externas e o player Kokoro).
- Não vou mexer no formato visual nem na timeline.

## Resultado esperado

- Em Chrome/Edge/Safari recente, exportar um bloco de ~5 min de áudio passa de **~3–8 minutos travando** pra **~15–40 segundos com progresso fluido**.
- Em navegador sem WebCodecs, comportamento atual preservado (lento, mas funcional).
- Erros viram toast claro em vez de "encoder travado".
