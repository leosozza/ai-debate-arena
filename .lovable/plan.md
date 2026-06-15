## Por que não exporta e por que refaz tudo a cada clique

Dois bugs independentes batendo juntos no debate `cea98432`:

### Bug 1 — Voz do moderador inválida (Kokoro `pm_santa`)
O banco tem `voice_provider_mod=kokoro`, `voice_id_mod=pm_santa`. Essa voz está listada em `src/lib/kokoro-voices.ts`, mas o modelo Kokoro atual no esm.sh **não tem mais `pm_santa`** — o console mostra `Voice "pm_santa" not found` para cada tentativa. Como o moderador fala em quase todas as mensagens (abertura, transições, encerramento), a maioria dos clipes falha. O `synthesizeClips` engole o erro por mensagem e segue, mas no fim resta tão pouca coisa que o vídeo sai vazio/quebrado (ou nem chega a renderizar).

Hoje o `catch` é silencioso (`/* ignore individual */`), então o usuário não vê motivo nenhum — só "não exportou".

### Bug 2 — Cada clique regenera tudo do zero
`synthesizeClips` cria um `Map` local novo a cada chamada. O cache do Kokoro/Piper (`urlCache` dentro de `kokoro-tts.ts` / `piper-tts.ts`) ajuda para essas duas, mas **ElevenLabs / MiniMax / Replicate não têm cache nenhum** — toda exportação chama a API de novo, paga de novo, espera de novo. E mesmo Kokoro/Piper recalculam a duração do áudio (`getAudioDuration`) a cada clique.

## O que vou mudar (`src/components/ExportVideoButton.tsx` + `src/lib/kokoro-voices.ts`)

### 1. Catálogo Kokoro alinhado ao modelo real
Remover `pm_santa` da lista (não existe mais no Kokoro v1.0 ONNX). Manter `pf_dora` e `pm_alex`. Não preciso mexer no banco — o passo 2 cobre debates antigos.

### 2. Fallback automático para voz Kokoro inválida
Em `fetchAudioUrl`, ao usar Kokoro, validar contra `KOKORO_VOICES`; se `voiceId` não estiver na lista, cair para `pm_alex` (moderador masculino) ou `pf_dora` (feminino) em vez de lançar erro. Isso destrava o debate atual sem o usuário precisar editar nada.

### 3. Erros de síntese visíveis
Trocar o `catch` silencioso em `synthesizeClips` por:
- coletar `{msgId, error}`,
- mostrar um `toast.error` com os 2 primeiros motivos reais ("Moderador: Voice pm_santa not found"),
- abortar cedo se **mais de 50%** das mensagens falharem (não faz sentido renderizar um vídeo aleijado).

### 4. Cache de áudio entre cliques
Subir o `Map<string, {url, duration}>` para um `useRef` do componente, com chave `${provider}|${voiceId}|${msgId}|${contentHash}`. Assim:
- 1º clique: gera tudo, popula o cache.
- Cliques seguintes (mesmo bloco, bloco diferente, ou trocar entre "Editor"/"Exportar MP4"/"Exportar bloco…"): reaproveita áudio e duração; só sintetiza o que mudou.
- `contentHash` é um `djb2` simples do `content` — se o usuário editar uma fala e reexportar, aquela mensagem (e só ela) é refeita.

Também invalido o cache quando `data.messages` muda de identidade após `Refazer tudo` (uso `useEffect` zerando o ref quando os ids do `data.messages` mudam em conjunto).

### 5. Pequeno extra
Renomear o label do progresso para `"Reaproveitando áudio (N/M)"` quando vier do cache, pra deixar claro que não está pagando ElevenLabs de novo.

## Fora de escopo
- Não vou mudar o pipeline em `src/lib/video-export.ts`.
- Não vou criar fila no servidor (Stack Overflow sugere isso, mas o trabalho aqui é client-side via Web APIs / ffmpeg.wasm — o gargalo real era voz inválida + ausência de cache, não timeout de edge function).
- Não vou tocar no banco para corrigir `pm_santa` retroativamente; o fallback do passo 2 já resolve.

## Resultado esperado
- Clicar "Exportar MP4" no debate `cea98432` agora gera o vídeo (moderador cai pra `pm_alex` automaticamente).
- Re-clicar "Exportar bloco 2" depois de já ter exportado o bloco 1 reaproveita o áudio do moderador e dos participantes que aparecem em ambos — só sintetiza falas novas.
- Se algo falhar de verdade, aparece um toast dizendo qual voz/qual papel quebrou.
