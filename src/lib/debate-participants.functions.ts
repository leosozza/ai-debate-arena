import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleSchema = z.enum([
  "debater",
  "moderator",
  "judge",
  "prosecutor",
  "defender",
  "interviewer",
  "interviewee",
  "team_a",
  "team_b",
]);

const VoiceProviderSchema = z.enum(["browser", "kokoro", "piper", "eleven", "minimax", "replicate"]).nullable().optional();

const ParticipantInput = z.object({
  debateId: z.string().uuid(),
  slot: z.number().int().min(0).max(20),
  role: RoleSchema.default("debater"),
  displayName: z.string().trim().min(1).max(120),
  personaId: z.string().uuid().nullable().optional(),
  personaPrompt: z.string().trim().max(20000).default(""),
  imageUrl: z.string().trim().max(2048).nullable().optional(),
  voiceProvider: VoiceProviderSchema,
  voiceId: z.string().trim().max(2048).nullable().optional(),
  model: z.string().trim().max(80).nullable().optional(),
  team: z.string().trim().max(10).nullable().optional(),
});

export type ParticipantInput = z.infer<typeof ParticipantInput>;

async function assertOwnsDebate(
  supabase: { from: (t: "debates") => unknown },
  debateId: string,
  userId: string,
) {
  const sb = supabase as unknown as {
    from: (t: "debates") => { select: (s: string) => { eq: (k: string, v: string) => { single: () => Promise<{ data: { user_id: string } | null; error: { message: string } | null }> } } };
  };
  const { data, error } = await sb.from("debates").select("user_id").eq("id", debateId).single();
  if (error || !data) throw new Error("Debate não encontrado.");
  if (data.user_id !== userId) throw new Error("Sem permissão.");
}

export const listParticipants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ debateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("debate_participants")
      .select("*")
      .eq("debate_id", data.debateId)
      .order("slot", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ParticipantInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnsDebate(context.supabase as unknown as { from: (t: "debates") => unknown }, data.debateId, context.userId);
    const row = {
      debate_id: data.debateId,
      user_id: context.userId,
      slot: data.slot,
      role: data.role,
      display_name: data.displayName,
      persona_id: data.personaId ?? null,
      persona_prompt: data.personaPrompt,
      image_url: data.imageUrl ?? null,
      voice_provider: data.voiceProvider ?? null,
      voice_id: data.voiceId ?? null,
      model: data.model ?? null,
      team: data.team ?? null,
    };
    const { data: inserted, error } = await context.supabase
      .from("debate_participants")
      .upsert(row, { onConflict: "debate_id,slot" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const removeParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error: fErr } = await context.supabase
      .from("debate_participants").select("user_id").eq("id", data.id).single();
    if (fErr || !row) throw new Error("Participante não encontrado.");
    if (row.user_id !== context.userId) throw new Error("Sem permissão.");
    const { error } = await context.supabase.from("debate_participants").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
