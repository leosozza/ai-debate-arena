import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ModelSchema = z.string().min(3).max(80);
const VoiceProviderSchema = z.enum(["browser", "kokoro", "piper", "eleven", "minimax", "replicate"]).nullable().optional();
const VoiceIdSchema = z.string().trim().max(2048).nullable().optional();

const FormatSchema = z.enum([
  "duel",
  "roundtable",
  "presidential",
  "tribunal",
  "interview",
  "era_clash",
  "sages_council",
  "ideas_war",
  "century_problem",
]).default("duel");

const ExtraParticipantSchema = z.object({
  slot: z.number().int().min(2).max(20),
  role: z.enum([
    "debater", "moderator", "judge", "prosecutor", "defender",
    "interviewer", "interviewee", "team_a", "team_b",
  ]).default("debater"),
  displayName: z.string().trim().min(1).max(120),
  personaId: z.string().uuid().nullable().optional(),
  personaPrompt: z.string().trim().max(20000).default(""),
  imageUrl: z.string().trim().max(2048).nullable().optional(),
  voiceProvider: VoiceProviderSchema,
  voiceId: VoiceIdSchema,
  model: ModelSchema.nullable().optional(),
  team: z.string().trim().max(10).nullable().optional(),
});
export type ExtraParticipantInput = z.infer<typeof ExtraParticipantSchema>;

const NewDebateSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  direction: z.string().trim().max(2000).optional(),
  format: FormatSchema,
  debaterAName: z.string().trim().min(1).max(60),
  debaterAPersona: z.string().trim().min(1).max(20000),
  debaterAModel: ModelSchema.default("google/gemini-3-flash-preview"),
  debaterAImageUrl: z.string().trim().max(2048).nullable().optional(),
  debaterBName: z.string().trim().min(1).max(60),
  debaterBPersona: z.string().trim().min(1).max(20000),
  debaterBModel: ModelSchema.default("google/gemini-3-flash-preview"),
  debaterBImageUrl: z.string().trim().max(2048).nullable().optional(),
  moderatorModel: ModelSchema.default("google/gemini-3-flash-preview"),
  moderatorTone: z.enum(["formal", "descontraído", "acadêmico"]),
  rounds: z.number().int().min(2).max(6),
  blocksCount: z.number().int().min(2).max(6).default(4),
  dynamicFlow: z.boolean().default(false),
  voiceProviderMod: VoiceProviderSchema,
  voiceIdMod: VoiceIdSchema,
  voiceProviderA: VoiceProviderSchema,
  voiceIdA: VoiceIdSchema,
  voiceProviderB: VoiceProviderSchema,
  voiceIdB: VoiceIdSchema,
  extras: z.array(ExtraParticipantSchema).max(20).default([]),
});

const FORMAT_RULES_HINTS: Record<string, string> = {
  duel: "Formato: DUELO 1×1 clássico. Alternância entre A e B com mediador.",
  roundtable: "Formato: MESA REDONDA. Vários convidados (incluindo os extras listados). O mediador distribui falas, provoca contraposições e fecha cada bloco com síntese.",
  presidential: "Formato: DEBATE PRESIDENCIAL. Vários candidatos respondem perguntas do mediador. Cada um tem tempo curto e cronometrado; réplicas e tréplicas curtas.",
  tribunal: "Formato: TRIBUNAL DA HISTÓRIA. O réu é interrogado; promotores acusam, defensores defendem, jurados deliberam um veredito no fim.",
  interview: "Formato: ENTREVISTA IMPOSSÍVEL. Sem mediador; o entrevistador faz perguntas curtas e provocativas, o entrevistado responde longo e pessoal.",
  era_clash: "Formato: DEBATE ENTRE ERAS. Um vem do passado, outro do presente — explore choque de visões de mundo, vocabulário e prioridades.",
  sages_council: "Formato: CONSELHO DOS SÁBIOS. Tom reflexivo, sem combate. Buscam síntese e novas perguntas, não vitória.",
  ideas_war: "Formato: GUERRA DAS IDEIAS. Times A e B alternam aberturas e réplicas. Veredito é coletivo por time.",
  century_problem: "Formato: PROBLEMA DO SÉCULO. Não é debate — é COLABORAÇÃO. Cada figura contribui com sua visão para resolver um desafio comum.",
};


export const createDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NewDebateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai-gateway.server");
    const formatHint = FORMAT_RULES_HINTS[data.format] ?? FORMAT_RULES_HINTS.duel;
    const extrasText = data.extras.length
      ? `\nConvidados extras:\n${data.extras.map((e, i) => `- (slot ${e.slot}, papel ${e.role}) ${e.displayName} — ${e.personaPrompt.slice(0, 240)}`).join("\n")}\n`
      : "";
    const rulesPrompt = `Você é o MEDIADOR de um programa de IAs para um canal do YouTube.
${formatHint}
Tema: "${data.topic}"
Debatedor A: ${data.debaterAName} — ${data.debaterAPersona}
Debatedor B: ${data.debaterBName} — ${data.debaterBPersona}${extrasText}
Tom: ${data.moderatorTone}
Rodadas: ${data.rounds}
Fluxo: ${data.dynamicFlow ? "dinâmico (mediador decide quem fala)" : "fixo (alternado A/B)"}

Escreva em português um documento curto (~250 palavras) com:
1. Apresentação do tema e do formato
2. Regras claras (tempo, respeito, ordem das falas adequada ao formato)
3. Critérios de avaliação
4. Como o programa termina (veredito, síntese ou conclusão colaborativa, conforme o formato)

Use markdown com títulos curtos. Seja direto e envolvente.`;

    const rules = await chatComplete(
      [
        { role: "system", content: "Você é um mediador profissional de debates e programas de TV." },
        { role: "user", content: rulesPrompt },
      ],
      data.moderatorModel,
    );

    const { data: debate, error } = await context.supabase
      .from("debates")
      .insert({
        user_id: context.userId,
        topic: data.topic,
        direction: data.direction || null,
        format: data.format,
        debater_a_name: data.debaterAName,
        debater_a_persona: data.debaterAPersona,
        debater_a_model: data.debaterAModel,
        debater_a_image_url: data.debaterAImageUrl ?? null,
        debater_b_name: data.debaterBName,
        debater_b_persona: data.debaterBPersona,
        debater_b_model: data.debaterBModel,
        debater_b_image_url: data.debaterBImageUrl ?? null,
        moderator_model: data.moderatorModel,

        moderator_tone: data.moderatorTone,
        rounds: data.rounds,
        blocks_count: data.blocksCount,
        dynamic_flow: data.dynamicFlow,
        voice_provider_mod: data.voiceProviderMod ?? null,
        voice_id_mod: data.voiceIdMod ?? null,
        voice_provider_a: data.voiceProviderA ?? null,
        voice_id_a: data.voiceIdA ?? null,
        voice_provider_b: data.voiceProviderB ?? null,
        voice_id_b: data.voiceIdB ?? null,
        rules,
        status: "ready",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Persiste convidados extras (slot 2+) na tabela N-up — engine de geração
    // ainda usa A/B; os extras aparecem no card de regras e no painel do
    // programa para preparar os formatos futuros.
    if (data.extras.length > 0) {
      const rows = data.extras.map((e) => ({
        debate_id: debate.id,
        user_id: context.userId,
        slot: e.slot,
        role: e.role,
        display_name: e.displayName,
        persona_id: e.personaId ?? null,
        persona_prompt: e.personaPrompt,
        image_url: e.imageUrl ?? null,
        voice_provider: e.voiceProvider ?? null,
        voice_id: e.voiceId ?? null,
        model: e.model ?? null,
        team: e.team ?? null,
      }));
      const { error: pErr } = await context.supabase.from("debate_participants").insert(rows);
      if (pErr) {
        // Não derruba o debate por falha nos extras — só loga em dev.
        console.warn("[createDebate] falha ao inserir extras:", pErr.message);
      }
    }

    return { id: debate.id, rules };
  });

const UpdateDebateSchema = z.object({
  id: z.string().uuid(),
  topic: z.string().trim().min(3).max(500).optional(),
  direction: z.string().trim().max(2000).nullable().optional(),
  debaterAName: z.string().trim().min(1).max(60).optional(),
  debaterAPersona: z.string().trim().min(1).max(20000).optional(),
  debaterAModel: ModelSchema.optional(),
  debaterAImageUrl: z.string().trim().max(2048).nullable().optional(),
  debaterBName: z.string().trim().min(1).max(60).optional(),
  debaterBPersona: z.string().trim().min(1).max(20000).optional(),
  debaterBModel: ModelSchema.optional(),
  debaterBImageUrl: z.string().trim().max(2048).nullable().optional(),
  moderatorModel: ModelSchema.optional(),
  moderatorTone: z.enum(["formal", "descontraído", "acadêmico"]).optional(),
  rounds: z.number().int().min(2).max(6).optional(),
  blocksCount: z.number().int().min(2).max(6).optional(),
  dynamicFlow: z.boolean().optional(),
  voiceProviderMod: VoiceProviderSchema,
  voiceIdMod: VoiceIdSchema,
  voiceProviderA: VoiceProviderSchema,
  voiceIdA: VoiceIdSchema,
  voiceProviderB: VoiceProviderSchema,
  voiceIdB: VoiceIdSchema,
});


export const updateDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateDebateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...d } = data;
    // Mudança de estrutura (rounds/blocks) só é permitida se ainda não há falas geradas
    if (d.rounds !== undefined || d.blocksCount !== undefined) {
      const { count } = await context.supabase
        .from("debate_messages")
        .select("id", { count: "exact", head: true })
        .eq("debate_id", id);
      if ((count ?? 0) > 0) {
        throw new Error("Não dá pra mudar rodadas ou blocos depois que o debate começou. Apague as falas primeiro.");
      }
    }
    const patch: Record<string, string | number | boolean | null> = {};
    if (d.topic !== undefined) patch.topic = d.topic;
    if (d.direction !== undefined) patch.direction = d.direction || null;
    if (d.debaterAName !== undefined) patch.debater_a_name = d.debaterAName;
    if (d.debaterAPersona !== undefined) patch.debater_a_persona = d.debaterAPersona;
    if (d.debaterAModel !== undefined) patch.debater_a_model = d.debaterAModel;
    if (d.debaterAImageUrl !== undefined) patch.debater_a_image_url = d.debaterAImageUrl;
    if (d.debaterBName !== undefined) patch.debater_b_name = d.debaterBName;
    if (d.debaterBPersona !== undefined) patch.debater_b_persona = d.debaterBPersona;
    if (d.debaterBModel !== undefined) patch.debater_b_model = d.debaterBModel;
    if (d.debaterBImageUrl !== undefined) patch.debater_b_image_url = d.debaterBImageUrl;

    if (d.moderatorModel !== undefined) patch.moderator_model = d.moderatorModel;
    if (d.moderatorTone !== undefined) patch.moderator_tone = d.moderatorTone;
    if (d.rounds !== undefined) patch.rounds = d.rounds;
    if (d.blocksCount !== undefined) {
      patch.blocks_count = d.blocksCount;
      // Sub-temas viram inválidos se a contagem mudou; serão gerados de novo
      patch.block_subtopics = null;
    }
    if (d.dynamicFlow !== undefined) patch.dynamic_flow = d.dynamicFlow;
    if (d.voiceProviderMod !== undefined) patch.voice_provider_mod = d.voiceProviderMod;
    if (d.voiceIdMod !== undefined) patch.voice_id_mod = d.voiceIdMod;
    if (d.voiceProviderA !== undefined) patch.voice_provider_a = d.voiceProviderA;
    if (d.voiceIdA !== undefined) patch.voice_id_a = d.voiceIdA;
    if (d.voiceProviderB !== undefined) patch.voice_provider_b = d.voiceProviderB;
    if (d.voiceIdB !== undefined) patch.voice_id_b = d.voiceIdB;
    const { error } = await context.supabase.from("debates").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateSynopsis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ debateId: z.string().uuid(), force: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: debate, error } = await context.supabase
      .from("debates").select("id, topic, debater_a_name, debater_a_persona, debater_b_name, debater_b_persona, synopsis")
      .eq("id", data.debateId).single();
    if (error || !debate) throw new Error(error?.message ?? "Debate não encontrado.");
    if (debate.synopsis && !data.force) return { synopsis: debate.synopsis };
    const { chatComplete } = await import("./ai-gateway.server");
    const out = await chatComplete(
      [
        { role: "system", content: "Você escreve sinopses curtas e envolventes para anunciar um debate, como narrador de luta. Português. 2 a 3 frases, no máximo 320 caracteres. Sem aspas externas." },
        { role: "user", content: `Tema: "${debate.topic}"
Debatedor A: ${debate.debater_a_name} — ${(debate.debater_a_persona ?? "").slice(0, 400)}
Debatedor B: ${debate.debater_b_name} — ${(debate.debater_b_persona ?? "").slice(0, 400)}

Escreva a sinopse anunciando o confronto.` },
      ],
      "google/gemini-3-flash-preview",
    );
    const synopsis = out.replace(/^["']+|["']+$/g, "").trim().slice(0, 500);
    await context.supabase.from("debates").update({ synopsis }).eq("id", data.debateId);
    return { synopsis };
  });

export const listDebates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("debates")
      .select("id, topic, status, created_at, debater_a_name, debater_b_name")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: debate, error } = await context.supabase
      .from("debates").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: messages, error: mErr } = await context.supabase
      .from("debate_messages").select("*").eq("debate_id", data.id).order("order_index");
    if (mErr) throw new Error(mErr.message);
    return { debate, messages: messages ?? [] };
  });

export const deleteDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("debates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Criação assistida por IA (gerador de tema / debatedores opostos) =====

export const generateDebateTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ hint: z.string().trim().max(200).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { chatComplete } = await import("./ai-gateway.server");
    const hint = data.hint ? ` Área de interesse: "${data.hint}".` : "";
    const out = await chatComplete(
      [
        { role: "system", content: "Você gera temas de debate provocativos e equilibrados (dois lados fortes e defensáveis) para um canal do YouTube. Responda APENAS o tema, em português, sem aspas e sem explicação, no máximo 120 caracteres." },
        { role: "user", content: `Gere UM tema de debate original e polêmico, com dois lados claramente defensáveis.${hint}` },
      ],
      "google/gemini-3-flash-preview",
    );
    return { topic: out.replace(/^["']+|["']+$/g, "").trim().slice(0, 200) };
  });

export const generateOpposingDebaters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ topic: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { chatComplete } = await import("./ai-gateway.server");
    const raw = await chatComplete(
      [
        { role: "system", content: "Você cria dois debatedores com posições OPOSTAS e personalidades distintas. Responda APENAS JSON puro, sem markdown." },
        { role: "user", content: `Tema: "${data.topic}".

Crie dois debatedores contrastantes, em lados opostos. JSON:
{"a":{"name":"...","persona":"..."},"b":{"name":"...","persona":"..."}}
- name: nome curto e marcante (1-3 palavras).
- persona: 1-2 frases com personalidade + a posição que defende. Lados claramente opostos. Português.` },
      ],
      "google/gemini-2.5-flash",
    );
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    try {
      const p = JSON.parse(cleaned) as { a?: { name?: string; persona?: string }; b?: { name?: string; persona?: string } };
      if (!p.a?.name || !p.a?.persona || !p.b?.name || !p.b?.persona) throw new Error("incompleto");
      return {
        a: { name: p.a.name.slice(0, 60), persona: p.a.persona.slice(0, 500) },
        b: { name: p.b.name.slice(0, 60), persona: p.b.persona.slice(0, 500) },
      };
    } catch {
      throw new Error("A IA não retornou debatedores válidos. Tente novamente.");
    }
  });

// ===== Sorteios (roleta) de tema e subtema: lista curada + IA =====

const CURATED_THEMES = [
  "A inteligência artificial deveria ter direitos?",
  "Rede social faz mais mal do que bem para a sociedade?",
  "O livre-arbítrio é uma ilusão?",
  "Vale a pena colonizar Marte?",
  "Dinheiro compra felicidade?",
  "A escola tradicional está obsoleta?",
  "Carne cultivada em laboratório é o futuro?",
  "Anonimato na internet deveria ser proibido?",
  "A arte feita por IA é arte de verdade?",
  "Votar deveria ser obrigatório?",
  "Imortalidade: bênção ou maldição?",
  "Redes sociais deveriam ter idade mínima de 16 anos?",
];

// Recortes/facetas genéricas que funcionam como subárea de qualquer tema.
const CURATED_SUBTEMAS = [
  "Impacto econômico",
  "Questão ética",
  "Efeitos a longo prazo",
  "Quem é mais afetado",
  "O papel do Estado",
  "Comparação internacional",
];

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export const drawTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { chatComplete } = await import("./ai-gateway.server");
    let ai: string[] = [];
    try {
      const raw = await chatComplete(
        [
          { role: "system", content: "Você gera temas de debate polêmicos, com dois lados fortes. Responda APENAS JSON puro: {\"temas\":[\"...\"]}." },
          { role: "user", content: "Gere 4 temas de debate originais e variados, curtos (máx 90 caracteres cada). Português." },
        ],
        "google/gemini-3-flash-preview",
      );
      const p = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as { temas?: string[] };
      ai = (p.temas ?? []).filter(Boolean).map((t) => String(t).slice(0, 120)).slice(0, 4);
    } catch {
      ai = [];
    }
    const curated = sample(CURATED_THEMES, 5);
    return { options: sample([...curated, ...ai], Math.min(8, curated.length + ai.length)) };
  });

export const drawSubtemas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ topic: z.string().trim().max(500).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { chatComplete } = await import("./ai-gateway.server");
    let ai: string[] = [];
    if (data.topic) {
      try {
        const raw = await chatComplete(
          [
            { role: "system", content: "Você lista subáreas/recortes CONCRETOS de um tema amplo, para focar um trecho do debate. Ex: tema 'Política' → 'Segurança pública', 'Educação', 'Saneamento básico'. Responda APENAS JSON puro: {\"subtemas\":[\"...\"]}." },
            { role: "user", content: `Tema do debate: "${data.topic}". Liste 6 subáreas concretas desse tema que renderiam um bom aprofundamento (1 a 4 palavras cada). Português.` },
          ],
          "google/gemini-2.5-flash",
        );
        const p = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as { subtemas?: string[] };
        ai = (p.subtemas ?? []).filter(Boolean).map((t) => String(t).slice(0, 100)).slice(0, 6);
      } catch {
        ai = [];
      }
    }
    // Subáreas são específicas do tema → IA é a fonte principal; curadas entram só como complemento.
    const curated = sample(CURATED_SUBTEMAS, ai.length > 0 ? 2 : 6);
    return { options: sample([...curated, ...ai], Math.min(8, curated.length + ai.length)) };
  });

export const ttsSpeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ text: z.string().trim().min(1).max(5000), voiceId: z.string().trim().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { elevenTTS } = await import("./elevenlabs.server");
      return await elevenTTS(data.text, data.voiceId);
    } catch (e) {
      const error = e instanceof Error ? e.message : "ElevenLabs falhou.";
      return { audio: "", mime: "audio/mpeg" as const, error };
    }
  });

export const generateMatchupThemes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      aName: z.string().trim().min(1).max(120),
      aPersona: z.string().trim().max(20000).default(""),
      bName: z.string().trim().min(1).max(120),
      bPersona: z.string().trim().max(20000).default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { chatComplete } = await import("./ai-gateway.server");
    const raw = await chatComplete(
      [
        { role: "system", content: "Você sugere temas de debate sob medida para um confronto entre duas personalidades específicas, em que elas teriam visões fortemente opostas. Responda APENAS JSON puro: {\"temas\":[\"...\"]}." },
        { role: "user", content: `Confronto:
A = ${data.aName}${data.aPersona ? ` — ${data.aPersona.slice(0, 600)}` : ""}
B = ${data.bName}${data.bPersona ? ` — ${data.bPersona.slice(0, 600)}` : ""}

Sugira 6 temas em que esses dois divergiriam fortemente e renderiam um ótimo confronto. Curtos (máx 90 caracteres). Português.` },
      ],
      "google/gemini-2.5-flash",
    );
    try {
      const p = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as { temas?: string[] };
      const temas = (p.temas ?? []).filter(Boolean).map((t) => String(t).slice(0, 120)).slice(0, 8);
      if (temas.length === 0) throw new Error("vazio");
      return { options: temas };
    } catch {
      throw new Error("Não consegui sugerir temas para esse confronto. Tente novamente.");
    }
  });

export const injectSubtema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ debateId: z.string().uuid(), subtema: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { count, error: cErr } = await context.supabase
      .from("debate_messages")
      .select("id", { count: "exact", head: true })
      .eq("debate_id", data.debateId);
    if (cErr) throw new Error(cErr.message);
    const orderIndex = count ?? 0;
    const content = `🎲 Reviravolta! Vamos focar agora na subárea: "${data.subtema}". Debatedores, tragam este recorte para a discussão a partir de agora.`;
    const { data: inserted, error } = await context.supabase
      .from("debate_messages").insert({
        debate_id: data.debateId,
        user_id: context.userId,
        role: "moderator",
        phase: "reviravolta",
        content,
        order_index: orderIndex,
      }).select().single();
    if (error) throw new Error(error.message);
    // Reabre o debate se já estava concluído, para gerar falas que reagem.
    await context.supabase.from("debates").update({ status: "ready" }).eq("id", data.debateId);
    return inserted;
  });

export type Verdict = {
  winner: "a" | "b" | "empate";
  summary: string;
  criteria: Array<{ name: string; weight: number; a: number; b: number }>;
  bonus: { a: number; b: number };
  penalty: { a: number; b: number };
  scoreA: number; // 0-100 (ponderado + ajustes)
  scoreB: number;
  mvp_quote: string;
};

// Critérios ponderados (somam 1) — evidência tem o maior peso, como num debate sério.
const VERDICT_CRITERIA = [
  { name: "Qualidade do argumento", weight: 0.2 },
  { name: "Qualidade da evidência", weight: 0.4 },
  { name: "Consistência lógica", weight: 0.2 },
  { name: "Resposta às falhas do oponente", weight: 0.2 },
] as const;

function clampInt(n: unknown, max: number): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
}

export const generateVerdict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ debateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Verdict> => {
    const { chatComplete } = await import("./ai-gateway.server");

    const { data: debate, error: dErr } = await context.supabase
      .from("debates").select("*").eq("id", data.debateId).single();
    if (dErr || !debate) throw new Error(dErr?.message ?? "Debate não encontrado.");

    const { data: messages, error: mErr } = await context.supabase
      .from("debate_messages").select("role, phase, content").eq("debate_id", data.debateId).order("order_index");
    if (mErr) throw new Error(mErr.message);
    const msgs = (messages ?? []) as Msg[];
    if (msgs.length === 0) throw new Error("O debate ainda não tem falas para avaliar.");

    const transcript = msgs.map((m) => `[${labelFor(m.role, debate)}] (${m.phase}): ${m.content}`).join("\n\n");
    const critList = VERDICT_CRITERIA.map((c, i) => `${i + 1}. ${c.name} (peso ${Math.round(c.weight * 100)}%)`).join("\n");
    const raw = await chatComplete(
      [
        { role: "system", content: "Você é um juiz imparcial e rigoroso de debates. Avalia por critérios ponderados, premia quem reconhece pontos válidos do oponente e penaliza fraquezas não respondidas. Responda APENAS JSON puro, sem markdown." },
        { role: "user", content: `Tema: "${debate.topic}"
Debatedor A: ${debate.debater_a_name}
Debatedor B: ${debate.debater_b_name}

Transcrição do debate:
${transcript}

Avalie cada debatedor (A e B) nos critérios, NA ORDEM:
${critList}

Responda JSON (notas 0-10 nos critérios; bonus/penalty 0-5):
{
  "summary": "2-3 frases resumindo o debate e por que esse lado venceu",
  "criteria": [
    {"a":0,"b":0},
    {"a":0,"b":0},
    {"a":0,"b":0},
    {"a":0,"b":0}
  ],
  "bonus": {"a":0,"b":0},
  "penalty": {"a":0,"b":0},
  "mvp_quote": "uma frase de impacto realmente dita no debate"
}
- bonus: reconheceu pontos válidos do oponente e ainda assim sustentou sua posição.
- penalty: deixou fraquezas/contra-argumentos importantes sem resposta.
Seja justo e específico ao tema. Português.` },
      ],
      debate.moderator_model || "google/gemini-2.5-pro",
    );

    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    try {
      const p = JSON.parse(cleaned) as {
        summary?: string; mvp_quote?: string;
        criteria?: Array<{ a?: number; b?: number }>;
        bonus?: { a?: number; b?: number };
        penalty?: { a?: number; b?: number };
      };
      const criteria = VERDICT_CRITERIA.map((c, i) => ({
        name: c.name,
        weight: c.weight,
        a: clampInt(p.criteria?.[i]?.a, 10),
        b: clampInt(p.criteria?.[i]?.b, 10),
      }));
      const bonus = { a: clampInt(p.bonus?.a, 5), b: clampInt(p.bonus?.b, 5) };
      const penalty = { a: clampInt(p.penalty?.a, 5), b: clampInt(p.penalty?.b, 5) };

      // Pontuação ponderada (0-100) + ajustes (cada ponto de bônus/penalidade vale 2).
      const weighted = (side: "a" | "b") => criteria.reduce((s, c) => s + c.weight * c[side], 0) * 10;
      const scoreA = Math.max(0, Math.min(100, Math.round(weighted("a") + bonus.a * 2 - penalty.a * 2)));
      const scoreB = Math.max(0, Math.min(100, Math.round(weighted("b") + bonus.b * 2 - penalty.b * 2)));
      const diff = scoreA - scoreB;
      const winner: Verdict["winner"] = Math.abs(diff) <= 3 ? "empate" : diff > 0 ? "a" : "b";

      const verdict: Verdict = {
        winner,
        summary: String(p.summary ?? "").slice(0, 800),
        criteria,
        bonus,
        penalty,
        scoreA,
        scoreB,
        mvp_quote: String(p.mvp_quote ?? "").slice(0, 300),
      };

      const { error: uErr } = await context.supabase
        .from("debates").update({ verdict }).eq("id", data.debateId);
      if (uErr) throw new Error(uErr.message);
      return verdict;
    } catch (e) {
      if (e instanceof Error && e.message.includes("column")) throw e;
      throw new Error("A IA não retornou um veredito válido. Tente novamente.");
    }
  });

export type Subtopic = { title: string; focus: string };

export type Debate = {
  id: string;
  rounds: number;
  blocks_count: number;
  block_subtopics: Subtopic[] | null;
  rules: string | null;
  topic: string;
  debater_a_name: string; debater_a_persona: string; debater_a_model: string;
  debater_b_name: string; debater_b_persona: string; debater_b_model: string;
  moderator_model: string; moderator_tone: string;
  dynamic_flow: boolean;
  direction?: string | null;
};
type Msg = { role: string; phase: string; content: string };

export async function ensureBlockSubtopics(
  debate: Debate,
  supabase: { from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<unknown> } } },
  chat: (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, model?: string) => Promise<string>,
): Promise<Subtopic[]> {
  const existing = debate.block_subtopics;
  const n = debate.blocks_count ?? 4;
  if (existing && Array.isArray(existing) && existing.length === n) return existing;
  let subtopics: Subtopic[] = [];
  try {
    const raw = await chat(
      [
        { role: "system", content: "Você divide um tema de debate em sub-temas para um programa de TV de N blocos. Cada sub-tema é um recorte CONCRETO e diferente do tema principal. Responda APENAS JSON puro." },
        { role: "user", content: `Tema: "${debate.topic}"
Debatedor A: ${debate.debater_a_name} — ${debate.debater_a_persona.slice(0, 400)}
Debatedor B: ${debate.debater_b_name} — ${debate.debater_b_persona.slice(0, 400)}

Gere exatamente ${n} blocos para o debate, na ordem em que farão mais sentido (do mais geral ao mais específico). O ÚLTIMO bloco DEVE ser "Considerações finais e veredito".

Responda JSON: {"subtopics":[{"title":"...","focus":"..."}]}
- title: 2-6 palavras
- focus: 1 frase orientando no que A e B devem focar nesse bloco
- Português` },
      ],
      "google/gemini-3-flash-preview",
    );
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as { subtopics?: Array<{ title?: string; focus?: string }> };
    subtopics = (parsed.subtopics ?? [])
      .filter((s): s is { title: string; focus: string } => !!s?.title && !!s?.focus)
      .slice(0, n)
      .map((s) => ({ title: s.title.slice(0, 80), focus: s.focus.slice(0, 240) }));
  } catch {
    subtopics = [];
  }
  if (subtopics.length !== n) {
    // Fallback: cobre todos os slots
    subtopics = Array.from({ length: n }, (_, i) =>
      i === n - 1
        ? { title: "Considerações finais e veredito", focus: "Cada lado faz um fechamento e o mediador dá o veredito." }
        : { title: `Bloco ${i + 1}`, focus: `Aprofunde um ângulo diferente de "${debate.topic}".` },
    );
  } else {
    // Garante que o último seja o fechamento
    subtopics[n - 1] = subtopics[n - 1] ?? { title: "Considerações finais e veredito", focus: "Fechamento e veredito." };
  }
  await supabase.from("debates").update({ block_subtopics: subtopics }).eq("id", debate.id);
  debate.block_subtopics = subtopics;
  return subtopics;
}

export const generateNextTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ debateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai-gateway.server");

    const { data: debateRow, error: dErr } = await context.supabase
      .from("debates").select("*").eq("id", data.debateId).single();
    if (dErr || !debateRow) throw new Error(dErr?.message ?? "Debate não encontrado.");
    const debate = debateRow as unknown as Debate & { format?: string };
    const formatId = (debate.format ?? "duel") as string;

    const { data: messages, error: mErr } = await context.supabase
      .from("debate_messages").select("*").eq("debate_id", data.debateId).order("order_index");
    if (mErr) throw new Error(mErr.message);

    const existing = messages ?? [];
    const subtopics = await ensureBlockSubtopics(debate, context.supabase as never, chatComplete);

    // ====== MULTI-PARTICIPANT BRANCH ======
    if (formatId !== "duel") {
      const parts = await loadParticipants(context.supabase, debate);
      const seq = multiSeq(debate, parts);
      const seqCount = existing.filter((m) => m.phase !== "reviravolta").length;
      const next = seq[seqCount];
      if (!next) return { done: true, message: null };

      const transcript = existing
        .map((m) => `[${labelForMulti(m.role, parts)}] (${m.phase}): ${m.content}`)
        .join("\n\n");

      const block = subtopics[next.block_index] ?? subtopics[0];
      const blocksTotal = subtopics.length;
      const sysPrompt = buildSystemPromptMulti(next.role, parts, debate, formatId);

      const speakerLabel = labelForMulti(next.role, parts);
      const castSummary = parts
        .map((p) => `- ${p.displayName} (${p.participantRole})`)
        .join("\n");

      let userPrompt: string;
      if (next.phase.startsWith("vinheta")) {
        if (next.block_index === 0) {
          userPrompt = `Você abre um programa de TV no formato ${formatId}.
Tema: ${debate.topic}
Elenco:
${castSummary}

Primeiro bloco — "${block.title}". Foco: ${block.focus}.

Em até 140 palavras (texto corrido, sem markdown), saúde a audiência, apresente o formato em uma frase, apresente cada participante em UMA frase (nome + quem é), e anuncie quem começa formulando a primeira pergunta do bloco.`;
        } else {
          userPrompt = `Tema geral: ${debate.topic}
Bloco ${next.block_index + 1}/${blocksTotal} — "${block.title}"
Foco: ${block.focus}

Faça a vinheta de abertura desse bloco em 2-3 frases, em tom de programa de TV. Sem veredito. Máximo 80 palavras.`;
        }
      } else if (next.phase === "veredito") {
        userPrompt = `Tema: ${debate.topic}
Regras:
${debate.rules}

Histórico:
${transcript}

Encerre o programa conforme o formato ${formatId}. ${
  formatId === "century_problem"
    ? "Síntese da SOLUÇÃO COLABORATIVA construída pelo elenco."
    : formatId === "sages_council"
    ? "Síntese reflexiva e novas perguntas levantadas pelos sábios."
    : formatId === "tribunal"
    ? "Anuncie o VEREDITO coletivo dos jurados com base nas deliberações."
    : formatId === "interview"
    ? "Encerramento curto agradecendo o entrevistado."
    : "Avalie quem foi mais convincente."
} Máximo 200 palavras.`;
      } else if (next.phase === "deliberação") {
        userPrompt = `Tema: ${debate.topic}
Histórico:
${transcript}

Como JURADO, dê sua deliberação curta (3-5 frases): quem te convenceu mais e por quê. Sem decretar veredito final — só sua leitura. Português.`;
      } else {
        const semanticHint = SEMANTIC_ROLE_HINT[parts.find((p) => p.role === next.role)?.participantRole ?? ""] ?? "";
        userPrompt = `Tema: ${debate.topic}
Bloco ${next.block_index + 1}/${blocksTotal} — "${block.title}"
Foco: ${block.focus}
${semanticHint}

Histórico:
${transcript || "(início)"}

Você é ${speakerLabel}. Produza sua fala da fase "${next.phase}". Em até 180 palavras, português, texto corrido, sem prefixo de nome.`;
      }

      const model = modelForMulti(next.role, parts, debate);
      const content = await chatComplete(
        [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        model,
      );

      const { data: inserted, error: iErr } = await context.supabase
        .from("debate_messages").insert({
          debate_id: data.debateId,
          user_id: context.userId,
          role: next.role,
          phase: next.phase,
          block_index: next.block_index,
          content,
          order_index: existing.length,
        }).select().single();
      if (iErr) throw new Error(iErr.message);

      const willDone = next.phase === "veredito" || seqCount + 1 >= seq.length;
      if (willDone) {
        await context.supabase.from("debates").update({ status: "completed" }).eq("id", data.debateId);
      }
      return { done: false, message: inserted };
    }

    // ====== LEGACY DUEL PATH ======
    const next = await decideNextTurn(debate, existing, chatComplete);
    if (!next) return { done: true, message: null };

    const transcript = existing
      .map((m) => `[${labelFor(m.role, debate)}] (${m.phase}): ${m.content}`)
      .join("\n\n");

    const block = subtopics[next.block_index] ?? subtopics[0];
    const blocksTotal = subtopics.length;
    const sysPrompt = buildSystemPrompt(next.role, debate);
    const guidance = next.guidance ? `\n\nOrientação do mediador para esta fala: ${next.guidance}` : "";

    let userPrompt: string;
    if (next.phase.startsWith("vinheta")) {
      if (next.block_index === 0) {
        userPrompt = `Você abre um debate de TV ao vivo no formato Roda Viva.
Tema do programa: ${debate.topic}
Convidado A: ${debate.debater_a_name} — ${(debate.debater_a_persona ?? "").slice(0, 400)}
Convidado B: ${debate.debater_b_name} — ${(debate.debater_b_persona ?? "").slice(0, 400)}
Primeiro bloco — "${block.title}". Foco do bloco: ${block.focus}.

Sua tarefa, em até 140 palavras, em texto corrido (sem markdown, sem listas):
1. Saúde a audiência e abra o programa com energia jornalística.
2. Apresente cada convidado em UMA frase (nome + quem é, tom jornalístico — NÃO leia a biografia inteira).
3. Anuncie explicitamente que "começamos com ${debate.debater_a_name}" e formule a PRIMEIRA PERGUNTA do bloco, derivada do foco acima, dirigida a ele(a).`;
      } else {
        userPrompt = `Tema geral: ${debate.topic}

Você está apresentando o BLOCO ${next.block_index + 1} de ${blocksTotal} de um debate de TV.
Título do bloco: "${block.title}"
Foco: ${block.focus}

Sua tarefa: dar a vinheta de abertura desse bloco em 2-3 frases, anunciando o sub-tema com energia de programa de TV. NÃO faça veredito. Português. Máximo 80 palavras.`;
      }
    } else if (next.phase === "veredito") {
      userPrompt = `Tema: ${debate.topic}
Regras:
${debate.rules}

Histórico completo:
${transcript}${guidance}

Encerre o programa com seu VEREDITO (quem foi mais convincente e por quê, mencionando momentos do debate). Português. Máximo 180 palavras.`;
    } else {
      userPrompt = `Tema geral: ${debate.topic}
Regras do mediador:
${debate.rules}

BLOCO ATUAL (${next.block_index + 1}/${blocksTotal}) — "${block.title}"
Foco deste bloco: ${block.focus}
${next.phase === "considerações finais" ? "Este é o bloco de fechamento do programa." : "Foque EXCLUSIVAMENTE no sub-tema acima — não pule pra outro recorte."}

Histórico até agora:
${transcript || "(o debate ainda não começou)"}${guidance}

Sua tarefa: produzir a próxima fala da fase "${next.phase}" dentro deste bloco. Seja claro, direto e envolvente em português. Máximo de 180 palavras. NÃO inclua o nome ou prefixo — apenas o conteúdo da fala.`;
    }

    const model = modelFor(next.role, debate);
    const content = await chatComplete(
      [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
    );

    const { data: inserted, error: iErr } = await context.supabase
      .from("debate_messages").insert({
        debate_id: data.debateId,
        user_id: context.userId,
        role: next.role,
        phase: next.phase,
        block_index: next.block_index,
        content,
        order_index: existing.length,
      }).select().single();
    if (iErr) throw new Error(iErr.message);

    const seqCount = existing.filter((m) => m.phase !== "reviravolta").length;
    const willDone = next.phase === "veredito" || (!debate.dynamic_flow && seqCount + 1 >= fullSeqLength(debate));
    if (willDone) {
      await context.supabase.from("debates").update({ status: "completed" }).eq("id", data.debateId);
    }

    return { done: false, message: inserted };
  });

// ============================================================
//                MULTI-PARTICIPANT HELPERS
// ============================================================

export type Participant = {
  role: string;
  slot: number;
  participantRole: string;
  displayName: string;
  personaPrompt: string;
  model: string;
  voiceProvider: string | null;
  voiceId: string | null;
  imageUrl: string | null;
};

const SPEAKING_ROLES = new Set([
  "debater", "prosecutor", "defender", "interviewer", "interviewee", "team_a", "team_b",
]);

const SEMANTIC_ROLE_HINT: Record<string, string> = {
  debater: "Você é um debatedor: defenda sua posição com convicção e rebata os oponentes quando fizer sentido.",
  prosecutor: "Você é da ACUSAÇÃO neste tribunal: estabeleça os fatos contra o réu de forma firme e precisa.",
  defender: "Você é da DEFESA neste tribunal: rebata as acusações e proteja a posição do réu com argumentos.",
  judge: "Você é JUIZ/JURADO: pondere as evidências de cada lado e dê seu parecer com equilíbrio.",
  interviewer: "Você é o ENTREVISTADOR: faça perguntas curtas, certeiras e provocativas. Não disserte.",
  interviewee: "Você é o ENTREVISTADO: responda com profundidade, sinceridade e detalhes pessoais.",
  team_a: "Você representa o TIME A: alinhe-se com seus aliados, ataque os argumentos do time B.",
  team_b: "Você representa o TIME B: alinhe-se com seus aliados, ataque os argumentos do time A.",
};

export async function loadParticipants(
  supabase: unknown,
  debate: Debate & {
    debater_a_image_url?: string | null;
    debater_b_image_url?: string | null;
    voice_provider_a?: string | null; voice_id_a?: string | null;
    voice_provider_b?: string | null; voice_id_b?: string | null;
  },
): Promise<Participant[]> {
  const out: Participant[] = [
    {
      role: "a", slot: 0, participantRole: "debater",
      displayName: debate.debater_a_name,
      personaPrompt: debate.debater_a_persona,
      model: debate.debater_a_model,
      voiceProvider: debate.voice_provider_a ?? null,
      voiceId: debate.voice_id_a ?? null,
      imageUrl: debate.debater_a_image_url ?? null,
    },
    {
      role: "b", slot: 1, participantRole: "debater",
      displayName: debate.debater_b_name,
      personaPrompt: debate.debater_b_persona,
      model: debate.debater_b_model,
      voiceProvider: debate.voice_provider_b ?? null,
      voiceId: debate.voice_id_b ?? null,
      imageUrl: debate.debater_b_image_url ?? null,
    },
  ];
  const sb = supabase as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { order: (c: string) => Promise<{ data: unknown[] | null }> } } } };
  const res = await sb.from("debate_participants").select("*").eq("debate_id", debate.id).order("slot");
  const rows = (res.data ?? []) as Array<{
    slot: number; role: string; display_name: string; persona_prompt: string | null;
    model: string | null; voice_provider: string | null; voice_id: string | null; image_url: string | null;
  }>;
  for (const r of rows) {
    out.push({
      role: `ex${r.slot}`,
      slot: r.slot,
      participantRole: r.role,
      displayName: r.display_name,
      personaPrompt: r.persona_prompt ?? "",
      model: r.model ?? debate.moderator_model,
      voiceProvider: r.voice_provider,
      voiceId: r.voice_id,
      imageUrl: r.image_url,
    });
  }
  return out;
}

function multiSpeakers(parts: Participant[]): Participant[] {
  return parts.filter((p) => SPEAKING_ROLES.has(p.participantRole));
}

function multiSeq(debate: Debate, parts: Participant[]) {
  const speakers = multiSpeakers(parts);
  const judges = parts.filter((p) => p.participantRole === "judge");
  const n = debate.blocks_count ?? 4;
  const seq: Array<{ role: string; phase: string; block_index: number }> = [];
  for (let b = 0; b < n; b++) {
    const isFinal = b === n - 1;
    seq.push({ role: "moderator", phase: `vinheta ${b + 1}`, block_index: b });
    if (isFinal) {
      for (const s of speakers) seq.push({ role: s.role, phase: "considerações finais", block_index: b });
      for (const j of judges) seq.push({ role: j.role, phase: "deliberação", block_index: b });
      seq.push({ role: "moderator", phase: "veredito", block_index: b });
    } else {
      for (const s of speakers) seq.push({ role: s.role, phase: "abertura", block_index: b });
      for (let r = 1; r <= debate.rounds; r++) {
        for (const s of speakers) seq.push({ role: s.role, phase: `réplica ${r}`, block_index: b });
      }
    }
  }
  return seq;
}

export function labelForMulti(role: string, parts: Participant[]): string {
  if (role === "moderator") return "Mediador";
  const p = parts.find((x) => x.role === role);
  return p?.displayName ?? role;
}

function modelForMulti(role: string, parts: Participant[], debate: Debate): string {
  if (role === "moderator") return debate.moderator_model;
  const p = parts.find((x) => x.role === role);
  return p?.model ?? debate.moderator_model;
}

function buildSystemPromptMulti(role: string, parts: Participant[], debate: Debate, formatId: string): string {
  if (role === "moderator") {
    const fmt = FORMAT_RULES_HINTS[formatId] ?? "";
    return `Você é o MEDIADOR de um programa de TV. ${fmt}\nTom: ${debate.moderator_tone}. Apresente fases, faça transições e, no encerramento, conduza o desfecho conforme o formato. Português.${directionClause(debate)}${TTS_STYLE_RULES}`;
  }
  const p = parts.find((x) => x.role === role);
  if (!p) return `Você é um participante de um programa de TV. Português.${TTS_STYLE_RULES}`;
  const hint = SEMANTIC_ROLE_HINT[p.participantRole] ?? "";
  return `Você é ${p.displayName}. ${p.personaPrompt}\n\n${hint}\nFale em português.${directionClause(debate)}${DEBATER_STAGE_RULES}${TTS_STYLE_RULES}`;
}




export function labelFor(role: string, debate: { debater_a_name: string; debater_b_name: string }) {
  if (role === "moderator") return "Mediador";
  if (role === "a") return debate.debater_a_name;
  if (role === "b") return debate.debater_b_name;
  return role;
}

export function modelFor(role: "moderator" | "a" | "b", debate: Debate) {
  if (role === "moderator") return debate.moderator_model;
  if (role === "a") return debate.debater_a_model;
  return debate.debater_b_model;
}

const TTS_STYLE_RULES = `\n\nFORMATO OBRIGATÓRIO: sua resposta vai direto para um sintetizador de voz (TTS). Escreva APENAS texto corrido em frases faladas. PROIBIDO usar markdown, asteriscos (**), sublinhados (__), crases, marcadores de lista, títulos (#), emojis, ou qualquer pontuação tipográfica diferente de . , ? ! ; :. Não escreva "negrito" nem destaque palavras com símbolos — use ênfase apenas pela escolha das palavras.`;

const DEBATER_STAGE_RULES = `\n\nVocê está num DEBATE de TV ao vivo, NÃO em horário eleitoral. Nunca encerre como propaganda política: não diga "meu nome é ...", não peça voto, não recite slogan de campanha, não se reapresente a cada fala. Vá direto ao argumento do bloco atual, rebata o oponente quando fizer sentido, e termine a fala no próprio argumento — sem assinatura.`;

/** Instrução de direcionamento opcional definida pelo criador do debate. */
export function directionClause(debate: { direction?: string | null }): string {
  return debate.direction && debate.direction.trim()
    ? `\n\nDIRECIONAMENTO DO DEBATE (siga à risca no tom, na linguagem e no objetivo): ${debate.direction.trim()}`
    : "";
}

export function buildSystemPrompt(role: "moderator" | "a" | "b", debate: Debate) {
  if (role === "moderator") {
    return `Você é o MEDIADOR de um debate, tom ${debate.moderator_tone}. Apresente fases, faça transições e, no veredito, avalie quem foi mais convincente sem ofender. Fale em português.${directionClause(debate)}${TTS_STYLE_RULES}`;
  }
  if (role === "a") {
    return `Você é ${debate.debater_a_name}. Personalidade e posição: ${debate.debater_a_persona}. Defenda sua posição com convicção, rebatendo o oponente quando fizer sentido. Fale em português.${directionClause(debate)}${DEBATER_STAGE_RULES}${TTS_STYLE_RULES}`;
  }
  return `Você é ${debate.debater_b_name}. Personalidade e posição: ${debate.debater_b_persona}. Defenda sua posição com convicção, rebatendo o oponente quando fizer sentido. Fale em português.${directionClause(debate)}${DEBATER_STAGE_RULES}${TTS_STYLE_RULES}`;
}

// ===== Sequência com blocos estilo programa de TV =====
// Para cada bloco intermediário: vinheta(mod) + abertura(A) + abertura(B) + (réplica A + réplica B) × rounds
// Bloco final: vinheta(mod) + considerações finais(A) + considerações finais(B) + veredito(mod)

function blockTurnsCount(rounds: number, isFinal: boolean): number {
  if (isFinal) return 1 + 2 + 1; // vinheta + A fim + B fim + veredito
  return 1 + 2 + rounds * 2; // vinheta + 2 aberturas + rounds × 2 réplicas
}

function fullSeqLength(debate: Pick<Debate, "rounds" | "blocks_count">): number {
  const n = debate.blocks_count ?? 4;
  let total = 0;
  for (let i = 0; i < n; i++) total += blockTurnsCount(debate.rounds, i === n - 1);
  return total;
}

function fixedSeq(debate: Pick<Debate, "rounds" | "blocks_count">) {
  const n = debate.blocks_count ?? 4;
  const seq: Array<{ role: "moderator" | "a" | "b"; phase: string; block_index: number }> = [];
  for (let b = 0; b < n; b++) {
    const isFinal = b === n - 1;
    seq.push({ role: "moderator", phase: `vinheta ${b + 1}`, block_index: b });
    if (isFinal) {
      seq.push({ role: "a", phase: "considerações finais", block_index: b });
      seq.push({ role: "b", phase: "considerações finais", block_index: b });
      seq.push({ role: "moderator", phase: "veredito", block_index: b });
    } else {
      seq.push({ role: "a", phase: "abertura", block_index: b });
      seq.push({ role: "b", phase: "abertura", block_index: b });
      for (let r = 1; r <= debate.rounds; r++) {
        seq.push({ role: "a", phase: `réplica ${r}`, block_index: b });
        seq.push({ role: "b", phase: `réplica ${r}`, block_index: b });
      }
    }
  }
  return seq;
}

type NextTurn = { role: "moderator" | "a" | "b"; phase: string; block_index: number; guidance?: string };

async function decideNextTurn(
  debate: Debate,
  existing: Msg[],
  chat: (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, model?: string) => Promise<string>,
): Promise<NextTurn | null> {
  // "reviravolta" messages são contexto puro — não consomem slot.
  const seqCount = existing.filter((m) => m.phase !== "reviravolta").length;
  const seq = fixedSeq(debate);

  if (!debate.dynamic_flow) {
    return seq[seqCount] ?? null;
  }

  // Fluxo dinâmico: mediador continua decidindo dentro de cada bloco,
  // mas vinhetas, aberturas, considerações finais e veredito são fixas.
  const fixed = seq[seqCount];
  if (!fixed) return null;
  if (fixed.role === "moderator" || fixed.phase === "abertura" || fixed.phase === "considerações finais") {
    return fixed;
  }

  // Estamos numa réplica — deixa o mediador escolher A ou B.
  const transcript = existing.map((m) => `[${labelFor(m.role, debate)}] (${m.phase}): ${m.content}`).join("\n\n");
  const block = (debate.block_subtopics ?? [])[fixed.block_index];
  const blockHint = block ? `\nBloco atual: "${block.title}" — ${block.focus}` : "";
  const decision = await chat(
    [
      {
        role: "system",
        content: `Você é o MEDIADOR de um debate. Decida quem deve falar agora dentro do bloco atual: "${debate.debater_a_name}" (A) ou "${debate.debater_b_name}" (B). Responda APENAS um JSON válido: {"speaker":"a"|"b","instruction":"..."}. A instrução deve orientar o próximo a rebater um ponto específico do oponente DENTRO do sub-tema do bloco. Sem markdown, sem texto extra.`,
      },
      { role: "user", content: `Tema: ${debate.topic}${blockHint}\n\nHistórico:\n${transcript}\n\nQuem fala agora e o que deve abordar?` },
    ],
    debate.moderator_model,
  );

  try {
    const cleaned = decision.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as { speaker?: string; instruction?: string };
    const speaker = parsed.speaker === "b" ? "b" : "a";
    return { role: speaker, phase: fixed.phase, block_index: fixed.block_index, guidance: parsed.instruction };
  } catch {
    const lastDebater = [...existing].reverse().find((m) => m.role === "a" || m.role === "b");
    const speaker = lastDebater?.role === "a" ? "b" : "a";
    return { role: speaker, phase: fixed.phase, block_index: fixed.block_index };
  }
}
