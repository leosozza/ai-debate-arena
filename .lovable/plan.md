## Diagnóstico

Três sintomas, três causas diferentes:

### 1. Debate "fecha e volta para o início" na réplica 2
Não é falha de TTS. O console mostra:

```text
Error: Maximum update depth exceeded
  at setRef (chunk-67O37JI6 ... Array.map)
  componentDidCatch (CatchBoundary)
  Error in route match: __root__/
```

Um `setRef` dentro de `Array.map` (composição de refs de algum botão Radix — provavelmente o `Tooltip` envolvendo botões desabilitados num componente de lista) entra em loop de `setState`, a `CatchBoundary` da raiz captura e o usuário é jogado de volta para a home. Como acontece consistentemente na 2ª réplica, é o ponto em que aquela lista entra em render (provavelmente quando aparece o `BlockIntroCard` do 2º bloco ou um overlay/HUD que re-renderiza a cada `currentAudioMs`).

### 2. Réplica 1 começa antes do Enéas terminar
No `useEffect` que dispara o `BlockIntroCard` (`presentation.$id.tsx` ~628), quando o `block_index` muda, ele chama `stopAll()` imediatamente — cortando a fala anterior — e mostra a cartela do novo bloco. Só que o efeito depende de `current?.id`, então dispara na hora em que o `index` avança (ou seja, **antes** do `onended` do Enéas se a cartela coincide). Além disso, o efeito principal de fala (`~635`) lista `slotMod, slotA, slotB` como deps: como esses objetos são recriados a cada render, o efeito re-roda no meio de uma fala, incrementa `playTokenRef` e re-chama `speak`, gerando sobreposição/restart.

### 3. Marx muito devagar, Enéas muito rápido (ambos ElevenLabs)
A ElevenLabs **não** suporta `speed` server-side no fluxo atual (`elevenlabs.server.ts` só envia `voice_settings: stability/similarity/style/use_speaker_boost`). O cliente aplica `audio.playbackRate = slot.settings.speed`. Se cada persona tem um `settings.speed` diferente salvo (1.0 vs 0.85 vs 1.2), a velocidade fica desigual. Pausas naturais escalam junto com `playbackRate`, então pausas do Enéas "somem" e as de Marx ficam arrastadas. Os usuários esperam ritmo natural por padrão.

---

## Plano de correção

### A. Eliminar o loop de render (prioridade — destrava o debate)

1. Localizar o componente em lista que envolve botões com `Tooltip`/`forwardRef` (suspeitos: `MessageAudioButton`, `CastStrip`, `Teleprompter`, `MultiScoreboard`).
2. Garantir que o filho do `TooltipTrigger`/`Button` desabilitado não use `asChild` quando o filho é `<button disabled>` (padrão Radix que causa o loop em listas).
3. Onde houver `forwardRef` próprio com `useImperativeHandle` ou `useEffect(() => setRef(...))`, estabilizar com `useCallback` para evitar nova função a cada render.
4. Validar que os `currentAudioMs`/`setVoiceFallback` não disparam re-render que recria refs.

### B. Estabilizar a sequência de fala (sem sobreposição na transição de bloco)

1. No `useEffect` principal de fala (`~635`): trocar deps `slotMod, slotA, slotB` por identificadores estáveis (`slotMod.voiceId`, `slotA.voiceId`, `slotB.voiceId` — ou só `current?.id`/`introBlock`), evitando re-trigger no meio da fala.
2. No `useEffect` do `BlockIntroCard` (`~623`): **não** chamar `stopAll()` se o áudio atual ainda está tocando — esperar o `onended` natural antes de mostrar a cartela. Implementação: marcar `pendingBlockIntro = b`, e exibir a cartela dentro do `advance()` (logo após `onended`) antes de avançar para a próxima mensagem.
3. Como salvaguarda, ignorar `onended` se `token !== playTokenRef.current` (já existe) **e** debouncar `advance` para descartar avanços duplicados.

### C. Velocidade uniforme nas vozes ElevenLabs

1. Em `elevenlabs.server.ts`, incluir `speed` em `voice_settings` (suportado pelo `eleven_multilingual_v2`, faixa 0.7–1.2) recebido como parâmetro opcional, default 1.0. Atualizar a chamada em `fetchAudioUrl` para enviar `slot.settings.speed`.
2. Quando o `speed` vai no payload server-side, **não** aplicar `audio.playbackRate` no cliente (senão acumula). Trocar a regra do `if (slot.provider === "replicate" || slot.provider === "eleven")` para aplicar `playbackRate` apenas em `replicate`.
3. Ajustar a chave de cache do TTS para incluir `speed` quando provider é `eleven` (hoje o `settingsSuffix` só roda para `minimax`), senão duas velocidades diferentes reutilizam o mesmo áudio.
4. (Opcional, recomendado) Adicionar um botão "Normalizar ritmo" nas configurações do debate que reseta `settings.speed = 1.0, pitch = 0, volume = 1` para todos os personas — evita que presets antigos continuem ditando ritmos quebrados.

### D. Verificação

- Console limpo de "Maximum update depth" ao reproduzir o trecho que falhava.
- Reproduzir `/presentation/cea98432-…`: confirmar que a fala do Enéas termina antes da cartela/réplica e que Marx e Enéas têm ritmo equivalente.
- Cache invalida ao trocar `speed` (testar 1.0 → 1.1 → 1.0 e ouvir diferença).

## Arquivos afetados

- `src/routes/_authenticated/presentation.$id.tsx` — deps dos efeitos, sequência da cartela de bloco, gating do `playbackRate`, chave de cache.
- `src/lib/elevenlabs.server.ts` — aceitar `speed` no payload.
- `src/lib/debate.functions.ts` — propagar `speed` na chamada server (ttsSpeak).
- `src/components/MessageAudioButton.tsx` (e/ou outro componente em lista) — corrigir composição de refs/tooltip que dispara o loop.
- (opcional) `src/components/CastManager.tsx` — botão "Normalizar ritmo".
