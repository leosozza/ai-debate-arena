import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SEED_PERSONAS } from "./persona-seed-data";

/**
 * Popula (ou atualiza) o catálogo de personas históricas como personas
 * PÚBLICAS pertencentes ao usuário autenticado. Idempotente: faz upsert
 * por (user_id, name). Não sobrescreve image_url se já existir.
 */
export const seedHistoricalPersonas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Carrega o que já existe para preservar image_url
    const names = SEED_PERSONAS.map((p) => p.name);
    const { data: existing, error: exErr } = await supabase
      .from("personas")
      .select("id, name, image_url")
      .eq("user_id", userId)
      .in("name", names);
    if (exErr) throw new Error(exErr.message);

    const byName = new Map((existing ?? []).map((p) => [p.name, p]));

    let created = 0;
    let updated = 0;

    // Faz em chunks de 20 para não estourar limite de body
    const chunkSize = 20;
    for (let i = 0; i < SEED_PERSONAS.length; i += chunkSize) {
      const chunk = SEED_PERSONAS.slice(i, i + chunkSize);
      const rows = chunk.map((p) => {
        const ex = byName.get(p.name);
        return {
          id: ex?.id,
          user_id: userId,
          name: p.name,
          description: p.description,
          persona_prompt: p.persona_prompt,
          category: p.category,
          is_public: true,
          // preserva imagem já gerada, se houver
          image_url: ex?.image_url ?? null,
        };
      });
      const { data, error } = await supabase
        .from("personas")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: false })
        .select("id, name");
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        if (byName.has(row.name)) updated++;
        else created++;
      }
    }

    // Para os que não tinham id antes (criados agora), insere sem id
    // (o trecho acima cobre ambos os casos via upsert quando id existe)
    return {
      total: SEED_PERSONAS.length,
      created,
      updated,
    };
  });
