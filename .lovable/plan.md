## Objetivo
Usar o conector Replicate (já ligado) para:
1. Oferecer **FLUX** como alternativa de geração de imagem ao lado do Gemini atual.
2. Criar **vinhetas de vídeo** (estilo Veo3) para cada persona, animando a foto + descrição com áudio ambiente.

Tudo armazenado em buckets privados com URL assinada de longa duração (1 ano), seguindo o padrão já usado em `persona-images`.

---

## 1. Backend — Replicate helpers (já existem)
`src/lib/replicate.server.ts` e `src/lib/replicate-voices.ts` já fornecem `runPrediction`, `uploadFile`, `fetchAsBase64`, `createPredictionByVersion`. Reusar sem mudanças.

## 2. Novo storage bucket
Migração: criar bucket privado `persona-videos` (mesmo padrão de `persona-images`, signed URLs).

## 3. Imagem via Replicate — `src/lib/persona-image-replicate.functions.ts` (novo)
- `generatePersonaImageReplicate({ name, description, model })`
  - `model`: `"flux-schnell"` (rápido/barato) ou `"flux-1.1-pro"` (alta qualidade)
  - Constrói prompt fotorrealista (mesma estrutura do Gemini atual)
  - `runPrediction("black-forest-labs/flux-schnell" | "black-forest-labs/flux-1.1-pro", { prompt, aspect_ratio: "1:1", output_format: "png" })`
  - Baixa output, faz upload em `persona-images` (reusa helper), retorna signed URL.

## 4. Vídeo (vinheta) — `src/lib/persona-video.functions.ts` (novo)
Estratégia escolhida pelo agente, com fallback automático:

1. **Tenta `google/veo-3-fast`** (image-to-video com áudio, ~30–90s render):
   - Faz upload da imagem da persona como `input_image`
   - Prompt: descrição da persona + "vinheta cinematográfica curta, retrato falando, ambiente coerente, áudio ambiente discreto", `duration: 8`, `aspect_ratio: "9:16"` ou `"16:9"` (escolha do usuário na UI).
2. **Fallback `wan-video/wan-2.2-i2v-fast`** se Veo falhar (sem áudio, ~1 min).

Função:
- `generatePersonaVignette({ personaId, aspectRatio, withAudio })`
  - Carrega persona (precisa ter `image_url`)
  - Faz upload da imagem para Replicate (`uploadFile`)
  - Cria predição, faz poll com `maxMs: 540_000` (9 min, dentro do limite de 600s do server function)
  - Baixa o MP4, faz upload no bucket `persona-videos/{userId}/{uuid}.mp4`, gera signed URL
  - Persiste em nova coluna `personas.vignette_url` + `personas.vignette_model`

Migração SQL:
```
alter table public.personas
  add column if not exists vignette_url text,
  add column if not exists vignette_model text;
```

## 5. UI

### 5a. `PersonaImagePanel` (existente)
Adicionar um `<Select>` de "Provedor" antes do botão "Gerar com IA":
- "Gemini (com referências da web)" — comportamento atual
- "FLUX Schnell (rápido)" — chama nova função
- "FLUX 1.1 Pro (alta qualidade)" — chama nova função

O botão "Gerar com IA" roteia para a função correspondente.

### 5b. Novo `PersonaVideoPanel.tsx`
Renderizado abaixo do `PersonaImagePanel` na página de edição da persona.
- Preview do vídeo atual (`<video controls>`) se `vignette_url` existir
- Seletor de aspect ratio (9:16 vertical / 16:9 horizontal)
- Toggle "Com áudio (Veo 3)" — desligado força Wan i2v
- Botão "Gerar vinheta" (loading state, mensagem "pode levar até 3 min")
- Mensagem de erro com fallback automático
- Requer `image_url` setada (mostra aviso caso contrário)

### 5c. Página do debate (`src/routes/_authenticated/debates.$id.tsx`)
Para cada participante listado, adicionar pequeno botão "▶ Vinheta" que abre dialog com o vídeo da persona (se existir) ou um botão "Gerar agora" que chama a mesma server function.

## 6. Acoplamento com personas
- `src/lib/persona.functions.ts`: incluir `vignette_url` no retorno de `listPersonas` / `getPersona` / `updatePersona`.
- `src/integrations/supabase/types.ts`: regenera após migração (automático).

## 7. Segurança / limites
- Toda função usa `requireSupabaseAuth` + verifica posse da persona via `user_id`.
- Validação Zod nos inputs (name 1–120, aspect ratio enum, model enum).
- Tamanho de vídeo final limitado por Replicate (~8s); upload para bucket privado, URL assinada 1 ano.

## 8. Verificação
- Typecheck via build automático.
- Smoke test manual: gerar imagem FLUX para uma persona existente, gerar vinheta Wan (rápido) e Veo (lento) e conferir reprodução no painel.

---

### Arquivos novos
- `src/lib/persona-image-replicate.functions.ts`
- `src/lib/persona-video.functions.ts`
- `src/components/PersonaVideoPanel.tsx`
- Migração SQL (bucket `persona-videos` + colunas `vignette_url`, `vignette_model`)

### Arquivos editados
- `src/components/PersonaImagePanel.tsx` (seletor de provedor)
- `src/routes/_authenticated/personas.tsx` (renderizar `PersonaVideoPanel`)
- `src/routes/_authenticated/debates.$id.tsx` (botão de vinheta por participante)
- `src/lib/persona.functions.ts` (incluir `vignette_url`)
