## Objetivo

Adicionar mais vozes Inworld (`iw:`) ao catálogo curado em `src/lib/replicate-voices.ts`. Hoje só temos 6 (Hades, Marcus, Theodore, Olivia, Serena, Luna — herdadas do TTS 1.5). O modelo `inworld/realtime-tts-2` na Replicate documenta oficialmente apenas 4 presets, mas aceita qualquer voice ID da plataforma Inworld.

## Mudanças

### 1. `src/lib/replicate-voices.ts` — bloco `iw:` ampliado

Acrescentar as **4 vozes oficiais do TTS-2** (confirmadas no README da Replicate):

| ID | Descrição (do README) |
|---|---|
| `iw:Ashley` | Voz feminina quente e natural |
| `iw:Dennis` | Masculino meia-idade, calmo e amigável |
| `iw:Alex` | Masculino expressivo, levemente nasal |
| `iw:Darlene` | Feminina sulista suave, ideal para narração |

Manter as 6 atuais (Hades, Marcus, Theodore, Olivia, Serena, Luna) — Inworld compartilha pool de vozes entre modelos, então continuam funcionando.

Total: **10 vozes Inworld** no seletor, com rótulos PT-BR claros (gênero + característica).

### 2. Sem mudanças em `voice-replicate.functions.ts`

O resolver já trata o prefixo `iw:` → modelo `inworld/realtime-tts-2` com `{ text, voice }`. Nada a alterar.

### 3. Nota sobre steering (opcional, sem código)

O TTS-2 aceita tags `[say excitedly]`, `[whisper]`, `[laugh]` direto no texto. Não precisa expor isso na UI agora — usuários avançados podem incluir nas falas das personas e funciona automaticamente.

## Fora de escopo

- Cloning Inworld (não existe na Replicate, só via API direta Inworld).
- Adicionar TTS 1.5 Mini/Max separadamente — TTS-2 já é o mais expressivo.
- UI para steering tags.

## Resultado

Seletor de vozes passa a oferecer 4 timbres Inworld oficialmente documentados + os 6 já existentes, totalizando 10 opções `iw:` em PT-BR (graças ao multilingual nativo).
