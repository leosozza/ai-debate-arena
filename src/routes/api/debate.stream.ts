import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const InputSchema = z.object({ debateId: z.string().uuid() });

export const Route = createFileRoute("/api/debate/stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
          const token = auth.slice(7);

          const body = await request.json();
          const { debateId } = InputSchema.parse(body);

          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } },
          );

          const { data: userData, error: uErr } = await supabase.auth.getUser();
          if (uErr || !userData.user) return new Response("Unauthorized", { status: 401 });
          const userId = userData.user.id;

          const { data: debate, error: dErr } = await supabase
            .from("debates").select("*").eq("id", debateId).single();
          if (dErr || !debate) return new Response("Debate não encontrado", { status: 404 });

          const { data: messages, error: mErr } = await supabase
            .from("debate_messages").select("*").eq("debate_id", debateId).order("order_index");
          if (mErr) return new Response(mErr.message, { status: 500 });
          const existing = messages ?? [];

          // Streaming SSE ainda só suporta o motor duel (A/B). Formatos
          // multi-participante usam o caminho não-streaming
          // (generateParticipantTurn) — bloqueamos aqui para evitar gerar
          // turnos com role errado e quebrar a sequência.
          if ((debate.format ?? "duel") !== "duel") {
            return new Response(
              "Streaming não suportado em formatos multi-participante. Use a geração não-streaming.",
              { status: 400 },
            );
          }

          const { buildSystemPrompt, labelFor, modelFor, fullSeqLength } = await import("@/lib/debate.functions");
          const { chatStream } = await import("@/lib/ai-gateway.server");

          // Inline next-turn decision (avoids exporting async helper)
          let next: { role: "moderator" | "a" | "b"; phase: string; guidance?: string } | null = null;
          const max = fullSeqLength(debate);
          // "reviravolta" messages (live subtemas) are context-only and don't consume a sequence slot.
          const count = existing.filter((m) => m.phase !== "reviravolta").length;
          if (count === 0) next = { role: "moderator", phase: "abertura" };
          else if (count === 1) next = { role: "a", phase: "abertura" };
          else if (count === 2) next = { role: "b", phase: "abertura" };
          else if (count >= max - 1) next = { role: "moderator", phase: "veredito" };
          else if (!debate.dynamic_flow) {
            const seq: Array<{ role: "moderator" | "a" | "b"; phase: string }> = [];
            for (let r = 1; r <= debate.rounds; r++) {
              seq.push({ role: "a", phase: `réplica ${r}` });
              seq.push({ role: "b", phase: `réplica ${r}` });
            }
            seq.push({ role: "a", phase: "considerações finais" });
            seq.push({ role: "b", phase: "considerações finais" });
            next = seq[count - 3] ?? null;
          } else {
            const { chatComplete } = await import("@/lib/ai-gateway.server");
            const transcript = existing.map((m) => `[${labelFor(m.role, debate)}] (${m.phase}): ${m.content}`).join("\n\n");
            try {
              const decision = await chatComplete(
                [
                  { role: "system", content: `Decida quem fala agora: A (${debate.debater_a_name}) ou B (${debate.debater_b_name}). Responda APENAS JSON: {"speaker":"a"|"b","instruction":"...","phase":"..."}.` },
                  { role: "user", content: `Tema: ${debate.topic}\n\nHistórico:\n${transcript}` },
                ],
                debate.moderator_model,
              );
              const cleaned = decision.replace(/^```json\s*|\s*```$/g, "").trim();
              const parsed = JSON.parse(cleaned);
              const speaker = parsed.speaker === "b" ? "b" : "a";
              next = { role: speaker, phase: parsed.phase ?? "réplica", guidance: parsed.instruction };
            } catch {
              const last = [...existing].reverse().find((m) => m.role === "a" || m.role === "b");
              next = { role: last?.role === "a" ? "b" : "a", phase: "réplica" };
            }
          }

          if (!next) {
            const stream = new ReadableStream({
              start(c) { c.enqueue(new TextEncoder().encode(`event: done\ndata: {}\n\n`)); c.close(); },
            });
            return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
          }

          const transcript = existing.map((m) => `[${labelFor(m.role, debate)}] (${m.phase}): ${m.content}`).join("\n\n");
          const sys = buildSystemPrompt(next.role, debate);
          const guidance = next.guidance ? `\n\nOrientação do mediador: ${next.guidance}` : "";
          const userPrompt = `Tema: ${debate.topic}\nRegras: ${debate.rules}\n\nHistórico:\n${transcript || "(início)"}${guidance}\n\nProduza a próxima fala da fase "${next.phase}" em português. Máximo 180 palavras. Apenas o conteúdo, sem prefixo.`;
          const model = modelFor(next.role, debate);

          const { stream: deltas, getFullText } = await chatStream(
            [{ role: "system", content: sys }, { role: "user", content: userPrompt }],
            model,
          );

          const encoder = new TextEncoder();
          const nextMeta = next;
          const sseStream = new ReadableStream({
            async start(controller) {
              controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ role: nextMeta.role, phase: nextMeta.phase })}\n\n`));
              const reader = deltas.getReader();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ t: value })}\n\n`));
                }
                const fullText = getFullText().trim();
                const { data: inserted } = await supabase.from("debate_messages").insert({
                  debate_id: debateId,
                  user_id: userId,
                  role: nextMeta.role,
                  phase: nextMeta.phase,
                  content: fullText,
                  order_index: existing.length,
                }).select().single();

                const isFinal = nextMeta.phase === "veredito";
                if (isFinal) await supabase.from("debates").update({ status: "completed" }).eq("id", debateId);

                controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ message: inserted, final: isFinal })}\n\n`));
              } catch (e) {
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: e instanceof Error ? e.message : "stream error" })}\n\n`));
              } finally {
                controller.close();
              }
            },
          });

          return new Response(sseStream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "error", { status: 500 });
        }
      },
    },
  },
});
