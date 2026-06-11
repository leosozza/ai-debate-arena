## Problema

Hoje o fluxo de abertura está assim:

```text
1. Card de aviso de IA (sem áudio)
2. Preparing (carrega vozes/vinhetas)
3. Vinheta cinemática (só música)
4. OpeningSequence visual (A → B → VS, sem narração)
5. Live: mediador narra o aviso + apresenta os convidados (de novo!)
6. Debate
```

Resultado: começo mudo, ordem confusa, convidados são apresentados duas vezes (uma só visual, outra só voz).

## Objetivo

Carregar tudo primeiro e só depois o apresentador entra no ar narrando aviso + apresentação dos convidados — uma vez só.

```text
1. Tela inicial "Iniciar transmissão" (única coisa que precisa de clique, libera autoplay)
2. Preparing — gera todas as vozes e vinhetas (tela de loader, sem som)
3. Vinheta cinemática Legends Arena + tema (música, sem narração — curta)
4. Live (mediador no ar):
   a) Mediador narra o aviso de IA (com card visual de aviso ao fundo)
   b) Mediador apresenta o tema e os dois convidados (com card visual A/B/VS ao fundo)
   c) Segue o debate normalmente
```

## Mudanças

### `src/routes/_authenticated/presentation.$id.tsx`

- Remover a fase `"opening"` da máquina de estados. Nova sequência: `disclaimer-cta → preparing → vignette → live`.
- Não renderizar mais `<OpeningSequence>`. A apresentação visual dos convidados passa a ser feita pelo próprio palco (stage) enquanto o mediador fala — usando as duas mensagens virtuais que já existem (`__opening_disclaimer__` e `__opening_guests__`).
- No final da `vignette` (`onDone`), ir direto para `live` e `setPlaying(true)` para o mediador começar a falar imediatamente.
- Garantir que `ensureAudioEl()` é chamado no clique inicial "Iniciar transmissão" (preserva permissão de autoplay no iOS mesmo após o preparing longo).
- Encurtar a vinheta (~3,5s) para não atrasar a entrada do mediador.

### `src/routes/_authenticated/presentation.$id.tsx` — diagnóstico das vozes dos debatedores

- Quando uma fala de A/B cair para voz do navegador por falta de `voiceId`, mostrar um toast com link claro ("Definir voz") em vez de só falhar silenciosamente. Isso explica o "voz do Enéas não funcionou".
- Garantir que `hydrate` aplique `persona.voice_id` sempre que a persona tiver voz definida (já faz, mas blindar caso `personas` chegue depois de `debate`, re-hidratando uma vez).

### `src/components/OpeningSequence.tsx`

- Mantido no repositório mas não usado mais pela apresentação (pode ficar para futuro reaproveitamento). Sem edição.

### Visual durante a narração de abertura

- Quando `current.id === "__opening_disclaimer__"`: o palco mostra o card de **Aviso de IA** em destaque enquanto o mediador narra.
- Quando `current.id === "__opening_guests__"`: o palco mostra **A / VS / B** com fotos e descrições enquanto o mediador apresenta.
- A partir da terceira mensagem, palco normal de debate.

## Não muda

- Exportação MP4 (a sequência lá já reflete: disclaimer narrado → vinheta → intro guests → debate).
- Lógica de TTS, cache, fallback e providers.
- Estrutura de mensagens no banco.

## Validação

- Clicar "Iniciar transmissão" → ver loader de preparação → ver vinheta curta com música → ouvir mediador narrar aviso → ouvir mediador apresentar os convidados → ouvir A e B falarem normalmente.
- Sem duplicação de apresentação. Sem trechos mudos no começo.
