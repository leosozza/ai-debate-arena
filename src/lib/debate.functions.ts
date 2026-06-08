import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const NewDebateSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  debaterAName: z.string().trim().min(1).max(60),
  debaterAPersona: z.string().trim().min(1).max(500),
  debaterBName: z.string().trim().min(1).max(60),
  debaterBPersona: z.string().trim().min(1).max(500),
  moderatorTone: z.enum(["formal", "descontraído", "acadêmico"]),
  rounds: z.number().int().min(2).max(6),
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
Rodadas de réplica: ${data.rounds}

Escreva em português um documento curto (~250 palavras) com:
1. Apresentação do tema
2. Regras claras do debate (tempo, respeito, formato)
3. Critérios de avaliação
4. Ordem das falas

Use markdown com títulos curtos. Seja direto e envolvente.`;

    const rules = await chatComplete([
      { role: "system", content: "Você é um mediador profissional de debates." },
      { role: "user", content: rulesPrompt },
    ]);

    const { data: debate, error } = await context.supabase
      .from("debates")
      .insert({
        user_id: context.userId,
        topic: data.topic,
        debater_a_name: data.debaterAName,
        debater_a_persona: data.debaterAPersona,
        debater_b_name: data.debaterBName,
        debater_b_persona: data.debaterBPersona,
        moderator_tone: data.moderatorTone,
        rounds: data.rounds,
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

    // Determinar próximo papel/fase
    const existing = messages ?? [];
    const next = computeNextTurn(debate.rounds, existing.length);
    if (!next) return { done: true, message: null };

    const transcript = existing
      .map((m) => `[${labelFor(m.role, debate)}] (${m.phase}): ${m.content}`)
      .join("\n\n");

    const sysPrompt = buildSystemPrompt(next.role, debate);
    const userPrompt = `Tema: ${debate.topic}
Regras do mediador:
${debate.rules}

Histórico até agora:
${transcript || "(o debate ainda não começou)"}

Sua tarefa: produzir a próxima fala da fase "${next.phase}". Seja claro, direto e envolvente em português. Máximo de 180 palavras. NÃO inclua o nome ou prefixo — apenas o conteúdo da fala.`;

    const content = await chatComplete([
      { role: "system", content: sysPrompt },
      { role: "user", content: userPrompt },
    ]);

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

    const willBeDone = !computeNextTurn(debate.rounds, existing.length + 1);
    if (willBeDone) {
      await context.supabase.from("debates").update({ status: "completed" }).eq("id", data.debateId);
    }

    return { done: false, message: inserted };
  });

function labelFor(role: string, debate: { debater_a_name: string; debater_b_name: string }) {
  if (role === "moderator") return "Mediador";
  if (role === "a") return debate.debater_a_name;
  if (role === "b") return debate.debater_b_name;
  return role;
}

function buildSystemPrompt(role: "moderator" | "a" | "b", debate: {
  debater_a_name: string; debater_a_persona: string;
  debater_b_name: string; debater_b_persona: string;
  moderator_tone: string;
}) {
  if (role === "moderator") {
    return `Você é o MEDIADOR de um debate, tom ${debate.moderator_tone}. Apresente fases, faça transições e, no veredito, avalie quem foi mais convincente sem ofender. Fale em português.`;
  }
  if (role === "a") {
    return `Você é ${debate.debater_a_name}. Personalidade e posição: ${debate.debater_a_persona}. Defenda sua posição com convicção, rebatendo o oponente quando fizer sentido. Fale em português.`;
  }
  return `Você é ${debate.debater_b_name}. Personalidade e posição: ${debate.debater_b_persona}. Defenda sua posição com convicção, rebatendo o oponente quando fizer sentido. Fale em português.`;
}

// Sequência: mediador abertura, A abertura, B abertura,
// para cada rodada: A réplica, B réplica,
// A final, B final, mediador veredito.
function computeNextTurn(rounds: number, count: number): { role: "moderator" | "a" | "b"; phase: string } | null {
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
  return seq[count] ?? null;
}
