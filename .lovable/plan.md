# Plano: ElevenLabs como provider padrão

Agora que o plano Creator está ativo, vamos virar a chave para usar ElevenLabs como padrão em todos os pontos onde hoje o Kokoro é assumido, e reordenar a cascata de clonagem/TTS para começar pelo Eleven.

## 1. Catálogo e defaults globais (`src/lib/voice-catalog.ts`)

- `DEFAULT_VOICE_BY_GENDER`: trocar para Eleven com vozes PT-BR adequadas:
  - `f` → `{ provider: "eleven", voiceId: "<voz feminina padrão do catálogo eleven-voices.ts>" }`
  - `m` → `{ provider: "eleven", voiceId: "<voz masculina padrão>" }`
- `normalizeProvider`: passar a devolver `"eleven"` em vez de `"kokoro"` quando o valor for inválido/nulo (legado "browser" continua mapeado).

## 2. Defaults nas telas de criação/edição

Trocar `"kokoro"` por `"eleven"` (com `voiceId` correspondente do catálogo) nos seguintes pontos:

- `src/routes/_authenticated/new.tsx` — `voiceProviderMod/A/B` iniciais + presets dos repórteres.
- `src/routes/_authenticated/debates.$id.edit.tsx` — mesmos três `voiceProviderMod/A/B`.
- `src/routes/_authenticated/presentation.$id.tsx` — `DEFAULT_SLOT`.
- `src/components/ExportVideoButton.tsx` — fallback quando o provider é desconhecido (linhas 54–66).
- `src/components/VoicePicker.tsx` — `provider ?? "kokoro"` (linha 39) vira `?? "eleven"`.
- `src/lib/persona.functions.ts` e `src/routes/_authenticated/new.tsx` linha 156 — fallback do `voice_provider` lido do banco passa a ser `"eleven"` em vez de `"kokoro"`.

Kokoro/Piper continuam disponíveis no seletor como opção grátis; só deixam de ser o padrão.

## 3. Cascata de clonagem (`src/lib/voice-clone.functions.ts`)

A ordem já é Eleven → MiniMax → Replicate, então nada muda no `cloneVoiceCascade`. Vou apenas:

- Atualizar a copy do botão em `src/components/VoiceClonePanel.tsx` para deixar explícito que tenta ElevenLabs primeiro (já é o caso, mas reforçar no texto auxiliar).
- Em `cloneVoiceReplicate`, manter como caminho avançado (só usado quando o usuário escolhe "Só Replicate").

## 4. Cascata de TTS

Não existe hoje uma cascata de TTS — cada provider é chamado direto pelo `VoicePicker` / engines. O TTS do Eleven (`elevenTTS` em `src/lib/elevenlabs.server.ts`) já está pronto e é o caminho usado quando `provider === "eleven"`. Com o passo 2, ele passa a ser o caminho padrão automaticamente.

## 5. O que NÃO muda

- Vozes Replicate/Inworld continuam no catálogo e selecionáveis.
- Nenhuma migração no banco: personas/debates já salvos mantêm o provider gravado. Só personas/debates novos (e fallbacks de leitura quando o valor está vazio) passam a usar Eleven.
- `voice-replicate.functions.ts`, `replicate-voices.ts`, presets de clone Replicate — intocados.

## Detalhes técnicos

- Vozes default escolhidas a partir de `src/lib/eleven-voices.ts` (vou ler o arquivo e pegar a primeira voz PT-BR de cada gênero; provavelmente algo como Sarah/EXAVITQu4vr4xnSDxMaL para `f` e George/JBFqnCBsd6RMkjVDRZzb para `m`, ajustando se o catálogo do projeto já tiver vozes PT-BR específicas marcadas).
- Como `normalizeProvider` passa a devolver `"eleven"`, qualquer código que dependa de `provider === "kokoro"` como rota grátis continua funcionando (o usuário ainda pode escolher Kokoro manualmente).
- Sem mudanças em schema, RLS, edge functions ou migrations.
