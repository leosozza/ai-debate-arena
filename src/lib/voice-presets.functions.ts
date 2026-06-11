import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { uploadFile } from "./replicate.server";

export interface VoicePreset {
  id: string;
  name: string;
  voice_url: string;
  storage_path: string | null;
  is_real_person: boolean;
  notes: string | null;
  created_at: string;
}

export const listVoicePresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("voice_presets")
      .select("id,name,voice_url,storage_path,is_real_person,notes,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as VoicePreset[];
  });

export const deleteVoicePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("voice_presets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Upload audio sample → Replicate persistent URL → save as preset. */
export const createVoicePresetFromUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Envio inválido (esperado FormData).");
    const name = String(d.get("name") ?? "").trim();
    if (name.length < 2 || name.length > 80) throw new Error("Nome deve ter 2 a 80 caracteres.");
    const isRealPerson = String(d.get("is_real_person") ?? "false") === "true";
    const notes = String(d.get("notes") ?? "").trim().slice(0, 500) || null;
    const file = d.getAll("file").find((f): f is File => f instanceof File && f.size > 0);
    if (!file) throw new Error("Envie 1 arquivo de áudio (10–60s de fala clara).");
    if (!file.type.startsWith("audio/")) throw new Error(`"${file.name}" não é áudio.`);
    if (file.size > 12 * 1024 * 1024) throw new Error("Arquivo excede 12 MB.");
    return { name, isRealPerson, notes, file };
  })
  .handler(async ({ data, context }) => {
    const url = await uploadFile(data.file);
    const { data: row, error } = await context.supabase
      .from("voice_presets")
      .insert({
        user_id: context.userId,
        name: data.name,
        voice_url: url,
        is_real_person: data.isRealPerson,
        notes: data.notes,
      })
      .select("id,name,voice_url,storage_path,is_real_person,notes,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as VoicePreset;
  });
