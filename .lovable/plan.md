## O que vou mudar

### 1. Seleção de voz por participante (mix de provedores)
Hoje o seletor escolhe **um provedor global** e depois lista vozes só dele. Vou inverter a lógica:

- Remover o seletor de "Provedor de voz" global no topo.
- Cada participante (Mediador, Debater A, Debater B) terá seu próprio bloco com:
  - **Seletor de Provedor** (Navegador / Replicate / ElevenLabs / MiniMax)
  - **Seletor de Voz** populado conforme o provedor escolhido
  - Botão de preview
  - Painel "Ajustes de voz" (speed/pitch/volume) já existente
- O estado salvo no debate passa de `{ provider, voices: { mod, a, b } }` para `{ mod: { provider, voiceId, settings }, a: {...}, b: {...} }`.
- Migração leve no `voice_settings` da `personas` + campo no `debates` para suportar a nova forma; manter compatibilidade lendo o formato antigo.
- No playback (`presentation.$id.tsx` arena), escolher o caminho de síntese (browser/replicate/elevenlabs/minimax) por participante em vez de um provider único.

### 2. Avatar da persona aparecer na apresentação
- Em `presentation.$id.tsx` e na arena, quando o debater A/B vier de uma persona com `image_url`, mostrar o avatar (componente `Avatar`) ao lado do nome no card de fala e no header. Hoje só usa iniciais.
- Carregar `image_url` no `getDebate`/`listPersonas` que alimenta a tela (verificar se já vem; se não, incluir no select).

### 3. Mais vozes no Replicate
- Trocar a lista hardcoded por **MiniMax `speech-2.5-hd` / `speech-02-turbo` no Replicate** com o catálogo completo de vozes (≈100 vozes em PT/EN/ES, com presets male/female por idioma) em vez das poucas opções atuais.
- Agrupar no dropdown por idioma e gênero para ficar navegável.
- Manter clonagem de voz Replicate como opção separada (já existe).

## Arquivos afetados
- `src/components/VoicePicker.tsx` — refatorar para "por-participante".
- `src/routes/_authenticated/presentation.$id.tsx` — usar novo formato + renderizar avatares.
- `src/routes/_authenticated/debates.$id.arena.tsx` — idem (avatar + roteamento de provider por fala).
- `src/lib/voice-replicate.functions.ts` / catálogo de vozes Replicate — expandir lista.
- `src/lib/debate.functions.ts` (ou equivalente que salva voice config) — aceitar novo shape com fallback para o antigo.
- Migração SQL: ampliar `debates.voice_config` (jsonb) se necessário.

## Não vou mexer
- Lógica de criação de personas, geração de imagem por IA, ou TTS server-side de ElevenLabs/MiniMax (já funcionam).
- Clonagem de voz Replicate.