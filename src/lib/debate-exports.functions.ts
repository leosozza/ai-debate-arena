import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "debate-videos";

async function assertOwnsDebate(
  supabase: SupabaseClient,
  userId: string,
  debateId: string,
) {
  const { data, error } = await supabase
    .from("debates")
    .select("id")
    .eq("id", debateId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Debate não encontrado");
}

export type DebateExportRow = {
  id: string;
  debate_id: string;
  kind: "full" | "block";
  block_index: number | null;
  block_title: string | null;
  storage_path: string;
  size_bytes: number;
  duration_seconds: number | null;
  created_at: string;
  download_url: string | null;
};

export const listDebateExports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { debateId: string }) => d)
  .handler(async ({ data, context }): Promise<DebateExportRow[]> => {
    const { supabase, userId } = context;
    await assertOwnsDebate(supabase, userId, data.debateId);
    const { data: rows, error } = await supabase
      .from("debate_exports")
      .select("*")
      .eq("debate_id", data.debateId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const out: DebateExportRow[] = [];
    for (const r of rows ?? []) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(r.storage_path, 60 * 60);
      out.push({
        id: r.id,
        debate_id: r.debate_id,
        kind: r.kind as "full" | "block",
        block_index: r.block_index,
        block_title: r.block_title,
        storage_path: r.storage_path,
        size_bytes: Number(r.size_bytes ?? 0),
        duration_seconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
        created_at: r.created_at,
        download_url: signed?.signedUrl ?? null,
      });
    }
    return out;
  });

export const createDebateExportUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    debateId: string;
    kind: "full" | "block";
    blockIndex: number | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnsDebate(supabase, userId, data.debateId);
    const suffix = data.kind === "full" ? "full" : `bloco-${(data.blockIndex ?? 0) + 1}`;
    const ts = Date.now();
    const storagePath = `${userId}/${data.debateId}/${suffix}-${ts}.mp4`;
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao gerar upload URL");
    return { storagePath, uploadUrl: signed.signedUrl, token: signed.token };
  });

export const finalizeDebateExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    debateId: string;
    kind: "full" | "block";
    blockIndex: number | null;
    blockTitle: string | null;
    storagePath: string;
    sizeBytes: number;
    durationSeconds: number | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnsDebate(supabase, userId, data.debateId);
    const { data: row, error } = await supabase
      .from("debate_exports")
      .insert({
        debate_id: data.debateId,
        user_id: userId,
        kind: data.kind,
        block_index: data.blockIndex,
        block_title: data.blockTitle,
        storage_path: data.storagePath,
        size_bytes: data.sizeBytes,
        duration_seconds: data.durationSeconds,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteDebateExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: selErr } = await supabase
      .from("debate_exports")
      .select("id, storage_path, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row || row.user_id !== userId) throw new Error("Export não encontrado");
    await supabase.storage.from("debate-videos").remove([row.storage_path]);
    const { error: delErr } = await supabase.from("debate_exports").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });
