// Server fn: lê os mediadores do catálogo público (tabela `mediators`).
// O catálogo é leitura pública (RLS allow-all SELECT) — não precisa de auth.
import { createServerFn } from "@tanstack/react-start";
import type { VoiceProvider } from "./voice-catalog";

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
}

export const listMediators = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // `mediators` table — typegen runs after migration approval, so cast for now.
  const { data, error } = await (supabaseAdmin as unknown as { from: (t: string) => { select: (s: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> } } })
    .from("mediators")
    .select("id, slug, name, gender, tagline, style, tone, voice_provider, voice_id, avatar_url, is_default, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m): MediatorRow => ({
    id: m.id as string,
    slug: m.slug as string,
    name: m.name as string,
    gender: m.gender as "m" | "f",
    tagline: m.tagline as string,
    style: m.style as string,
    tone: (m.tone as MediatorRow["tone"]) ?? "formal",
    voiceProvider: m.voice_provider as VoiceProvider,
    voiceId: m.voice_id as string,
    avatarUrl: (m.avatar_url as string | null) ?? null,
    isDefault: Boolean(m.is_default),
  }));
});
