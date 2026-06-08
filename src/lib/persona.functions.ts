import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PersonaInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(""),
  persona_prompt: z.string().trim().min(10).max(12000),
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
      name: z.string().trim().min(2).max(120),
      context: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { chatComplete } = await import("./ai-gateway.server");

    // Etapa 1: pesquisa profunda — produzir um dossiê factual sobre a pessoa.
    const dossier = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você é um pesquisador biográfico rigoroso. Produz dossiês factuais, fiéis ao registro público, com nuance e sem inventar fatos. Quando não souber algo, diga 'não documentado'. Sempre em português.",
        },
        {
          role: "user",
          content: `Monte um dossiê detalhado sobre: "${data.name}"${data.context ? ` (contexto: ${data.context})` : ""}.

Inclua, em tópicos:
1. Identidade e biografia resumida (formação, trajetória, papéis públicos).
2. Sistema de pensamento: filosofia, ideologia, escola, influências intelectuais.
3. Posições políticas/sociais/econômicas/religiosas concretas (com nuance, evitando caricatura).
4. Causas que defende e o que combate explicitamente.
5. Estilo retórico: vocabulário típico, cadência, tom (ex.: professoral, beligerante, irônico), recursos preferidos (analogias históricas, citações, dados, apelo emocional, sarcasmo…).
6. Bordões, frases icônicas e maneirismos verbais (cite frases reais quando lembrar).
7. Táticas de debate: como costuma atacar adversários, como se defende, falácias que costuma usar, como muda de assunto, como encerra.
8. Pontos cegos, contradições conhecidas e críticas comuns recebidas.
9. Personagem ficcional? Liste obra de origem, autor e cânone que define a personalidade.

Seja específico e fiel. Se for personagem ficcional, baseie-se na obra.`,
        },
      ],
      "google/gemini-2.5-pro",
    );

    // Etapa 2: transformar o dossiê em uma "skill" de persona para a IA encarnar.
    const raw = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você converte dossiês biográficos em instruções operacionais para uma IA encarnar a pessoa em um debate. Responde SEMPRE JSON puro, sem markdown.",
        },
        {
          role: "user",
          content: `Com base no dossiê abaixo sobre "${data.name}", produza um JSON com:

{
  "description": "1 frase (máx 220 chars) — quem é e o que defende.",
  "persona_prompt": "Instrução longa e detalhada em 2ª pessoa ('Você é …') para a IA encarnar fielmente esta pessoa em um debate. ENTRE 2500 E 6000 CARACTERES. Deve conter, com cabeçalhos em negrito markdown:\\n**Identidade**, **Visão de mundo e valores centrais**, **Posições concretas** (lista), **Estilo de fala** (vocabulário, cadência, tom), **Bordões e frases típicas** (lista, com aspas), **Como argumenta e ataca**, **Como se defende**, **O que NUNCA diria / o que rejeita**, **Regras de encarnação** (1ª pessoa, sem quebrar personagem, sem dizer 'como IA', usar referências históricas e bordões reais, manter coerência ideológica mesmo sob pressão). Em português."
}

Dossiê:
"""
${dossier}
"""

Importante: o persona_prompt deve fazer a IA SOAR como a pessoa — não apenas descrevê-la. Use 2ª pessoa imperativa.`,
        },
      ],
      "google/gemini-2.5-pro",
    );

    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as { description?: string; persona_prompt?: string };
      if (!parsed.persona_prompt || parsed.persona_prompt.length < 500) {
        throw new Error("persona rasa");
      }
      return {
        description: (parsed.description ?? "").slice(0, 400),
        persona_prompt: parsed.persona_prompt.slice(0, 12000),
      };
    } catch {
      throw new Error("A IA não retornou uma persona válida. Tente novamente.");
    }
  });
