import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PersonaInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(""),
  persona_prompt: z.string().trim().min(10).max(12000),
  is_public: z.boolean().default(false),
  voice_provider: z.enum(["browser", "eleven", "minimax"]).nullable().optional(),
  voice_id: z.string().trim().max(120).nullable().optional(),
});

export const listPersonas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("personas")
      .select("id, name, description, persona_prompt, is_public, voice_provider, voice_id, voice_clone_source, voice_clone_name, user_id, created_at")
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
    const { firecrawlSearch } = await import("./firecrawl.server");

    const name = data.name;
    const ctx = data.context ? ` (contexto: ${data.context})` : "";

    // ===== Etapa 1: Agente Pesquisador — gerar queries de busca =====
    const queriesRaw = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você gera queries de busca na web para reunir material sobre uma pessoa ou personagem. Responde APENAS JSON puro.",
        },
        {
          role: "user",
          content: `Pessoa: "${name}"${ctx}.

Gere 5 queries variadas para coletar material fiel sobre quem é, o que pensa, posições, estilo de fala, frases famosas, biografia, críticas. Misture pt-BR e inglês quando ajudar. Responda JSON:
{"queries":[{"q":"...","lang":"pt"},{"q":"...","lang":"en"}, ...]}`,
        },
      ],
      "google/gemini-3-flash-preview",
    );

    let queries: Array<{ q: string; lang?: string }> = [];
    try {
      const cleaned = queriesRaw.replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned) as { queries?: Array<{ q: string; lang?: string }> };
      queries = (parsed.queries ?? []).filter((x) => x?.q).slice(0, 6);
    } catch {
      queries = [];
    }
    if (queries.length === 0) {
      queries = [
        { q: `${name} biografia ideias posições`, lang: "pt" },
        { q: `${name} frases famosas bordões`, lang: "pt" },
        { q: `${name} biography beliefs views`, lang: "en" },
      ];
    }

    // ===== Etapa 2: Firecrawl — buscar em paralelo =====
    const results = await Promise.allSettled(
      queries.map((q) => firecrawlSearch(q.q, { limit: 4, lang: q.lang })),
    );

    const seen = new Set<string>();
    const sources: { title: string; url: string; markdown: string }[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const s of r.value) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        sources.push(s);
        if (sources.length >= 12) break;
      }
      if (sources.length >= 12) break;
    }

    // ===== Etapa 3: Agente Analista — dossiê com citações =====
    let dossier: string;
    if (sources.length === 0) {
      // Fallback: sem web, dossiê apenas com conhecimento do modelo
      dossier = await chatComplete(
        [
          {
            role: "system",
            content:
              "Você é um pesquisador biográfico rigoroso. Quando não souber algo, diga 'não documentado'. Português.",
          },
          {
            role: "user",
            content: `Monte dossiê sobre "${name}"${ctx}: identidade, ideologia, posições, estilo, bordões, táticas de debate, contradições. Seja específico.`,
          },
        ],
        "google/gemini-2.5-pro",
      );
    } else {
      const corpus = sources
        .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.markdown}`)
        .join("\n\n---\n\n");

      dossier = await chatComplete(
        [
          {
            role: "system",
            content:
              "Você é analista biográfico. Sintetiza fontes brutas em um dossiê factual e fiel, com [n] citando a fonte ao final de cada afirmação relevante. Não invente. Português.",
          },
          {
            role: "user",
            content: `Pessoa: "${name}"${ctx}.

Fontes coletadas (use [n] para citar):

${corpus}

Produza um dossiê em markdown cobrindo:
1. Identidade e biografia (formação, trajetória).
2. Sistema de pensamento (ideologia, escola, influências).
3. Posições concretas (política, social, econômica, religiosa).
4. O que defende e o que combate.
5. Estilo retórico (vocabulário, cadência, tom, recursos).
6. Bordões e frases icônicas REAIS (com aspas).
7. Táticas de debate (como ataca, defende, encerra).
8. Pontos cegos, contradições, críticas comuns.

Cite [n] em cada afirmação. Se a info não está nas fontes, diga "não documentado nas fontes". Seja específico, não caricatural.`,
          },
        ],
        "google/gemini-2.5-pro",
      );
    }

    // ===== Etapa 4: Agente Encarnador — converter dossiê em persona prompt =====
    const sourcesList = sources
      .map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`)
      .join("\n");

    const raw = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você converte dossiês biográficos em instruções operacionais para uma IA encarnar a pessoa em debate. Responde APENAS JSON puro, sem markdown wrapper.",
        },
        {
          role: "user",
          content: `Com base no dossiê abaixo sobre "${name}", produza:

{
  "description": "1 frase (máx 220 chars) — quem é e o que defende.",
  "persona_prompt": "Instrução longa em 2ª pessoa ('Você é …') para a IA encarnar fielmente. ENTRE 2500 E 6000 CARACTERES. Seções com cabeçalhos em negrito:\\n**Identidade**, **Visão de mundo e valores centrais**, **Posições concretas** (lista), **Estilo de fala** (vocabulário, cadência, tom), **Bordões e frases típicas** (lista com aspas REAIS do dossiê), **Como argumenta e ataca**, **Como se defende**, **O que NUNCA diria / o que rejeita**, **Regras de encarnação** (1ª pessoa, sem quebrar personagem, sem dizer 'como IA', manter coerência sob pressão), **Fontes consultadas** (cole exatamente a lista abaixo). Português."
}

Dossiê:
"""
${dossier}
"""

Lista de fontes (cole no final do persona_prompt sob "**Fontes consultadas**"):
${sourcesList || "(nenhuma fonte web — baseado em conhecimento do modelo)"}

Importante: o persona_prompt deve fazer a IA SOAR como a pessoa. Use os bordões REAIS citados no dossiê.`,
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
        sources: sources.map((s) => ({ title: s.title, url: s.url })),
      };
    } catch {
      throw new Error("A IA não retornou uma persona válida. Tente novamente.");
    }
  });

