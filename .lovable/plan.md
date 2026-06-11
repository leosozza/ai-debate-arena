
## O que vamos resolver

1. **Voz do Enéas ficou muda** — quando uma persona usa voz clonada (Replicate), às vezes o áudio não toca e o usuário não entende por quê.
2. **Texto fica estático e cortado** — falas longas não cabem na tela; o usuário quer rolagem automática estilo **teleprompter**, acompanhando a fala.
3. **Início do MP4 exportado fica mudo** — os primeiros 4 segundos (aviso de IA) não têm som.

---

## 1. Voz clonada (Enéas) — diagnóstico + correção

**Causa provável:** o `voiceId` salvo é uma URL "crua" (sem prefixo), que cai no modelo legado **XTTS v2**. XTTS v2 às vezes devolve áudio vazio ou expira sem erro claro. O `catch` engole o erro e tenta o navegador, mas no celular o `play()` falha em silêncio porque o gesto inicial já se "perdeu" após o await longo.

**Mudanças:**

- **`src/lib/voice-replicate.functions.ts`** — quando o `voiceId` é uma URL sem prefixo, mudar o **default de XTTS → Chatterbox** (`cb:`). Chatterbox é o modelo nativo em PT-BR e é o que recomendamos no seletor.
- **`src/lib/replicate.server.ts`** (ou onde está `runPrediction`) — validar que `output` tem áudio real (tamanho > 1KB depois do `fetchAsBase64`); caso contrário, lançar erro explícito `"Modelo devolveu áudio vazio"`.
- **`src/routes/_authenticated/presentation.$id.tsx`**:
  - Quando o TTS falhar e cair para o navegador, mostrar **um toast persistente com o motivo real** (não só "indisponível") e exibir um pequeno aviso ⚠ no painel do debatedor ativo: "Voz clonada falhou — usando voz do navegador".
  - No `speak()`, se o provider falhar, NÃO usar `browserSpeak` em silêncio: tocar um beep curto antes para o usuário perceber a troca.
  - Adicionar botão "🔁 Tentar de novo" no painel do debatedor quando a última fala falhou.

---

## 2. Teleprompter (texto rolando junto com a fala)

Hoje a fala do mediador e dos debatedores aparece como um `<p>` único — se for longa, parte do texto fica escondida.

**Novo componente:** `src/components/Teleprompter.tsx`
- Recebe `text`, `active` (está falando agora?), `durationMs` (duração do áudio quando disponível).
- Quebra o texto em **palavras/sentenças**, destaca a sentença "atual" (highlight amarelo suave) e faz auto-scroll suave do contêiner para manter o destaque no centro.
- Quando `durationMs` é conhecido (áudio TTS pré-gerado): scroll linear baseado em tempo.
- Quando não há duração (voz do navegador): scroll baseado em estimativa (≈ 14 caracteres/segundo em PT-BR) + sync com `SpeechSynthesisUtterance.onboundary` para palavras quando disponível.
- Sempre exibe o **texto inteiro** rolável (sem corte).

**Integração em `presentation.$id.tsx`:**
- Substituir os `<p>{speakerContent}</p>` (mediador e `StageDebaterPanel`) por `<Teleprompter text={speakerContent} active={…} durationMs={currentAudioDurationMs} />`.
- Expor `currentAudioDurationMs` a partir do `<audio>`: quando carrega o `src` no `speak()`, ler `audio.duration` no `onloadedmetadata` e guardar em state.
- Para a voz do navegador, usar `utterance.onboundary` para emitir um "tick" de palavra → o teleprompter avança.

**Visual:** caixa com altura limitada (~3 linhas md/4 linhas mobile), `overflow-hidden`, gradiente de fade nas bordas superior/inferior, fonte ligeiramente maior, kerning de notícia.

---

## 3. Áudio na abertura do MP4 exportado

Hoje `seg_disclaimer.mp4` tem 4s de **silêncio** (`anullsrc`). Solução:

- Embutir a **música de abertura** (`src/assets/legends-opening.mp3.asset.json`, já presente) no segmento de disclaimer e também num novo segmento **"vinheta"** de ~6s (logo + tema), igual ao que toca ao vivo no `OpeningVignette`.
- Em `src/lib/video-export.ts`:
  - Buscar a URL da música via `import musicAsset from "@/assets/legends-opening.mp3.asset.json"`, fazer `fetchBytes(musicAsset.url)`, gravar como `opening.mp3` no FFmpeg.
  - Trocar o `-f lavfi -i anullsrc` do segmento `seg_disclaimer` por `-i opening.mp3` (com fade in/out para não cortar bruscamente).
  - Adicionar novo segmento `seg_vignette.mp4` (~6s) com um frame "LEGENDS ARENA · tema" (função nova `drawVignetteFrame`) e a continuação da música.
  - Ordem final dos segmentos: `disclaimer (4s) → vignette (6s) → intro (msg 0) → demais falas`.
- Garantir que `-c copy` no concat ainda funcione: todos os segmentos devem usar **mesmo codec/sample rate/fps** (já são `libx264/aac/24fps/44100Hz`).

---

## Arquivos tocados

- **Editar** `src/lib/voice-replicate.functions.ts` — default Chatterbox para URLs sem prefixo.
- **Editar** `src/lib/replicate.server.ts` — validação de áudio vazio.
- **Criar** `src/components/Teleprompter.tsx`.
- **Editar** `src/routes/_authenticated/presentation.$id.tsx` — usar Teleprompter, expor duração do áudio, aviso visual quando voz cai para navegador, botão "tentar de novo".
- **Editar** `src/lib/video-export.ts` — música no disclaimer + novo segmento vinheta.

## Fora do escopo (não vou mexer agora)

- Renderizar a animação completa do `OpeningVignette` (partículas, scanlines) dentro do MP4 — só um frame estático com a música, porque animar tudo em canvas seria ~10× mais lento de exportar.
- Sincronização palavra-por-palavra perfeita em vozes clonadas (Replicate não devolve word timestamps); usaremos o scroll linear baseado em duração do áudio, que é o padrão dos teleprompters de TV.
- Trocar o motor de TTS do Enéas para outro provider (mantemos Replicate; só corrigimos o default).
