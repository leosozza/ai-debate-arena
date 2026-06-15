## Problemas identificados

1. **"Editor de vídeo" parece não abrir**: O debate `cea98432…` tem `voice_id_b` vazio (string `""`) para o Karl Marx no provedor `eleven`. Em `ExportVideoButton.resolveSlot`, o fallback usa `??`, que **não** captura string vazia — então todas as falas do Marx falham silenciosamente em `fetchAudioUrl`. Pior: a preparação fica rodando ("Preparando vozes 1/31…") sem feedback claro e, dependendo do timing, o botão parece travado. Não tem mensagem específica avisando que falta voz para um participante.

2. **Não tem "Exportar vídeo" direto**: hoje só existe o caminho "abrir editor → exportar". Para quem só quer baixar, isso é fricção desnecessária.

3. **Vídeos longos pesam demais**: este debate tem 4 blocos / 31 falas. Renderizar tudo de uma vez é lento e o MP4 fica grande. Faz sentido ter "Exportar bloco 1, bloco 2, …" gerando 4 MP4s menores.

## Mudanças

### 1. Corrigir o resolvedor de voz (`src/components/ExportVideoButton.tsx`)

- Trocar `voiceId ?? fallback` por uma checagem que também trate `""` como ausente (`const id = (voiceId ?? "").trim(); return id || fallback`).
- Antes de começar a sintetizar, validar slots e mostrar `toast.error` claro listando QUEM está sem voz ("Karl Marx está sem voz. Configure em Editar > Vozes."), em vez de só falhar silenciosamente fala a fala.
- Mostrar o estado "Preparando…" desde o primeiro clique (já existe, mas garantir que o `setProgress` é chamado síncrono no `onClick`).

### 2. Adicionar botão "Exportar vídeo" (direto, sem editor)

- Novo botão ao lado do "Editor de vídeo" no `debates.$id.index.tsx`, rotulado **"Exportar MP4"**.
- Reaproveita 100% da pipeline já em `ExportVideoButton` (TTS + `exportDebateMp4`), pulando o `TimelineEditor` — gera com defaults (música ligada, legendas ligadas, sem SFX customizados) e dispara o download direto.

### 3. Exportar **por bloco**

- Novo menu (dropdown) **"Exportar bloco…"** com itens:
  - "Bloco 1: <título>" → exporta só falas com `block_index = 0`
  - "Bloco 2: <título>"
  - "Bloco 3: <título>"
  - "Bloco 4: <título>"
  - "Tudo (vídeo único)" → comportamento atual
- A geração por bloco filtra `data.messages` por `block_index`, prepende a abertura virtual só se for o bloco 0, e nomeia o arquivo `debate-<id8>-bloco-<n>.mp4`.
- Cada bloco vira um arquivo MP4 independente, muito mais rápido de gerar e baixar.

### 4. UX

- Os 3 controles (`Editor de vídeo`, `Exportar MP4`, `Exportar bloco…`) ficam agrupados num único container, sem inflar a barra de ações.
- Quando o debate só tem 1 bloco, esconder o dropdown "Exportar bloco…".

## Arquivos afetados

- `src/components/ExportVideoButton.tsx` — fix do `resolveSlot`, validação de vozes, exportação direta, exportação por bloco, dropdown de blocos.
- `src/routes/_authenticated/debates.$id.index.tsx` — só se precisar repassar `block_subtopics` (já vem em `data.debate`).

Nada de mudança no `video-export.ts` — a função já aceita qualquer lista de `messages`.

## Validação

- Recarregar `/debates/cea98432-…/`: o botão "Editor de vídeo" deve abrir o editor mesmo com Marx sem voz (pulando só as falas dele com aviso claro), ou mostrar erro direto pedindo para configurar a voz.
- Clicar "Exportar MP4" baixa um único MP4 sem passar pelo editor.
- "Exportar bloco → Bloco 2" baixa só as falas do bloco 2.
