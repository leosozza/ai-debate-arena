## Problema

1. **Áudio não toca nada**: o player tenta gerar a 1ª fala (mediador via Replicate `presenter_male`) on-demand quando clicas em Tocar. O navegador bloqueia o `audio.play()` porque ele acontece depois de um `await` longo (XTTS-v2 / Replicate TTS demoram 30–90s) → o gesto do clique já expirou. Soma-se a isso a falta de feedback e a possibilidade de timeout do gateway.
2. **Apresentação dos candidatos**: hoje é só foto+nome estáticos. As personas Dr Enéas e Karl Marx não têm `vignette_url` gerada.

## Solução

### 1. Pré-geração automática + abertura "Tá no Ar" (apresentação `/presentation/:id`)

Sequência ao abrir a apresentação (substitui o disclaimer de 4.5s atual):

```text
[1] Card de aviso IA (4s, igual ao atual)
[2] Tela de PREPARAÇÃO — barra de progresso "Preparando o programa…"
      ├─ Gera vozes de TODAS as falas em paralelo (concurrency=3)
      ├─ Em paralelo: garante vinhetas das 2 personas (gera se faltar)
      └─ Botão "Pular preparação" → vai direto ao card estático antigo
[3] ABERTURA cinematográfica (auto-play, ~20s total)
      ├─ 2-3s: título do debate em tela cheia com lower-third do programa
      ├─ 6-8s: vinheta do Convidado A em fullscreen + nome animado
      ├─ 6-8s: vinheta do Convidado B em fullscreen + nome animado
      └─ 2s: "VS" + tema → dissolve para o estúdio
[4] Debate normal toca imediatamente (áudios já em cache → zero latência)
```

Se uma persona não tem vignette_url, geramos automaticamente (`generatePersonaVignette` já existe). Se a geração falhar/demorar muito (>90s), caímos no card estático Ken-Burns do retrato.

### 2. Correção do gesto de áudio

Mesmo com pré-geração, o primeiro `audio.play()` precisa ser criado dentro do gesto do clique. Trocamos `new Audio(url).play()` por um único elemento `<audio>` montado uma vez (no clique de "Tocar abertura") cujo `src` é trocado entre falas — mantém a permissão de autoplay já concedida.

### 3. Botão "Tocar vinheta" na página do debate

A pedido anterior, também adicionamos um botão "▶ Tocar abertura cinematográfica" na página `/debates/:id` que abre a mesma sequência [3] em modal, sem precisar entrar no modo apresentação.

## Detalhes técnicos

**Novos componentes**
- `src/components/PreparationScreen.tsx` — tela de loading com barras paralelas (vozes X/Y, vinheta A, vinheta B) e botão pular.
- `src/components/OpeningSequence.tsx` — fullscreen autoplay: título → vídeo A → vídeo B → VS. Usa `<video autoPlay muted playsInline>` (muted permite autoplay no mobile; áudio das vinhetas Veo-3 fica opcional via toggle).
- `src/components/AudioPlayer.tsx` (hook `useSequentialAudio`) — singleton `<audio>` reaproveitado para preservar o gesto.

**Arquivos editados**
- `src/routes/_authenticated/presentation.$id.tsx`:
  - Substitui o `<button overlay>` do disclaimer por máquina de estados `phase: "disclaimer" | "preparing" | "opening" | "live"`.
  - `preparing`: dispara `pregenerateAll()` + `ensureVignettes()` em paralelo, mostra `PreparationScreen`, avança para `opening` quando vozes ≥80% prontas.
  - `opening`: renderiza `OpeningSequence`, ao terminar (ou ao "Pular") seta `live` e auto-clica o Play.
  - `live`: comportamento atual, mas usando o singleton audio.
- `src/lib/persona-video.functions.ts`: já existe `generatePersonaVignette`; adiciono `ensurePersonaVignette({personaId})` que gera só se faltar e devolve a URL.
- `src/routes/_authenticated/debates.$id.tsx`: adiciona botão "🎬 Tocar abertura" que abre `OpeningSequence` em `<Dialog>`.

**Pré-geração de áudio (sem timeout)**
- Mantém `concurrency=3` no client.
- Cada chamada ao Replicate XTTS-v2 já tem `maxMs=180_000` server-side.
- Adiciona toast com erro específico por fala que falhar (em vez de silenciar).
- Cache permanece em memória; ao recarregar perde — aceitável por enquanto.

**Fallback se a vinheta não gerar a tempo (>90s)**
- `OpeningSequence` mostra Ken-Burns do `image_url` da persona por 6s com o nome em entrada animada, no lugar do `<video>`.

## Riscos

- Gerar 2 vinhetas Veo-3 leva 1–3 min cada → preparação pode passar de 3 min na primeira vez. Mitigação: rodamos vinhetas em paralelo com a geração de vozes; se vozes terminarem antes, mostramos "Vinhetas ainda processando — pular?" e seguimos sem elas.
- Mobile autoplay: `<video muted>` autoplaya; se o usuário ligar áudio da vinheta no toggle, exigimos toque (já estamos pós-clique do "Iniciar", então OK).

## Fora de escopo (deixar para depois)

- Persistir cache de áudio em IndexedDB para sobreviver a reload.
- Música de fundo / sting de transição.
- Vinheta dinâmica do mediador.