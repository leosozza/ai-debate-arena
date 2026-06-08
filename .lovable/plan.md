
# Plano: Arena de Debates entre IAs

App onde você define um tema, uma IA mediadora cria as regras do debate, e duas IAs debatem em turnos. O resultado vira um roteiro em texto e um "modo apresentação" com voz (Web Speech API) que você grava com OBS/captura de tela para subir no YouTube.

## Fluxo do usuário

1. **Login** (Lovable Cloud — email/senha + Google).
2. **Novo debate** → tela com formulário:
   - Tema (campo de texto)
   - Nome e personalidade da IA A (ex: "Aurora — defensora da posição X")
   - Nome e personalidade da IA B
   - Tom do mediador (formal, descontraído, acadêmico)
   - Nº de rodadas (3–6)
3. **Mediador gera as regras** → IA cria: introdução do tema, regras do debate, ordem das falas, critérios de avaliação. Você revisa e pode editar antes de iniciar.
4. **Debate executa** → o app chama a IA para cada fala em sequência (Mediador → IA A → IA B → IA A → IA B → ... → Considerações finais → Veredito do mediador). Falas aparecem em tempo real estilo chat.
5. **Modo apresentação / gravação** → tela cheia com nome de quem está falando, avatar/cor, e a fala sendo lida em voz alta pela Web Speech API. Controles play/pause/próxima fala. Você grava a tela com OBS para gerar o vídeo do YouTube.
6. **Biblioteca** → lista todos os seus debates salvos, com opções de reabrir, re-executar o modo apresentação, exportar o roteiro em `.txt`/`.md`, ou duplicar.

## Sobre o vídeo final (importante)

Web Speech API roda só no navegador e **não gera um arquivo MP3/MP4** — ela apenas fala. Para o YouTube, o caminho prático é:

- App fornece o **modo apresentação** (visual bonito + voz sintetizada tocando).
- Você grava a tela com **OBS Studio** (grátis) ou similar → gera o MP4 pronto pra subir.

Renderização automática server-side de MP4 com Web Speech não é viável. Se mais tarde quiser MP4 gerado automaticamente, dá pra plugar ElevenLabs + Remotion num passo futuro.

## Arquitetura

- **Frontend**: TanStack Start, rotas `/auth`, `/_authenticated/`, `/_authenticated/new`, `/_authenticated/debates`, `/_authenticated/debates/$id`, `/_authenticated/debates/$id/present`.
- **Backend (Lovable Cloud)**:
  - Tabelas: `debates` (tema, config, status, owner), `debate_messages` (debate_id, ordem, papel: mediador/a/b, conteúdo, fase: regras/abertura/rodada/final/veredito).
  - RLS: cada usuário só vê seus próprios debates.
- **IA (Lovable AI Gateway)**:
  - Server function `generateRules` — recebe tema/configs, devolve regras estruturadas.
  - Server function `generateNextTurn` — recebe histórico + papel da próxima fala, devolve a fala. Stream para UI responsiva.
  - Modelo padrão: `google/gemini-3-flash-preview`.
- **TTS**: Web Speech API no cliente, com seletor de voz por debatedor (vozes pt-BR disponíveis no navegador).
- **Modo apresentação**: tela cheia, card grande com nome/cor do falante, texto destacado palavra-a-palavra conforme o `SpeechSynthesisUtterance` dispara `onboundary`, auto-avança pra próxima fala.

## Telas

```
/auth                         Login/cadastro
/                             Landing pública (explica o app)
/_authenticated/              Dashboard (botão "Novo debate" + últimos)
/_authenticated/new           Wizard: tema → personagens → tom → revisar regras → iniciar
/_authenticated/debates       Biblioteca
/_authenticated/debates/$id   Detalhe: roteiro completo, editar, exportar, apresentar
/_authenticated/debates/$id/present  Modo apresentação fullscreen para gravar
```

## Entregas desta primeira versão

1. Auth + Cloud + esquema do banco.
2. Wizard de criação + geração de regras pela IA mediadora.
3. Execução do debate com streaming das falas.
4. Biblioteca + exportar roteiro `.md`.
5. Modo apresentação com Web Speech API e seletor de vozes.

Visual: tema escuro estilo "estúdio de podcast/arena", tipografia forte, cores distintas para cada debatedor.
