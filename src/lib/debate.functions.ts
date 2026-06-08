import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ModelSchema = z.string().min(3).max(80);

const NewDebateSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  debaterAName: z.string().trim().min(1).max(60),
  debaterAPersona: z.string().trim().min(1).max(20000),
  debaterAModel: ModelSchema.default("google/gemini-3-flash-preview"),
  debaterBName: z.string().trim().min(1).max(60),
  debaterBPersona: z.string().trim().min(1).max(20000),
  debaterBModel: ModelSchema.default("google/gemini-3-flash-preview"),
  moderatorModel: ModelSchema.default("google/gemini-3-flash-preview"),
  moderatorTone: z.enum(["formal", "descontraído", "acadêmico"]),
  rounds: z.number().int().min(2).max(6),
  dynamicFlow: z.boolean().default(false),
});

export const createDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NewDebateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai-gateway.server");
    const rulesPrompt = `Você é o MEDIADOR de um debate de IAs para um canal do YouTube.
Tema: "${data.topic}"
Debatedor A: ${data.debaterAName} — ${data.debaterAPersona}
Debatedor B: ${data.debaterBName} — ${data.debaterBPersona}
Tom: ${data.moderatorTone}
Rodadas: ${data.rounds}
Fluxo: ${data.dynamicFlow ? "dinâmico (mediador decide quem fala)" : "fixo (alternado A/B)"}

Escreva em português um documento curto (~250 palavras) com:
1. Apresentação do tema
2. Regras claras do debate (tempo, respeito, formato)
3. Critérios de avaliação
4. Ordem das falas

Use markdown com títulos curtos. Seja direto e envolvente.`;

    const rules = await chatComplete(
      [
        { role: "system", content: "Você é um mediador profissional de debates." },
        { role: "user", content: rulesPrompt },
      ],
      data.moderatorModel,
    );

    const { data: debate, error } = await context.supabase
      .from("debates")
      .insert({
        user_id: context.userId,
        topic: data.topic,
        debater_a_name: data.debaterAName,
        debater_a_persona: data.debaterAPersona,
        debater_a_model: data.debaterAModel,
        debater_b_name: data.debaterBName,
        debater_b_persona: data.debaterBPersona,
        debater_b_model: data.debaterBModel,
        moderator_model: data.moderatorModel,
        moderator_tone: data.moderatorTone,
        rounds: data.rounds,
        dynamic_flow: data.dynamicFlow,
        rules,
        status: "ready",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: debate.id, rules };
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

type Debate = {
  rounds: number;
  rules: string | null;
  topic: string;
  debater_a_name: string; debater_a_persona: string; debater_a_model: string;
  debater_b_name: string; debater_b_persona: string; debater_b_model: string;
  moderator_model: string; moderator_tone: string;
  dynamic_flow: boolean;
};
type Msg = { role: string; phase: string; content: string };

export const generateNextTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ debateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai-gateway.server");

    const { data: debate, error: dErr } = await context.supabase
      .from("debates").select("*").eq("id", data.debateId).single();
    if (dErr || !debate) throw new Error(dErr?.message ?? "Debate não encontrado.");

    const { data: messages, error: mErr } = await context.supabase
      .from("debate_messages").select("*").eq("debate_id", data.debateId).order("order_index");
    if (mErr) throw new Error(mErr.message);

    const existing = messages ?? [];
    const next = await decideNextTurn(debate as Debate, existing, chatComplete);
    if (!next) return { done: true, message: null };

    const transcript = existing
      .map((m) => `[${labelFor(m.role, debate)}] (${m.phase}): ${m.content}`)
      .join("\n\n");

    const sysPrompt = buildSystemPrompt(next.role, debate as Debate);
    const guidance = next.guidance ? `\n\nOrientação do mediador para esta fala: ${next.guidance}` : "";
    const userPrompt = `Tema: ${debate.topic}
Regras do mediador:
${debate.rules}

Histórico até agora:
${transcript || "(o debate ainda não começou)"}${guidance}

Sua tarefa: produzir a próxima fala da fase "${next.phase}". Seja claro, direto e envolvente em português. Máximo de 180 palavras. NÃO inclua o nome ou prefixo — apenas o conteúdo da fala.`;

    const model = modelFor(next.role, debate as Debate);
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
        content,
        order_index: existing.length,
      }).select().single();
    if (iErr) throw new Error(iErr.message);

    // Recompute terminal state based on the updated history
    const after = [...existing, { role: next.role, phase: next.phase, content }];
    const willDone = next.phase === "veredito" || (!debate.dynamic_flow && existing.length + 1 >= fixedSeqLength(debate.rounds));
    if (willDone) {
      await context.supabase.from("debates").update({ status: "completed" }).eq("id", data.debateId);
    }
    void after;

    return { done: false, message: inserted };
  });

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

export function buildSystemPrompt(role: "moderator" | "a" | "b", debate: Debate) {
  if (role === "moderator") {
    return `Você é o MEDIADOR de um debate, tom ${debate.moderator_tone}. Apresente fases, faça transições e, no veredito, avalie quem foi mais convincente sem ofender. Fale em português.`;
  }
  if (role === "a") {
    return `Você é ${debate.debater_a_name}. Personalidade e posição: ${debate.debater_a_persona}. Defenda sua posição com convicção, rebatendo o oponente quando fizer sentido. Fale em português.`;
  }
  return `Você é ${debate.debater_b_name}. Personalidade e posição: ${debate.debater_b_persona}. Defenda sua posição com convicção, rebatendo o oponente quando fizer sentido. Fale em português.`;
}

function fixedSeqLength(rounds: number) {
  return 3 + rounds * 2 + 3;
}

function fixedSeq(rounds: number) {
  const seq: Array<{ role: "moderator" | "a" | "b"; phase: string }> = [
    { role: "moderator", phase: "abertura" },
    { role: "a", phase: "abertura" },
    { role: "b", phase: "abertura" },
  ];
  for (let r = 1; r <= rounds; r++) {
    seq.push({ role: "a", phase: `réplica ${r}` });
    seq.push({ role: "b", phase: `réplica ${r}` });
  }
  seq.push({ role: "a", phase: "considerações finais" });
  seq.push({ role: "b", phase: "considerações finais" });
  seq.push({ role: "moderator", phase: "veredito" });
  return seq;
}

type NextTurn = { role: "moderator" | "a" | "b"; phase: string; guidance?: string };

async function decideNextTurn(
  debate: Debate,
  existing: Msg[],
  chat: (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, model?: string) => Promise<string>,
): Promise<NextTurn | null> {
  if (!debate.dynamic_flow) {
    const seq = fixedSeq(debate.rounds);
    return seq[existing.length] ?? null;
  }

  // Dynamic flow: moderator opens, both openings, then moderator dynamically picks next speaker
  // until a max of (3 + rounds*2 + 3) turns; final turn is moderator verdict.
  const max = fixedSeqLength(debate.rounds);
  const count = existing.length;
  if (count === 0) return { role: "moderator", phase: "abertura" };
  if (count === 1) return { role: "a", phase: "abertura" };
  if (count === 2) return { role: "b", phase: "abertura" };
  if (count >= max - 1) return { role: "moderator", phase: "veredito" };

  // Ask the moderator-LLM to choose A or B and give a brief instruction.
  const transcript = existing.map((m) => `[${labelFor(m.role, debate)}] (${m.phase}): ${m.content}`).join("\n\n");
  const decision = await chat(
    [
      {
        role: "system",
        content: `Você é o MEDIADOR de um debate. Decida quem deve falar agora: "${debate.debater_a_name}" (A) ou "${debate.debater_b_name}" (B). Responda APENAS um JSON válido: {"speaker":"a"|"b","instruction":"...","phase":"réplica"|"contraponto"|"aprofundamento"}. A instrução deve orientar o próximo a rebater um ponto específico do oponente. Sem markdown, sem texto extra.`,
      },
      { role: "user", content: `Tema: ${debate.topic}\n\nHistórico:\n${transcript}\n\nQuem fala agora e o que deve abordar?` },
    ],
    debate.moderator_model,
  );

  try {
    const cleaned = decision.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as { speaker?: string; instruction?: string; phase?: string };
    const speaker = parsed.speaker === "b" ? "b" : "a";
    const phase = (parsed.phase && parsed.phase.length < 40) ? parsed.phase : "réplica";
    return { role: speaker, phase, guidance: parsed.instruction };
  } catch {
    // Fallback: alternate based on last debater
    const lastDebater = [...existing].reverse().find((m) => m.role === "a" || m.role === "b");
    const speaker = lastDebater?.role === "a" ? "b" : "a";
    return { role: speaker, phase: "réplica" };
  }
}
