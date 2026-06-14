## Implementação: prioridades 1–6 (4 entregas)

Vou agrupar em 4 commits sequenciais para entregar valor por etapa. Você poderá testar entre cada uma.

---

### Entrega A — Adaptive speech length + Phase tags (itens 1 e 5)

**Objetivo:** falas com o tamanho certo por fase + base para SSML.

- Novo `src/lib/phase-style.ts` — para cada fase devolve `{ maxWords, ssmlPace, ssmlPauseAfter, role }`:
  - `abertura`/`vinheta` → 130 palavras, ritmo médio
  - `réplica` → 90 palavras, ritmo rápido
  - `contribuição`/`ângulo` → 130, médio reflexivo
  - `considerações finais` → 70, lento
  - `veredito` → 200, lento com pausas
  - `pergunta-incisiva` → 50, urgente
  - `síntese` → 70, médio
  - `acusação`/`defesa` → 170, médio firme
  - `fechamento` → 35, lento contemplativo
- Refatorar `multi-debate.functions.ts` para usar `phase-style.maxWords` em vez dos hard-codes "Máximo 170 palavras" espalhados (mantém os ajustes específicos das engines).
- `src/lib/ssml.ts` (novo) — `wrapSSML(text, phaseStyle)`: injeta `<prosody rate="...">` + `<break time="500ms"/>` em pontos e travessões; sanitiza para Kokoro/Piper (que não suportam SSML) devolvendo texto puro com base nos mesmos sinais (usa quebras `...`).
- `tts.functions.ts` (MiniMax): aceita opção `phase?: string` e ajusta `speed`/`vol` por fase.
- ElevenLabs (`src/lib/elevenlabs.server.ts`): wrap em SSML quando o provider suportar.

---

### Entrega B — Trilha sonora adaptativa + SFX por fase (item 2)

**Objetivo:** áudio ambiente e SFX por fase, sem novos assets externos.

- Estender `src/lib/sfx.ts` com **pads sintetizados em loop** (música ambiente leve via OfflineAudioContext, ~8s loopáveis):
  - `bed_intro` (notas suspensas, abertura)
  - `bed_tension` (drone grave, réplicas)
  - `bed_reflective` (pad maior 7ª, sages/century)
  - `bed_verdict` (acorde menor solene, veredito)
- Mapa `phaseToBed(phase, engineId)` em novo `src/lib/phase-audio.ts`.
- `video-export.ts` + `presentation.$id.tsx`: mistura o bed (volume -18dB) embaixo da fala da fase atual; transição via crossfade de 800ms na troca.
- SFX automáticos no início de cada fase chave (ding na vinheta, drumroll antes do veredito, applause no fechamento) controlados pelo mesmo mapa.

---

### Entrega C — Plot twists + Long-term memory (itens 3 e 6)

**Objetivo:** mediador injeta reviravoltas; personas lembram do que disseram.

- **Plot twists**: novo helper `maybeInjectTwist(debate, transcript, blockIndex)` em `multi-debate.functions.ts`. Antes da última réplica de cada bloco intermediário (probabilidade 35%), o mediador gera um turn de fase `reviravolta` (já existe no schema) com um fato novo / hipótese contrária / dado polêmico. Injeta como `role:"moderator", phase:"reviravolta"` e adia o turno seguinte. Já existe estrutura — basta ativar via `engine.allowsTwist: boolean` opcional (true para roundtable/presidential/era_clash/ideas_war, false para sages/century/tribunal/interview).
- **Long-term memory**: novo helper `personaMemoryDigest(transcript, speakerRole)` — antes de cada fala não-moderador, extrai (regex + slice) as 3 últimas frases que ESSE persona disse e injeta no system prompt como `MEMÓRIA — você mesmo já disse: "..."` e `MEMÓRIA — os outros disseram sobre você: "..."`. Reduz contradições e cria callbacks naturais. Custo zero (não usa IA, só processa transcript existente).

---

### Entrega D — Shorts 9:16 com melhores momentos (item 4)

**Objetivo:** gerar 1 short vertical de 45–60s pós-export.

- `src/lib/shorts.functions.ts` (server) — input: `debateId`. Fluxo:
  1. Carrega `debate_messages` ordenados.
  2. Pede à IA (chatComplete, gemini-flash) para apontar os 3 melhores trechos: ranking por densidade/atrito, retorna `[{ messageId, startWord, endWord, reason }]` em JSON.
  3. Retorna o plano (não renderiza vídeo no servidor — workerd não tem ffmpeg).
- `src/lib/shorts-export.ts` (client) — recebe o plano e usa o mesmo pipeline do `video-export.ts` para gerar MP4 9:16 (1080×1920): crop centralizado dos `SpeakerCard` em vertical + legenda grande embaixo + bed_tension de fundo.
- Botão "📱 Exportar short (60s)" no `presentation.$id.tsx` ao lado do "Exportar vídeo".

---

### Fora de escopo (consenso anterior)

- Geração de música via ElevenLabs Music API (custo alto + latência por export). Usaremos beds sintetizados.
- Avatares animados, cronômetro visual, mapa de conexões — ficam para próxima rodada.

---

### Ordem sugerida

A → B → C → D, cada uma em commit próprio. Posso começar pela A agora?
