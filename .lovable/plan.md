## Diagnóstico

A página fechou sozinha em "Codificando vídeo X/35". Isso quase sempre é **estouro de memória do navegador** (tab crash), não um bug de código. A exportação de MP4 acontece 100% no seu navegador, e o caminho rápido (WebCodecs) está mantendo na RAM ao mesmo tempo:

- o áudio PCM misturado de TODO o debate (≈25 MB por minuto a 48 kHz estéreo),
- todos os `AudioBuffer` originais de cada fala (mais ≈8 MB por minuto cada),
- a música de fundo decodificada,
- o canvas 1280×720,
- e o MP4 inteiro acumulado em memória pelo `mp4-muxer` (`ArrayBufferTarget`).

Para um debate completo de 8–15 min com 33 falas, isso passa fácil de 1,5–2 GB e o Chrome derruba a aba.

## O que vou mudar

### 1. Reduzir memória do caminho WebCodecs (`src/lib/video-export-webcodecs.ts`)
- Baixar `SAMPLE_RATE` de 48000 → 44100 (menor PCM, mesma qualidade percebida em fala/música).
- **Liberar buffers à medida que avança**: após misturar o áudio, zerar `seg.audio` e `seg.bedMusic` de cada segmento (já não são mais necessários durante o encode de vídeo).
- Fechar o `AudioContext` antes do encode de vídeo (hoje só fecha no final).
- Decodificar a música de fundo **uma vez** e fatiar por referência em vez de copiar (`trimBuffer` cria cópia para cada segmento — vou substituir por uma estrutura que reusa o buffer original com offsets, evitando ~N cópias da mesma música).
- Apertar o backpressure do `VideoEncoder` (`encodeQueueSize > FPS` em vez de `FPS*2`) e dar `await new Promise(r=>setTimeout(r,0))` entre segmentos para o GC respirar.

### 2. Plano B automático: exportar por bloco e juntar (`src/components/ExportVideoButton.tsx`)
- Detectar quando o debate é longo (> ~6 min de áudio total OU mais de 20 falas) e, ao clicar em "Exportar MP4 (completo)", **gerar um MP4 por bloco em sequência**, salvar cada um no Storage, e em seguida concatená-los no servidor com `ffmpeg.wasm` num passo final leve (apenas `-c copy`, sem reencode), ou apenas oferecer o download de cada bloco se a concat falhar.
- Mostrar progresso "Bloco 1/4… Bloco 2/4…" — isso evita acumular tudo na RAM de uma vez.

### 3. Mensagens de erro melhores
- Capturar `unload`/`pagehide` durante o export e gravar no `localStorage` que houve crash, para mostrar um toast claro no próximo carregamento ("A última exportação travou — tente exportar por bloco").
- Logar `performance.memory.usedJSHeapSize` (Chrome) antes de cada etapa pesada para o console — facilita diagnóstico futuro.

### 4. Fora do escopo (não vou mexer agora)
- Render server-side. Faz sentido, mas é mudança grande; só recomendo se mesmo após (1)+(2) você ainda tiver problemas.

## Detalhes técnicos

- Arquivos editados: `src/lib/video-export-webcodecs.ts`, `src/components/ExportVideoButton.tsx`.
- Sem mudança de schema, sem mudança de servidor.
- O fallback `ffmpeg.wasm` (`exportDebateMp4Ffmpeg`) continua intacto como rede de segurança.
- Nenhum áudio é regenerado: o cache IndexedDB de TTS é reaproveitado entre tentativas.

## Como verificar depois

1. Recarregar o debate `cea98432-…` e clicar em "Exportar MP4 (completo)".
2. Esperado: progresso passa por blocos ("Bloco 1/4 — Codificando vídeo X/N") sem fechar a aba; ao final, baixa o MP4 e aparece na lista de exports salvos.
3. Se ainda travar num bloco específico, o toast vai dizer qual bloco — aí reduzimos ainda mais o bitrate ou exportamos os blocos separadamente.
