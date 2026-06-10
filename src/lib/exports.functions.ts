import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_DISCLAIMER_TEXT } from "@/components/AIDisclaimer";

const ExportInput = z.object({
  debateId: z.string().uuid(),
  kinds: z.array(z.enum(["script", "srt", "vtt", "youtube", "social"])).min(1),
});

/** Estimativa de duração da fala (segundos) — TTS PT-BR ≈ 0.42 s/palavra + 0.6 s de gap. */
function estimateSeconds(text: string): number {
  const words = (text.match(/\S+/g) ?? []).length;
  return Math.max(2, 0.6 + words * 0.42);
}

function fmtTimestamp(totalSeconds: number, ms = false): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const base = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (!ms) return base;
  const millis = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);
  return `${base},${String(millis).padStart(3, "0")}`;
}

function chunkForSubtitle(text: string, maxWords = 9): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const out: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    out.push(words.slice(i, i + maxWords).join(" "));
  }
  return out.length ? out : [""];
}

export const generateDebateExports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExportInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: debate, error: dErr } = await context.supabase
      .from("debates").select("*").eq("id", data.debateId).single();
    if (dErr || !debate) throw new Error(dErr?.message ?? "Debate não encontrado.");

    const { data: msgs, error: mErr } = await context.supabase
      .from("debate_messages").select("*").eq("debate_id", data.debateId).order("order_index");
    if (mErr) throw new Error(mErr.message);
    const messages = (msgs ?? []).filter((m) => m.phase !== "reviravolta");

    const { loadParticipants, labelForMulti } = await import("./debate.functions");
    const parts = await loadParticipants(context.supabase, debate as never);
    const labelOf = (role: string) => labelForMulti(role, parts);

    // Compute cumulative timestamps from estimated TTS durations.
    type Cue = { startSec: number; endSec: number; role: string; phase: string; content: string };
    const cues: Cue[] = [];
    let t = 0;
    for (const m of messages) {
      const dur = estimateSeconds(m.content);
      cues.push({ startSec: t, endSec: t + dur, role: m.role, phase: m.phase, content: m.content });
      t += dur + 0.4;
    }

    const out: Record<string, string> = {};

    if (data.kinds.includes("script")) {
      const lines: string[] = [];
      lines.push(`# ${debate.topic}`);
      lines.push("");
      lines.push(`> ⚠️ ${AI_DISCLAIMER_TEXT}`);
      lines.push("");
      lines.push(`**Formato:** ${debate.format ?? "duel"}  ·  **Elenco:** ${parts.map((p) => p.displayName).join(" · ")}`);
      lines.push("");
      lines.push("---");
      lines.push("");
      for (const c of cues) {
        lines.push(`### [${fmtTimestamp(c.startSec)}] ${labelOf(c.role)} — *${c.phase}*`);
        lines.push("");
        lines.push(c.content.trim());
        lines.push("");
      }
      out.script = lines.join("\n");
    }

    if (data.kinds.includes("srt")) {
      const lines: string[] = [];
      let idx = 1;
      for (const c of cues) {
        const pieces = chunkForSubtitle(c.content);
        const per = (c.endSec - c.startSec) / pieces.length;
        for (let i = 0; i < pieces.length; i++) {
          const s = c.startSec + i * per;
          const e = c.startSec + (i + 1) * per;
          lines.push(String(idx++));
          lines.push(`${fmtTimestamp(s, true).replace(",", ",")} --> ${fmtTimestamp(e, true).replace(",", ",")}`);
          lines.push(`${labelOf(c.role)}: ${pieces[i]}`);
          lines.push("");
        }
      }
      out.srt = lines.join("\n");
    }

    if (data.kinds.includes("vtt")) {
      const lines: string[] = ["WEBVTT", ""];
      for (const c of cues) {
        const pieces = chunkForSubtitle(c.content);
        const per = (c.endSec - c.startSec) / pieces.length;
        for (let i = 0; i < pieces.length; i++) {
          const s = c.startSec + i * per;
          const e = c.startSec + (i + 1) * per;
          lines.push(`${fmtTimestamp(s, true).replace(",", ".")} --> ${fmtTimestamp(e, true).replace(",", ".")}`);
          lines.push(`${labelOf(c.role)}: ${pieces[i]}`);
          lines.push("");
        }
      }
      out.vtt = lines.join("\n");
    }

    if (data.kinds.includes("youtube") || data.kinds.includes("social")) {
      const { chatComplete } = await import("./ai-gateway.server");

      // Timestamps por bloco (primeira fala de cada block_index).
      const blockStamps: string[] = [];
      const seen = new Set<number>();
      for (const c of cues) {
        const m = messages[cues.indexOf(c)];
        const bi = (m as { block_index?: number }).block_index ?? 0;
        if (!seen.has(bi)) {
          seen.add(bi);
          const titleArr = (debate.block_subtopics as Array<{ title?: string }> | null) ?? [];
          blockStamps.push(`${fmtTimestamp(c.startSec)} — Bloco ${bi + 1}: ${titleArr[bi]?.title ?? "Conteúdo"}`);
        }
      }

      if (data.kinds.includes("youtube")) {
        const prompt = `Tema do programa: ${debate.topic}
Formato: ${debate.format ?? "duel"}
Participantes: ${parts.map((p) => p.displayName).join(", ")}

Gere uma descrição de YouTube em PORTUGUÊS para esse programa simulado por IA. Responda APENAS JSON puro:
{"title":"...", "description":"...", "tags":["..."]}
- title: ≤90 caracteres, atrai clique sem clickbait.
- description: 3-4 parágrafos curtos, comece com 1 frase forte, mencione formato e participantes, termine convidando a se inscrever.
- tags: 10-15 termos curtos.`;
        const raw = await chatComplete(
          [
            { role: "system", content: "Você é editor de canal de YouTube focado em ideias e história. JSON puro." },
            { role: "user", content: prompt },
          ],
          "google/gemini-3-flash-preview",
        );
        let title = debate.topic;
        let description = "";
        let tags: string[] = [];
        try {
          const p = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as { title?: string; description?: string; tags?: string[] };
          title = p.title ?? title;
          description = p.description ?? "";
          tags = (p.tags ?? []).map((s) => String(s));
        } catch { /* ignore */ }

        const body: string[] = [];
        body.push(title);
        body.push("");
        body.push(`⚠️ ${AI_DISCLAIMER_TEXT}`);
        body.push("");
        body.push(description);
        body.push("");
        body.push("⏱️ Capítulos:");
        body.push(...blockStamps);
        body.push("");
        if (tags.length) body.push(`Tags: ${tags.map((t) => `#${t.replace(/^#/, "").replace(/\s+/g, "")}`).join(" ")}`);
        out.youtube = body.join("\n");
      }

      if (data.kinds.includes("social")) {
        const prompt = `Tema: ${debate.topic}
Formato: ${debate.format ?? "duel"}
Participantes: ${parts.map((p) => p.displayName).join(", ")}

Gere captions curtas em PORTUGUÊS para postagens promovendo esse programa simulado por IA. Responda APENAS JSON:
{"tiktok":"...", "instagram":"...", "hashtags":["..."]}
- tiktok: ≤150 caracteres, tom direto, 1 frase + CTA.
- instagram: ≤300 caracteres, 2-3 frases envolventes.
- hashtags: 8-12 hashtags curtas (sem #).`;
        const raw = await chatComplete(
          [
            { role: "system", content: "Você é social media manager de canal de história/ideias. JSON puro." },
            { role: "user", content: prompt },
          ],
          "google/gemini-3-flash-preview",
        );
        let tiktok = "";
        let instagram = "";
        let hashtags: string[] = [];
        try {
          const p = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as { tiktok?: string; instagram?: string; hashtags?: string[] };
          tiktok = p.tiktok ?? "";
          instagram = p.instagram ?? "";
          hashtags = (p.hashtags ?? []).map((s) => String(s));
        } catch { /* ignore */ }

        const hashLine = hashtags.length ? hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ") : "";
        const lines: string[] = [];
        lines.push("=== TikTok ===");
        lines.push(tiktok);
        lines.push("");
        lines.push(hashLine);
        lines.push("");
        lines.push("=== Instagram ===");
        lines.push(instagram);
        lines.push("");
        lines.push(hashLine);
        lines.push("");
        lines.push(`⚠️ ${AI_DISCLAIMER_TEXT}`);
        out.social = lines.join("\n");
      }
    }

    return { artifacts: out };
  });
