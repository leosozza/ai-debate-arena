## Objetivo

Elevar a qualidade da clonagem usando **cascata automática** com o melhor provedor primeiro:
**ElevenLabs (IVC) → MiniMax (speech-02-hd) → Replicate (Chatterbox)**.

Hoje o botão principal aponta para Fish Audio (Replicate), que tem soado artificial. ElevenLabs e MiniMax já estão conectados e produzem qualidade muito superior em PT-BR.

## Mudanças

### 1. `src/lib/voice-clone.functions.ts` — nova função em cascata
- Adicionar `cloneVoiceCascade` que aceita o mesmo `FormData` (name + files) e tenta na ordem:
  1. **ElevenLabs IVC** (`/v1/voices/add`) — melhor qualidade, voz permanente reutilizável.
  2. **MiniMax** (upload + `/v1/voice_clone`) — fallback se Eleven retornar 401/402/422.
  3. **Replicate** (upload do áudio → URL com prefixo `chatterbox:`) — último recurso.
- Cada tentativa loga o motivo da falha; retorna `{ provider, voiceId, name, source, fallbackChain: string[] }`.
- Salvar resultado em `voice_presets` com `is_real_person: true` e `name` incluindo o provedor usado (ex: "Dr. Enéas (ElevenLabs)") para o usuário saber qual ficou.

### 2. `src/lib/voice-replicate.functions.ts` — trocar default Fish→Chatterbox
- Em `cloneVoiceReplicate`, trocar o prefixo retornado de `fish:` para `chatterbox:` (Chatterbox multilingual tem qualidade mais consistente que Fish 1.5 em PT-BR).
- Manter cascata interna `chatterbox → xtts → fish` no `replicateTts` para tocar clones existentes.

### 3. `src/components/VoiceClonePanel.tsx` — UI simplificada
- Botão principal: **"Clonar voz (qualidade máxima)"** chamando `cloneVoiceCascade`.
- Mostrar no toast de sucesso qual provedor foi efetivamente usado (ex: "Voz clonada via ElevenLabs ✓").
- Manter botões individuais Eleven/MiniMax/Replicate como "avançado" (collapsable) para quem quiser forçar.
- Atualizar texto de ajuda: "Tenta ElevenLabs → MiniMax → Replicate automaticamente. Envie 30s–2min de fala limpa em PT-BR."

### 4. Re-clonar vozes existentes
- Em `src/routes/_authenticated/personas.tsx` (ou onde lista presets), adicionar botão **"Re-clonar com qualidade máxima"** ao lado de cada preset Fish/Replicate antigo.
- O botão baixa o `voice_url` original do preset, embrulha em `File`, e chama `cloneVoiceCascade` com o mesmo nome + sufixo " (HD)".
- Novo preset aparece como item separado; o antigo permanece intacto.

### 5. Sem mudanças de schema
- Tabela `voice_presets` já tem todos os campos (`name`, `voice_url`, `is_real_person`, `user_id`).
- Nenhum secret novo (Eleven, MiniMax, Replicate já conectados).

## Resultado esperado

- Toda nova clonagem tenta ElevenLabs primeiro (qualidade de estúdio); se o plano Eleven não permitir IVC, cai para MiniMax HD; só vai para Replicate em último caso.
- Usuário pode re-clonar vozes Fish antigas com um clique e comparar lado a lado.
