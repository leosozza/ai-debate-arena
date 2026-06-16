## Problema

Na exportação por fala, quando uma fala fica com "Áudio ausente" (TTS falhou no momento da preparação), não há como tentar gerar o áudio dela de novo. O usuário precisa fechar o painel e refazer tudo, mesmo já tendo áudios prontos para o resto.

## Objetivo

Permitir corrigir falas com erro (especialmente "Áudio ausente") direto no painel "Exportar por fala", sem reabrir nem regerar o que já está pronto.

## Mudanças

1. **Botão "Tentar gerar áudio" por linha (apenas para falas com erro de áudio)**
   - Em cada item com `status === "error"` e sem `audioUrl`, mostrar um botão pequeno tipo "Tentar áudio".
   - Roda `synthesizeClips` só para aquela mensagem, aproveitando o cache de TTS (memória + IndexedDB) — se outra fala já gerou voz, nem chama API.
   - Se sucesso: preenche `audioUrl`/`duration`, volta status para `pending` e dispara `renderOnePart` em seguida (gera o MP4 automaticamente).
   - Se falha: mantém erro com mensagem clara da causa (ex.: "voz não configurada", "TTS retornou 500").

2. **Botão global "Corrigir áudios faltantes"**
   - Aparece no topo do painel quando há `parts.some(p => p.status === "error" && !p.audioUrl)`.
   - Faz a mesma coisa do item 1, em lote, só para as falas sem áudio.
   - Depois que conseguir áudio, segue para renderizar o MP4 daquelas falas (entra no `runPerSpeechExport` filtrado).

3. **Botão "Tentar novamente" para erros de render (já existe parcialmente)**
   - Garantir que linhas com erro mas com `audioUrl` presente mostrem "Tentar de novo" para re-renderizar só o MP4 (sem refazer TTS).

4. **Mensagens de erro melhores**
   - Quando `synthesizeClips` falhar para uma fala específica, salvar a razão (ex.: "Voz B não configurada", "ElevenLabs 429") no `part.error` em vez do genérico "Áudio ausente". Para isso, vou extrair uma versão da função que retorna por-mensagem o motivo da falha, ou simplesmente expor o array `errors` já existente para preencher o erro de cada `Part`.

5. **Sem mexer no fluxo normal de exportação** — só adiciona caminhos de retry. Cache de áudio e cache de MP4 continuam iguais.

## Arquivo

- `src/components/ExportVideoButton.tsx` — novas funções `retryAudioForPart(msgId)` e `retryAllMissingAudios()`, novo botão no header do dialog, novo botão "Tentar áudio" por linha em erros sem áudio, mensagens de erro mais específicas vindas do `synthesizeClips`.
