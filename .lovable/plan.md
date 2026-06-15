## Objetivo

Quando você exporta um vídeo (completo ou por bloco), o MP4 fica guardado no debate. Da próxima vez que abrir `/debates/$id`, aparece um botão "Baixar" para cada vídeo já gerado — sem refazer TTS nem re-renderizar.

## Como vai funcionar

1. **Storage**: novo bucket privado `debate-videos` no Lovable Cloud. Estrutura: `{user_id}/{debate_id}/{full|bloco-N}-{timestamp}.mp4`. Acesso só via signed URL (1h).
2. **Tabela nova `debate_exports`** (migration):
   - `id uuid pk`, `debate_id uuid fk → debates`, `user_id uuid`, `kind text` ('full' | 'block'), `block_index int null`, `block_title text null`, `storage_path text`, `size_bytes bigint`, `duration_seconds numeric null`, `created_at timestamptz default now()`
   - RLS: dono do debate lê/insere/apaga (`debates.user_id = auth.uid()`); `service_role` total.
   - GRANTs padrão pra `authenticated` + `service_role`.
3. **Server fns novas em `src/lib/debate-exports.functions.ts`**:
   - `listDebateExports({ debateId })` — lista entradas + signed URL pra cada uma.
   - `createDebateExportUpload({ debateId, kind, blockIndex, blockTitle, sizeBytes })` — valida posse, retorna signed upload URL + `storage_path` (usa `supabaseAdmin.storage.createSignedUploadUrl`).
   - `finalizeDebateExport({ debateId, storagePath, kind, blockIndex, blockTitle, sizeBytes, durationSeconds })` — insere a linha após upload concluído.
   - `deleteDebateExport({ id })` — remove storage + linha.
   - Todas com `requireSupabaseAuth` + checagem `debates.user_id = userId`.
4. **`ExportVideoButton.tsx`**: após `renderAndDownload` gerar o `Blob`, além de baixar localmente:
   - chama `createDebateExportUpload`, faz `fetch(PUT, blob)` direto no signed URL,
   - chama `finalizeDebateExport`,
   - invalida `["debate-exports", debateId]`.
5. **UI no detalhe do debate** (`debates.$id.index.tsx`): nova seção "Vídeos exportados" listando cada export com nome (Completo / Bloco N — título), tamanho, data, botão **Baixar** (abre signed URL) e botão **Apagar**. Vazio quando não há nada — sem ruído.

## Fora de escopo
- Não regenera vídeos antigos retroativamente (só os novos a partir daqui ficam salvos).
- Sem versionamento — re-exportar o mesmo bloco cria uma entrada nova; você apaga a antiga pelo botão.
- Sem compartilhamento público; URLs são signed e expiram.

## Resultado esperado
Exportou o bloco 2 → baixa normal **e** aparece em "Vídeos exportados". Amanhã, abre o debate e clica em **Baixar** sem esperar TTS de novo.
