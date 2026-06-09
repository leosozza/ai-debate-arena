## Problemas e correções

### 1) IA fala "asterisco asterisco" (markdown no TTS)
A IA está respondendo com `**negrito**` e o TTS lê os asteriscos. Vou:
- Adicionar instrução explícita em `buildSystemPrompt` e nos `user prompts` de fala (`debate.functions.ts`): "responda em TEXTO PURO, sem markdown, sem asteriscos, sem listas, sem títulos — apenas frases faladas".
- Criar um sanitizador `stripMarkdownForTts(text)` em `src/lib/text-utils.ts` que remove `**`, `*`, `_`, `` ` ``, `#`, `>`, bullets `- ` no início de linha, links `[x](y)` → `x`, e colapsa espaços.
- Aplicar `stripMarkdownForTts` antes de enviar para `browserSpeak`/`fetchAudioUrl` em `presentation.$id.tsx` (e na arena, se aplicável).

### 2) Voz do Enéas terminando com "meu nome é Enéas, propaganda eleitoral"
A persona do usuário provavelmente foi escrita com base em vídeos de campanha. Vou:
- Reforçar no system prompt do debatedor (`buildSystemPrompt`): "Você está num DEBATE de TV, não em horário eleitoral. Nunca faça encerramento de propaganda (não diga 'meu nome é X', 'vote', 'mudemos o Brasil', etc.). Foque em argumentar o ponto atual; não se reapresente a cada fala."
- Adicionar a mesma instrução no user prompt das fases de réplica/abertura.

Isso resolve sem precisar editar a persona do usuário.

### 3) Pausas longas para gerar voz ao vivo + opção de gerar vídeo
Dois caminhos complementares:

**3a. Pré-carregar áudio das próximas falas (prefetch)**
Em `presentation.$id.tsx`:
- Quando uma fala começar a tocar, disparar em background `fetchAudioUrl` para as próximas 2–3 mensagens (usando o `slot` correspondente ao role de cada uma). O resultado já cai no `audioCache.current`, então quando chegar a hora de tocar, é instantâneo.
- Mostrar um indicador discreto "pré-carregando próximas vozes (n/total)".

**3b. Botão "Pré-gerar todas as vozes do debate"**
Novo botão no painel de Configurações:
- Itera por todas as `messages`, chama `fetchAudioUrl` em paralelo limitado (concorrência 3) e popula o cache. Persiste contagem de progresso na UI.
- Quando terminar, transmissão ao vivo no YouTube fica sem pausas.

**3c. Exportar vídeo MP4 do debate inteiro**
Novo botão "🎬 Exportar vídeo (MP4)". Implementação:
- Server function `exportDebateVideo` em `src/lib/debate-video.functions.ts` que:
  1. Lê todas as mensagens do debate.
  2. Gera TTS de cada fala usando o provider/voz salvo no `debates` (mod/a/b).
  3. Concatena os MP3 em ordem com `ffmpeg.wasm` (ou, se inviável no Worker, usa o Replicate `xfade-audio`/um modelo de concatenação). **Alternativa preferida**: gerar localmente no cliente com `@ffmpeg/ffmpeg` (WASM no browser) — recebe os base64 do servidor, concatena, e cria um MP4 com um background estático + legendas simples (nome do falante + bloco) usando `Canvas`+`MediaRecorder`.
  4. Download direto via blob URL.
- Para v1, vídeo simples: fundo escuro com nome+avatar do falante atual (troca a cada fala) e legenda do bloco. Sem animações elaboradas — só algo postável no YouTube.
- Pré-requisito: rodar 3b antes (ou o export faz isso internamente).

## Arquivos afetados
- `src/lib/text-utils.ts` (novo) — `stripMarkdownForTts`.
- `src/lib/debate.functions.ts` — instruções de prompt anti-markdown e anti-propaganda.
- `src/routes/_authenticated/presentation.$id.tsx` — sanitizar texto, prefetch das próximas falas, botão "pré-gerar todas as vozes", botão "exportar vídeo".
- `src/lib/debate-video.functions.ts` (novo) — server fn que devolve todos os áudios base64 em ordem.
- `src/components/VideoExportDialog.tsx` (novo) — UI + montagem do MP4 com ffmpeg.wasm + canvas no browser.
- `package.json` — adicionar `@ffmpeg/ffmpeg` e `@ffmpeg/util`.

## Não vou mexer
- Lógica de seleção de voz por participante (já refatorada).
- Catálogo de vozes Replicate/MiniMax/Eleven.
- Geração de personas / avatares.

## Pergunta antes de implementar
A exportação de vídeo (item 3c) é o item mais pesado — quer que eu faça **tudo nesta rodada** (prefetch + pré-gerar tudo + exportar vídeo MP4) ou começo só por **1 + 2 + 3a/3b** (correções imediatas e prefetch) e o vídeo entra numa próxima rodada?
