import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PersonaInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
  persona_prompt: z.string().trim().min(10).max(2000),
  is_public: z.boolean().default(false),
});

export const listPersonas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("personas")
      .select("id, name, description, persona_prompt, is_public, user_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PersonaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("personas")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updatePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).merge(PersonaInput.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("personas")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("personas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generatePersonaWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().trim().min(2).max(80),
      context: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { chatComplete } = await import("./ai-gateway.server");
    const prompt = `Crie uma "skill de persona" para um debate de IAs sobre figura pública/personagem chamada: "${data.name}"${data.context ? ` (contexto extra: ${data.context})` : ""}.

Responda APENAS um JSON válido (sem markdown), no formato:
{
  "description": "1 frase curta descrevendo quem é (máx 140 chars)",
  "persona_prompt": "Instrução em 2ª pessoa para a IA encarnar essa pessoa em um debate. Inclua: estilo de fala característico, valores centrais, posições políticas/filosóficas conhecidas, bordões/maneirismos, e como costuma rebater. Entre 400 e 900 caracteres. Em português."
}

Seja fiel ao registro público da pessoa. Se for personagem ficcional, baseie-se na obra.`;

    const raw = await chatComplete(
      [
        { role: "system", content: "Você gera fichas de personas para debates de IA. Responde sempre JSON puro." },
        { role: "user", content: prompt },
      ],
      "google/gemini-2.5-flash",
    );
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as { description?: string; persona_prompt?: string };
      if (!parsed.persona_prompt) throw new Error("empty");
      return {
        description: (parsed.description ?? "").slice(0, 300),
        persona_prompt: parsed.persona_prompt.slice(0, 2000),
      };
    } catch {
      throw new Error("A IA não retornou um JSON válido. Tente novamente.");
    }
  });
