
# Abertura "Legends Arena" estilo Jornal Nacional + falas iniciais do apresentador

Hoje o programa abre assim: card silencioso de aviso (clique para continuar) → tela de "Preparando" → `OpeningSequence` (título / convidado A / convidado B / VS, sem música) → primeira mensagem do roteiro. Faltam: (1) **vinheta cinematográfica com música**, (2) **apresentador anuncia o aviso de IA falando**, (3) **apresentador apresenta os convidados falando** antes do debate começar.

## 1. Vinheta cinematográfica com áudio — novo `OpeningVignette`

Novo componente `src/components/OpeningVignette.tsx` que **substitui a fase "opening"** atual (a `OpeningSequence` vira o fallback silencioso para usuários que pularem o áudio).

Estrutura visual (≈ 8s, inspirada em JN/Everest):

```text
0.0s  bg preto absoluto + linhas de scan azuis varrem da borda
0.6s  partículas douradas/azuis sobem em paralaxe (3 camadas)
1.2s  shapes geométricos giram em órbita ao redor do centro
2.0s  raio de luz vertical "explode" no centro com flash branco
2.4s  logo "LEGENDS ARENA" entra letra a letra (kinetic typography)
        — cada glifo: blur→sharp + scale 1.3→1 + stagger 60ms
3.6s  subtítulo "HOJE NO PROGRAMA" desliza de baixo
4.2s  TÍTULO DO DEBATE aparece em font display gigantesca,
        máscara horizontal revelando da esquerda
6.0s  câmera "afasta" (transform scale 1→0.85) e abre para
        a `OpeningSequence` existente (A → B → VS)
```

Técnica: tudo em CSS keyframes + Tailwind animations (já temos `animate-in`, `kenburns`, etc.). Adiciono keyframes novos em `src/styles.css`: `scanline`, `particles-rise`, `orbit`, `flash-burst`, `letter-reveal`, `mask-wipe`.

### Música da vinheta

Música cinematográfica curta (~8s) tocada com `<audio>` HTML5, disparada no mesmo gesto do clique do disclaimer (preserva autoplay no iOS — mesmo padrão que já usamos com `ensureAudioEl`).

Duas opções para a trilha:

- **A. Arquivo estático curado (recomendado, custo zero, instantâneo)** — adiciono `public/audio/legends-opening.mp3` (faixa orquestral cinematográfica de domínio público / Creative Commons, ~8s). Carrega via `staticFile`/URL relativa. Sem dependência externa, sem latência.
- **B. Geração via ElevenLabs Music** — chama `/api/elevenlabs/music` com prompt `"cinematic news broadcast opening fanfare, orchestral strings and brass, dramatic timpani hits, 8 seconds, epic and prestigious"`. Cacheia no bucket `persona-videos` (ou novo `media-cache`) para não regerar. Custo por geração + ~3-5s de espera na primeira execução do projeto.

**Default:** opção A. Se o usuário quiser, troco para B em uma segunda iteração.

Controle de volume: prop `muted` do componente espelha o estado mudo da `OpeningSequence` (botão de mute reaproveitado). Música cai em fade-out nos últimos 800ms.

## 2. Apresentador fala o aviso de IA + apresenta os convidados

Em `presentation.$id.tsx`, **inserir 2 falas virtuais do mediador no início** do array `messages` em runtime (sem salvar no banco, sem mudar schema):

```ts
const virtualOpening = [
  {
    id: "__disclaimer__",
    role: "moderator",
    phase: "abertura",
    block_index: 0,
    content: AI_DISCLAIMER_TEXT, // já exportado de AIDisclaimer.tsx
  },
  {
    id: "__guests__",
    role: "moderator",
    phase: "abertura",
    block_index: 0,
    content:
      `Boa noite. Hoje na arena, o tema é: ${topic}. ` +
      `À minha direita, ${A.name}${A.description ? `, ${A.description}` : ""}. ` +
      `À minha esquerda, ${B.name}${B.description ? `, ${B.description}` : ""}. ` +
      `Que vença o melhor argumento.`,
  },
];
const messages = [...virtualOpening, ...(data?.messages ?? [])];
```

Essas falas:
- Usam a voz já configurada para o mediador (TTS Replicate/MiniMax/Eleven/Browser — qualquer uma).
- Entram no mesmo pipeline (`speak`, `prefetchUpcoming`, `pregenerateAll`, `exportVideo`) — ou seja, **aparecem no MP4 exportado também**, com o aviso obrigatório de IA falado, atendendo ao requisito legal/ético.
- Disclaimer é o primeiro slide do programa "ao vivo" (depois da vinheta). UI mostra o texto na tela com o componente `<AIDisclaimer variant="card">` em vez do card de fala normal quando `current.id === "__disclaimer__"`.
- Para a fala de apresentação dos convidados, mostro um card especial com foto + nome dos dois lado a lado enquanto o mediador fala (similar ao que `OpeningSequence` faz no slide "VS", mas estático).

## 3. Fluxo final

```text
1. Clique no aviso (silencioso) → libera autoplay + dispara música
2. Tela de "Preparando" (vozes + vinhetas de IA)
3. OpeningVignette (8s) com música + animação cinematográfica
   └─ encadeia em OpeningSequence (A→B→VS, igual hoje)
4. Mediador fala o aviso de IA (slide com AIDisclaimer card)
5. Mediador apresenta os convidados (slide com foto dos dois)
6. Debate começa (fluxo atual)
```

## 4. Arquivos afetados

- **novo** `src/components/OpeningVignette.tsx` (vinheta cinematográfica + `<audio>`)
- **novo** `public/audio/legends-opening.mp3` (faixa curada, ~8s, ≤200KB)
- editar `src/styles.css` — keyframes `scanline`, `letter-reveal`, `mask-wipe`, `orbit`, `flash-burst`, `particles-rise`
- editar `src/routes/_authenticated/presentation.$id.tsx`:
  - inserir 2 falas virtuais no início de `messages`
  - novo render condicional para os slides `__disclaimer__` e `__guests__`
  - fase `opening` agora renderiza `<OpeningVignette>` que ao terminar chama `<OpeningSequence>` (ou: vinheta + sequence viram um único componente "OpeningShow" com etapas internas — vou fundir)
- editar `src/components/AIDisclaimer.tsx` — sem mudança de API (já exporta `AI_DISCLAIMER_TEXT`)
- editar `src/lib/video-export.ts` — adiciona suporte para renderizar os 2 novos slides no MP4 (a vinheta cinematográfica em si fica fora do MP4 nesta v1; só as falas do mediador entram)

## 5. Fora de escopo (v1)

- Geração de música via ElevenLabs (fica como opção B futura)
- Renderizar a vinheta cinematográfica completa (com música) dentro do MP4 exportado — exigiria pipeline Remotion ou canvas-record com áudio mixado; pode ser v2
- Mudar texto do aviso de IA (continua o `AI_DISCLAIMER_TEXT` atual)
- Personalizar a saudação do mediador via IA (texto é template fixo nesta v1)

## 6. Riscos

- **Tamanho do MP3 da vinheta:** manter ≤200KB para não pesar o load inicial. Mitigação: mp3 mono 64kbps + 8s = ~64KB.
- **Autoplay no iOS:** já temos o padrão `ensureAudioEl` dentro do gesto do clique. A música usa o mesmo elemento ou um segundo `<audio>` priming no mesmo handler.
- **Mediador sem voz não-navegador:** se o usuário não configurou voz pro mediador, as duas falas iniciais usam `speechSynthesis` do navegador (qualidade variável). Aceitável — é o mesmo comportamento de todo o resto do debate.
- **Direitos da trilha:** uso faixa CC0/domínio público ou crio uma genérica simples; nunca faixa comercial.
