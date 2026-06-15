// Server fns para o catálogo de mediadores e comentadores (tabela `mediators`).
// Leitura é pública (RLS allow-all SELECT); writes via supabaseAdmin exigem auth.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { VoiceProvider } from "./voice-catalog";

export type CastRole = "mediator" | "commentator";

export interface MediatorRow {
  id: string;
  slug: string;
  name: string;
  gender: "m" | "f";
  tagline: string;
  style: string;
  tone: "formal" | "descontraído" | "acadêmico";
  voiceProvider: VoiceProvider;
  voiceId: string;
  avatarUrl: string | null;
  isDefault: boolean;
  role: CastRole;
  sortOrder: number;
}

function mapRow(m: Record<string, unknown>): MediatorRow {
  return {
    id: m.id as string,
    slug: m.slug as string,
    name: m.name as string,
    gender: m.gender as "m" | "f",
    tagline: (m.tagline as string) ?? "",
    style: (m.style as string) ?? "",
    tone: (m.tone as MediatorRow["tone"]) ?? "formal",
    voiceProvider: m.voice_provider as VoiceProvider,
    voiceId: m.voice_id as string,
    avatarUrl: (m.avatar_url as string | null) ?? null,
    isDefault: Boolean(m.is_default),
    role: ((m.role as CastRole) ?? "mediator"),
    sortOrder: Number(m.sort_order ?? 0),
  };
}

const COLS = "id, slug, name, gender, tagline, style, tone, voice_provider, voice_id, avatar_url, is_default, sort_order, role";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        order: (c: string, o: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
        eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> };
      };
      insert: (v: Record<string, unknown>) => { select: (s: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
      update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => { select: (s: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } } };
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    };
  };
}

export const listMediators = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db.from("mediators").select(COLS).eq("role", "mediator").order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
});

export const listCast = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ role: z.enum(["mediator", "commentator"]) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: rows, error } = await db.from("mediators").select(COLS).eq("role", data.role).order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapRow);
  });

const CastInput = z.object({
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/i, "use apenas letras/números/hífen"),
  name: z.string().trim().min(1).max(120),
  gender: z.enum(["m", "f"]),
  tagline: z.string().trim().max(200).default(""),
  style: z.string().trim().max(4000).default(""),
  tone: z.enum(["formal", "descontraído", "acadêmico"]).default("formal"),
  voice_provider: z.enum(["browser", "kokoro", "piper", "eleven", "minimax", "replicate"]).transform((v) => (v === "browser" ? "kokoro" : v)),
  voice_id: z.string().trim().min(1).max(200),
  avatar_url: z.string().trim().max(2048).nullable().optional(),
  is_default: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(9999).default(0),
  role: z.enum(["mediator", "commentator"]).default("mediator"),
});

export const createCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CastInput.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db.from("mediators").insert(data).select(COLS).single();
    if (error) throw new Error(error.message);
    return row ? mapRow(row) : null;
  });

export const updateCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).merge(CastInput.partial()).parse(d))
  .handler(async ({ data }) => {
    const { id, ...patch } = data;
    const db = await admin();
    const { data: row, error } = await db.from("mediators").update(patch).eq("id", id).select(COLS).single();
    if (error) throw new Error(error.message);
    return row ? mapRow(row) : null;
  });

export const deleteCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("mediators").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
