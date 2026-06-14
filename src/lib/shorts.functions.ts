import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Planejador dos "melhores momentos" — server-side. Recebe um debateId,
// monta um índice resumido das mensagens e pede à IA para escolher de 2 a 3
// trechos com maior densidade / atrito / virada. Devolve apenas o plano
// (lista de messageIds + razão), sem renderizar vídeo. A montagem do MP4
// fica no cliente (reusa o pipeline de exportDebateMp4).

const Input = z.object({ debateId: z.string().uuid(), max: z.number().int().min(1).max(5).default(3) });

export type ShortHighlight = { messageId: string; reason: string };
export type ShortPlan = { highlights: ShortHighlight[] };

export const planShortHighlights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<ShortPlan> => {
    const { data: messages, error } = await context.supabase
      .from("debate_messages")
      .select("id, role, phase, content, order_index")
      .eq("debate_id", data.debateId)
      .order("order_index");
    if (error) throw new Error(error.message);
    const list = (messages ?? []) as Array<{ id: string; role: string; phase: string; content: string }>;
    if (list.length === 0) return { highlights: [] };

    const catalog = list
      .map((m, i) => `#${i} id=${m.id} role=${m.role} phase=${m.phase}\n${m.content.slice(0, 320)}`)
      .join("\n\n---\n\n");

    const { chatComplete } = await import("./ai-gateway.server");

    try {
      const raw = await chatComplete(
        [
          {
            role: "system",
            content:
              `Você seleciona os MELHORES MOMENTOS de um debate para um short vertical de até 60 segundos. ` +
              `Priorize falas com: alta densidade de argumento, troca de farpa, virada, dado polêmico, frase de efeito. ` +
              `Evite aberturas formais, vinhetas e considerações finais protocolares. ` +
              `Responda APENAS JSON: {"highlights":[{"messageId":"<id>","reason":"<motivo curto>"}, ...]} com no máximo ${data.max} itens, em ordem cronológica.`,
          },
          { role: "user", content: catalog },
        ],
        "google/gemini-3-flash-preview",
      );
      const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned) as ShortPlan;
      const validIds = new Set(list.map((m) => m.id));
      const highlights = (parsed.highlights ?? [])
        .filter((h) => h && validIds.has(h.messageId))
        .slice(0, data.max);
      if (highlights.length > 0) return { highlights };
    } catch {
      // fallback abaixo
    }

    // Fallback heurístico: pega réplicas/pergunta-incisiva/reviravolta mais longas.
    const ranked = list
      .filter((m) => /(réplica|reviravolta|pergunta-incisiva|acusação|defesa)/i.test(m.phase))
      .sort((a, b) => b.content.length - a.content.length)
      .slice(0, data.max)
      .sort((a, b) => list.indexOf(a) - list.indexOf(b))
      .map((m) => ({ messageId: m.id, reason: `Trecho denso (${m.phase})` }));
    return { highlights: ranked };
  });
