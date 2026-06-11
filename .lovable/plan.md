# Mais vozes PT-BR de alta qualidade no Replicate

Hoje o provedor "Replicate" usa só `minimax/speech-02-hd` (presets) e `lucataco/xtts-v2` (clone). Vamos expandir com 3 modelos novos e um catálogo curado em português brasileiro.

## 1. Novos modelos no backend

Em `src/lib/replicate-voices.ts` e `src/lib/voice-replicate.functions.ts`:

- **`minimax/speech-02-turbo`** — mesmos `voice_id` do HD, ~3× mais rápido, mais barato. Bom para preview/iteração rápida.
- **`resemble-ai/chatterbox-multilingual`** — TTS PT-BR nativo, ~7s, ~$0.007/run. Suporta `language_id: "pt"`, controle de emoção (`exaggeration`) e clone via `audio_prompt_path`. Vira a melhor opção de clone (substitui XTTS como padrão; XTTS fica como fallback).
- **`lucataco/fish-speech-1.5`** — clone zero-shot de alta fidelidade (~96s, ~$0.09/run). Opção "premium" quando qualidade > latência.

A função `replicateTts` ganha um parâmetro `model?: "minimax-hd" | "minimax-turbo" | "chatterbox" | "fish" | "xtts"` (default decidido pelo formato do `voiceId`: preset MiniMax → `minimax-hd`; URL → `chatterbox`).

## 2. Catálogo curado PT-BR

Novo array `REPLICATE_PT_BR_VOICES` em `replicate-voices.ts`, agrupado por categoria:

- **Apresentação:** Apresentador (M), Apresentadora (F), Locutor de TV grave (M), Repórter (F)
- **Narração:** Narrador audiobook (M), Narradora audiobook (F), Narrador documentário (M)
- **Personagens:** Jovem energético (M), Jovem doce (F), Voz infantil (F), Senhor sábio (M), Vilão grave (M)
- **Já existentes:** mantém presets em inglês e personagens MiniMax como seções colapsadas

Cada voz mapeia para um `voice_id` MiniMax + `language_boost: "Portuguese"` ou um preset Chatterbox + áudio de referência interno (subimos amostras PT-BR uma única vez via migration/seed e guardamos o URL persistente).

## 3. UI — `src/components/VoicePicker.tsx`

- Quando provider = **Replicate**, adicionar um segundo seletor **"Modelo"** com 4 opções: `Chatterbox (recomendado PT-BR)`, `MiniMax HD`, `MiniMax Turbo`, `Fish Speech (premium)`.
- O `Select` de vozes passa a mostrar 3 grupos: **🇧🇷 PT-BR curado** (novo, topo), **🎭 Meus presets clonados**, **Catálogo geral**.
- Persistir escolha de modelo junto com `provider`/`voiceId` no participante (precisa de coluna nova).

## 4. Schema

Migration: adiciona `voice_model text` em `debate_participants` e `personas` (nullable, default null → comportamento atual). Re-grants padrão.

## 5. Detalhes técnicos

- **Chatterbox input shape:** `{ prompt, language_id: "pt", audio_prompt_path?: url, exaggeration: 0.5, cfg_weight: 0.5 }`. Saída: URL de áudio (mesma lógica `pickUrl`).
- **Fish Speech input shape:** `{ text, reference_audio?: url, reference_text?: string }`. ~90s de espera → aumentar `maxMs` para 240_000 só nessa branch.
- **XTTS continua existindo** como fallback para presets antigos que apontam para URLs já cadastradas (compat).
- Vozes PT-BR curadas que dependem de áudio de referência (Chatterbox) usam amostras de domínio público (~10s cada) hospedadas no bucket `persona-videos` existente (ou novo `voice-samples` público); URLs ficam hardcoded no catálogo.

## 6. Fora de escopo

- Não mexer no provedor MiniMax direto (`src/lib/tts.functions.ts`) — continua igual.
- Não alterar provedor Browser/ElevenLabs.
- Não criar feature de "mistura" entre modelos.

## Arquivos afetados

- editar `src/lib/replicate-voices.ts` (catálogo + ids dos novos modelos)
- editar `src/lib/voice-replicate.functions.ts` (roteamento por `model`)
- editar `src/components/VoicePicker.tsx` (seletor de modelo + grupo PT-BR)
- editar `src/lib/voice-catalog.ts` (re-exporta o novo grupo PT-BR)
- migration: adicionar `voice_model` em `personas` e `debate_participants`
- editar `src/lib/debate.functions.ts` / fluxos que falam → passar `model` para `replicateTts`
- subir 6–8 amostras curtas PT-BR ao bucket (uma vez, via script no-op em produção)

## Riscos

- Chatterbox no Replicate cobra por segundo de GPU; vozes "curadas" que dependem de referência têm custo um pouco maior que MiniMax preset. Mitigação: marcar quais são "preset puro" (barato) vs "referência" (médio) no label.
- Fish Speech leva ~90s; UI deve mostrar progresso. Mitigação: já temos toast/spinner; só ajustar timeout.
