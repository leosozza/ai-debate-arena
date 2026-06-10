import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SEED_PERSONAS } from "./persona-seed-data";

const SeedInput = z
  .object({
    /** Mapa opcional nome-da-persona → URL da imagem-âncora.
     *  Aplicado apenas quando a persona ainda não tem image_url. */
    imageUrls: z.record(z.string().min(1), z.string().min(1).max(2048)).optional(),
  })
  .optional()
  .default({});

/**
 * Popula (ou atualiza) o catálogo de personas históricas como personas
 * PÚBLICAS pertencentes ao usuário autenticado. Idempotente por (user_id, name).
 * Não sobrescreve image_url se já existir.
 */
export const seedHistoricalPersonas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SeedInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const imageUrls = data?.imageUrls ?? {};

    const names = SEED_PERSONAS.map((p) => p.name);
    const { data: existing, error: exErr } = await supabase
      .from("personas")
      .select("id, name, image_url")
      .eq("user_id", userId)
      .in("name", names);
    if (exErr) throw new Error(exErr.message);

    const existingByName = new Map(
      (existing ?? []).map((p) => [p.name, { id: p.id, image_url: p.image_url as string | null }]),
    );

    type InsertRow = {
      user_id: string;
      name: string;
      description: string;
      persona_prompt: string;
      category: string;
      is_public: boolean;
      image_url?: string | null;
    };
    type UpdatePatch = Omit<InsertRow, "user_id">;

    const toInsert: InsertRow[] = [];
    const toUpdate: Array<{ id: string; patch: UpdatePatch }> = [];

    for (const p of SEED_PERSONAS) {
      const anchorUrl = imageUrls[p.name];
      const base: UpdatePatch = {
        name: p.name,
        description: p.description,
        persona_prompt: p.persona_prompt,
        category: p.category,
        is_public: true,
      };
      const ex = existingByName.get(p.name);
      if (ex) {
        // Só preenche image_url se ainda estiver vazia.
        if (anchorUrl && !ex.image_url) base.image_url = anchorUrl;
        toUpdate.push({ id: ex.id, patch: base });
      } else {
        toInsert.push({ ...base, user_id: userId, image_url: anchorUrl ?? null });
      }
    }

    let created = 0;
    let updated = 0;

    if (toInsert.length) {
      const { data: ins, error } = await supabase
        .from("personas")
        .insert(toInsert)
        .select("id");
      if (error) throw new Error(error.message);
      created = ins?.length ?? 0;
    }

    for (const u of toUpdate) {
      const { error } = await supabase.from("personas").update(u.patch).eq("id", u.id);
      if (error) throw new Error(error.message);
      updated++;
    }

    return { total: SEED_PERSONAS.length, created, updated };
  });
