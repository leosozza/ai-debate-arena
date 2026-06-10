import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SEED_PERSONAS } from "./persona-seed-data";

/**
 * Popula (ou atualiza) o catálogo de personas históricas como personas
 * PÚBLICAS pertencentes ao usuário autenticado. Idempotente por (user_id, name).
 * Não sobrescreve image_url se já existir.
 */
export const seedHistoricalPersonas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const names = SEED_PERSONAS.map((p) => p.name);
    const { data: existing, error: exErr } = await supabase
      .from("personas")
      .select("id, name")
      .eq("user_id", userId)
      .in("name", names);
    if (exErr) throw new Error(exErr.message);

    const existingByName = new Map((existing ?? []).map((p) => [p.name, p.id]));

    type InsertRow = {
      user_id: string;
      name: string;
      description: string;
      persona_prompt: string;
      category: string;
      is_public: boolean;
    };
    type UpdatePatch = Omit<InsertRow, "user_id">;

    const toInsert: InsertRow[] = [];
    const toUpdate: Array<{ id: string; patch: UpdatePatch }> = [];

    for (const p of SEED_PERSONAS) {
      const base: UpdatePatch = {
        name: p.name,
        description: p.description,
        persona_prompt: p.persona_prompt,
        category: p.category,
        is_public: true,
      };
      const id = existingByName.get(p.name);
      if (id) toUpdate.push({ id, patch: base });
      else toInsert.push({ ...base, user_id: userId });
    }

    let created = 0;
    let updated = 0;

    if (toInsert.length) {
      const { data, error } = await supabase
        .from("personas")
        .insert(toInsert)
        .select("id");
      if (error) throw new Error(error.message);
      created = data?.length ?? 0;
    }

    for (const u of toUpdate) {
      const { error } = await supabase.from("personas").update(u.patch).eq("id", u.id);
      if (error) throw new Error(error.message);
      updated++;
    }

    return { total: SEED_PERSONAS.length, created, updated };
  });
