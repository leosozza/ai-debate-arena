# Plano: Clonagem de voz que realmente funciona

## Diagnóstico

Hoje "clonar com Replicate" só **faz upload** do áudio e devolve a URL, que depois é usada como referência *zero-shot* pelo Chatterbox (default quando o `voiceId` é uma URL crua). Problemas conhecidos desse caminho:

- Chatterbox é um modelo da comunidade — exige resolver versão, é instável e frequentemente devolve áudio vazio/curto, caindo no erro "Modelo devolveu áudio vazio".
- Não há feedback claro de qual modelo gerou — o usuário só vê "não funcionou".
- Não há retry/fallback automático para outro modelo de clone.

## Mudanças

### 1. Priorizar Fish Audio (`lucataco/fish-speech-1.5`) para áudio com referência

Em `src/lib/replicate-voices.ts` → `resolveReplicateVoice()`: quando o `voiceId` for uma URL `https://...` crua (caso pós-upload), passar a rotear para **fish** ao invés de chatterbox. Chatterbox vira opção explícita via prefixo `cb:`.

### 2. Tornar `cloneVoiceReplicate` mais robusto

Em `src/lib/voice-replicate.functions.ts`:
- Continuar fazendo upload do áudio para obter URL persistente.
- Marcar o `voiceId` retornado com prefixo `fish:` explícito (em vez de URL crua) para evitar ambiguidade futura.
- Validar duração mínima (avisar se < 5s) e formato.

### 3. Fallback em cascata no `replicateTts`

Quando o modelo é de clone (fish/chatterbox/xtts) e a chamada falha (erro, áudio vazio, timeout), tentar automaticamente o próximo na ordem:
1. `fish` (lucataco/fish-speech-1.5) — premium, mais consistente
2. `xtts` (lucataco/xtts-v2) — legado, mais permissivo
3. `chatterbox` — última tentativa

Log de qual modelo serviu o áudio para debug.

### 4. UI no `VoiceClonePanel`

- Renomear botão "Replicate (XTTS-v2)" → **"Clonar com Fish Audio (Replicate)"**.
- Mensagem de ajuda atualizada: "Fish Audio: 10–30s de fala limpa, melhor qualidade zero-shot para PT-BR".
- Mostrar qual modelo foi usado no toast de sucesso.

### 5. Persistência da URL de clone

O upload do Replicate é persistente (não expira em 1h como `replicate.delivery`), então o `voiceId` `fish:<url>` continua funcionando entre sessões. Sem mudança de banco.

## Arquivos afetados

- `src/lib/replicate-voices.ts` — roteamento de URL crua → fish; novo prefixo `fish:` documentado.
- `src/lib/voice-replicate.functions.ts` — retornar `voiceId` com prefixo `fish:`, validações, fallback em cascata no `replicateTts`.
- `src/components/VoiceClonePanel.tsx` — textos do botão e mensagem.

## Fora de escopo

- Webhooks assíncronos (a sandbox de runtime aguenta os ~30–60s típicos de fish-speech; só viraria necessário se passar de 5min).
- Trocar provedor padrão para MiniMax (você pediu Fish + fallback).
- Mexer no ElevenLabs/MiniMax existentes — continuam disponíveis como botões alternativos.
