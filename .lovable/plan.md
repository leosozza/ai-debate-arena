## Objetivo

Usar **Replicate** como terceiro provedor de voz no app, com TTS + clonagem zero-shot, e deixar a infraestrutura pronta para gerar **imagens de avatar** e **vídeos do avatar falando** no futuro.

Replicate é gateway-enabled → todas as chamadas passam por `https://connector-gateway.lovable.dev/replicate/v1/...` com headers `Authorization: Bearer $LOVABLE_API_KEY` + `X-Connection-Api-Key: $REPLICATE_API_KEY` (conector já conectado nesta sessão).

---

## Etapa 1 — Voz (foco agora)

### Backend (`src/lib/replicate.server.ts` + `src/lib/voice-replicate.functions.ts`)

Helper `replicate.server.ts`:
- `createPrediction(model, input)` — POST `/v1/models/<owner>/<name>/predictions`, retorna `id`.
- `pollPrediction(id, { maxMs })` — GET `/v1/predictions/<id>` com backoff 2s→8s (TTS leva 5–60s), nunca usa `urls.get` direto.
- `uploadFile(file: File)` — POST `/v1/files` multipart, retorna `urls.get` (usado para áudios de referência).

Server functions (atrás de `requireSupabaseAuth`):
- **`replicateTts({ text, voiceRef, model })`** — usa `minimax/speech-02-hd` (default, qualidade alta multilíngue + PT-BR ok) ou `lucataco/xtts-v2` quando `voiceRef` for áudio clonado (zero-shot). Retorna `{ audioBase64, mime: "audio/mpeg" }` no mesmo formato dos outros TTS para reaproveitar `<audio>` no front.
- **`cloneVoiceReplicate({ formData })`** — recebe 1 áudio (≤12 MB, mp3/wav/m4a), faz upload via `/v1/files`, guarda a URL retornada como "voiceId" (XTTS-v2 é zero-shot: a URL do sample É a "voz"). Retorna `{ provider: "replicate", voiceId: <fileUrl>, source: "upload-replicate" }`.

### Catálogo (`src/lib/voice-catalog.ts` + novo `src/lib/replicate-voices.ts`)

- Adicionar `"replicate"` em `VoiceProvider`.
- Catálogo curto de presets PT-BR via `minimax/speech-02-hd` (mesmas vozes do MiniMax direto, mas via Replicate — útil quando a conta MiniMax falhar): "Apresentador masc", "Apresentadora fem", "Audiobook masc/fem".
- Vozes clonadas (XTTS-v2) aparecem como "🎙 Personalizada" via lógica já existente em `VoicePicker.tsx`.

### Frontend

- **`VoicePicker.tsx`** — adicionar `"replicate"` no Select de provedor + chamar `replicateTts` na preview.
- **`VoiceClonePanel.tsx`** — adicionar 3º botão **"Clonar com Replicate (XTTS-v2)"** chamando `cloneVoiceReplicate`. Vantagem: zero-shot, funciona com 10–30s de áudio, sem precisar de plano pago.
- **Personas + Apresentação** — nenhuma mudança extra; o fluxo de salvar voz já está pronto.

### Migration (opcional, leve)

Sem mudança de schema: `voice_provider='replicate'` + `voice_id=<file URL ou preset id>` cabe nas colunas existentes. Atualizar apenas o CHECK se existir (não existe hoje).

---

## Etapa 2 — Avatar (imagem) — preparar base

Adicionar coluna `avatar_url text` em `personas` e em `debates` (campos `avatar_url_a`, `avatar_url_b`, `avatar_url_mod`). Nenhuma UI ainda — só schema + tipos. Geração via `black-forest-labs/flux-schnell` ou `flux-1.1-pro` ficará para o próximo turno.

---

## Etapa 3 — Vídeo do avatar falando — só anotar caminho

Sem código agora. Direção técnica anotada no plano: usar `tencent/hunyuan-video-avatar` ou `bytedance/omnihuman` (image+audio → vídeo) consumindo `avatar_url` + áudio gerado pelo TTS. Persistência obrigatória (Replicate expira URLs em ~1h) → bucket `generated` no Storage. Implementar depois que avatar de imagem estiver pronto.

---

## Segurança

- Todas as server fns sob `requireSupabaseAuth`.
- Chaves só no servidor (`process.env.LOVABLE_API_KEY` + `process.env.REPLICATE_API_KEY`).
- Validar FormData: 1 arquivo, ≤12 MB, mime começa com `audio/`.
- Timeout 90s no TTS, 180s no clone.

---

## Verificação

1. Personas → escolher "Replicate" no provedor → preview toca usando minimax via gateway.
2. Personas → "Clonar com Replicate" com áudio curto → voz salva → debate usa essa voz clonada.
3. Apresentação ⚙️ → trocar para Replicate → salvar voz → persiste.

---

## Detalhes técnicos

```
GATEWAY = https://connector-gateway.lovable.dev/replicate/v1
headers = {
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": REPLICATE_API_KEY,
}

# TTS preset
POST /models/minimax/speech-02-hd/predictions
{ "input": { "text": "...", "voice_id": "Portuguese_Male_Anchor" } }

# TTS com voz clonada (XTTS-v2)
POST /models/lucataco/xtts-v2/predictions
{ "input": { "text": "...", "speaker": "<fileUrl>", "language": "pt" } }

# Upload de áudio de referência
POST /files  (multipart: content=<File>)  → { urls: { get: "<persistent url>" } }
```

Output do TTS no Replicate vem como URL → server fn baixa, converte para base64 e devolve no mesmo shape de `minimaxTts`/`ttsSpeak` (`{ audioBase64, mime }`), para não mexer no player.
