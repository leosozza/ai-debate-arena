import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureBlockSubtopics, directionClause, type Debate } from "./debate.functions";
import { getEngine, type Participant, type Turn } from "./engines";
import { styleForPhase } from "./phase-style";
import { personaMemoryDigest } from "./persona-memory";


// ===========================================================================
// Motor de geração para formatos != "duel" (lê debate_participants). Cada
// formato tem sua engine em src/lib/engines (sequência, tom, hints por fase,
// e estilo de veredito). Este arquivo só orquestra DB + IA.
// ===========================================================================

type Msg = { role: string; phase: string; content: string; block_index?: number | null };

const TTS_STYLE = `\n\nFORMATO OBRIGATÓRIO: sua resposta vai direto para um sintetizador de voz (TTS). Escreva APENAS texto corrido falado, em português. PROIBIDO markdown, asteriscos, listas, títulos, emojis ou qualquer símbolo tipográfico além de . , ? ! ; :`;

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

// Convenção de role compatível com a apresentação (Lovable): slot 0 = "a",
// slot 1 = "b", slot 2+ = "ex{slot}". Mediador = "moderator".
function slotRole(slot: number): string {
  return slot === 0 ? "a" : slot === 1 ? "b" : `ex${slot}`;
}

function labelMap(parts: Participant[]): Record<string, string> {
  const m: Record<string, string> = { moderator: "Mediador" };
  for (const p of parts) m[slotRole(p.slot)] = p.display_name;
  return m;
}

export const generateParticipantTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ debateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai-gateway.server");

    const { data: debateRow, error: dErr } = await context.supabase
      .from("debates").select("*").eq("id", data.debateId).single();
    if (dErr || !debateRow) throw new Error(dErr?.message ?? "Debate não encontrado.");
    const debate = debateRow as unknown as Debate & { format: string };

    const { data: pRows, error: pErr } = await context.supabase
      .from("debate_participants").select("slot, role, display_name, persona_prompt, model, team")
      .eq("debate_id", data.debateId).order("slot", { ascending: true });
    if (pErr) throw new Error(pErr.message);
    const extras = (pRows ?? []) as Participant[];
    // Modelo de dados (Lovable): A/B ficam nas colunas duel (slots 0 e 1); os
    // convidados extras (slot 2+) ficam na tabela debate_participants.
    const base: Participant[] = [
      { slot: 0, role: "debater", display_name: debate.debater_a_name, persona_prompt: debate.debater_a_persona, model: debate.debater_a_model, team: null },
      { slot: 1, role: "debater", display_name: debate.debater_b_name, persona_prompt: debate.debater_b_persona, model: debate.debater_b_model, team: null },
    ];
    const parts = [...base, ...extras.filter((e) => e.slot >= 2)].sort((a, b) => a.slot - b.slot);

    const { data: messages, error: mErr } = await context.supabase
      .from("debate_messages").select("*").eq("debate_id", data.debateId).order("order_index");
    if (mErr) throw new Error(mErr.message);
    const existing = (messages ?? []) as Msg[];

    const subtopics = await ensureBlockSubtopics(debate, context.supabase as never, chatComplete);
    const blocks = subtopics.length || debate.blocks_count || 4;
    const commentators = (debate as unknown as { commentators?: Array<{ name?: string; persona?: string }> | null }).commentators ?? [];
    const cCount = debate.dynamic_flow ? 0 : Math.min(2, commentators.length);

    const engine = getEngine(debate.format);
    const seq = engine.buildSequence(parts, blocks, debate.rounds, cCount);

    const seqCount = existing.filter((m) => m.phase !== "reviravolta").length;
    let next: Turn | undefined = seq[seqCount];
    if (!next) {
      await context.supabase.from("debates").update({ status: "completed" }).eq("id", data.debateId);
      return { done: true, message: null };
    }

    const commentatorName = (idx: 0 | 1) => commentators[idx]?.name ?? (idx === 0 ? "Comentarista 1" : "Comentarista 2");
    const labels = labelMap(parts);
    labels["c0"] = commentatorName(0);
    labels["c1"] = commentatorName(1);
    const transcript = existing
      .map((m) => `[${labels[m.role] ?? m.role}] (${m.phase}): ${m.content}`)
      .join("\n\n");

    // ── Plot twist: antes da última réplica de blocos intermediários, o
    // mediador pode injetar uma "reviravolta" (fato novo / dado polêmico).
    // Não consome slot da sequência (filtramos phase=reviravolta acima).
    const isFinalBlock = next.block_index === (subtopics.length - 1);
    const replicaMatch = /^réplica\s+(\d+)/i.exec(next.phase);
    const isLastReplica = replicaMatch && Number(replicaMatch[1]) === debate.rounds;
    const lastWasTwist = existing.length > 0 && existing[existing.length - 1].phase === "reviravolta";
    if (
      engine.allowsTwist &&
      !isFinalBlock &&
      isLastReplica &&
      !lastWasTwist &&
      typeof next.speaker === "number" &&
      Math.random() < 0.35
    ) {
      next = { speaker: "moderator", phase: "reviravolta", block_index: next.block_index };
    }


    // Fluxo dinâmico: o mediador decide o próximo movimento durante réplicas
    // (mantém vinheta/abertura/considerações finais/veredito fixos). Só aplica
    // em formatos cujas fases incluem "réplica" — engines como sages_council
    // (contribuição) ou century_problem (ângulo) seguem determinísticas.
    let dynamicGuidance: string | null = null;
    if (
      debate.dynamic_flow &&
      next.speaker !== "moderator" &&
      next.speaker !== "c0" &&
      next.speaker !== "c1" &&
      /^réplica/i.test(next.phase)
    ) {
      const speakerList = parts
        .map((p) => `- slot ${p.slot} → ${p.display_name} (${p.role})`)
        .join("\n");
      const lastNonMod = [...existing].reverse().find((m) => m.role !== "moderator" && m.phase !== "reviravolta");
      const lastSlot = lastNonMod
        ? (lastNonMod.role === "a" ? 0 : lastNonMod.role === "b" ? 1 : Number(String(lastNonMod.role).replace(/^ex/, "")) || -1)
        : -1;
      try {
        const decision = await chatComplete(
          [
            { role: "system", content: `Você é o MEDIADOR de um programa de TV ao vivo conduzindo um bate-rebate ágil entre vários convidados. Decida o PRÓXIMO movimento:
- "slot:<n>": qual participante rebate agora. A instrução deve ser AFIADA — mandar a pessoa rebater DIRETAMENTE um ponto, contradição ou exagero específico de alguém (citando pelo nome), provocar, expor fragilidade. NUNCA escolha o participante que acabou de falar.
- "moderator": DE VEZ EM QUANDO (talvez 1 em cada 4 turnos), VOCÊ interrompe com uma pergunta incisiva.
Responda APENAS JSON: {"speaker":"slot:<n>"|"moderator","instruction":"..."}.` },
            { role: "user", content: `Tema: ${debate.topic}\nBloco: "${(subtopics[next.block_index] ?? subtopics[0]).title}"\nParticipantes:\n${speakerList}\nÚltimo a falar: slot ${lastSlot}\n\nHistórico:\n${transcript}\n\nQual o próximo movimento?` },
          ],
          debate.moderator_model,
        );
        const cleaned = decision.replace(/^```json\s*|\s*```$/g, "").trim();
        const parsed = JSON.parse(cleaned) as { speaker?: string; instruction?: string };
        if (parsed.speaker === "moderator") {
          next = { speaker: "moderator", phase: "pergunta-incisiva", block_index: next.block_index };
        } else {
          const m = /^slot:(\d+)$/.exec(String(parsed.speaker ?? ""));
          const chosen = m ? Number(m[1]) : NaN;
          if (parts.some((p) => p.slot === chosen) && chosen !== lastSlot) {
            next = { ...next, speaker: chosen };
          }
        }
        dynamicGuidance = parsed.instruction ?? null;
      } catch {
        // fallback: mantém o turno determinístico
      }
    }

    const block = subtopics[next.block_index] ?? subtopics[0];

    const isMod = next.speaker === "moderator";
    const isCommentator = next.speaker === "c0" || next.speaker === "c1";
    const speaker = (!isMod && !isCommentator) ? parts.find((p) => p.slot === next.speaker) : null;
    const roleMsg = isMod ? "moderator" : (isCommentator ? (next.speaker as "c0" | "c1") : slotRole(next.speaker as number));
    const model = (isMod || isCommentator) ? debate.moderator_model : (speaker?.model || DEFAULT_MODEL);

    let sysPrompt: string;
    let userPrompt: string;

    const nextRole = isMod ? "moderator" : (isCommentator ? (next.speaker as string) : (next.role ?? speaker?.role));
    const ps = styleForPhase(next.phase, nextRole);
    const wordsCap = `Máximo ${ps.maxWords} palavras.`;

    if (isCommentator) {
      const cIdx = next.speaker === "c0" ? 0 : 1;
      const c = commentators[cIdx];
      const cName = commentatorName(cIdx as 0 | 1);
      sysPrompt = `Você é ${cName}, comentarista e repórter de um programa de debate de TV. ${c?.persona ?? ""}\nVocê NÃO debate: você ANALISA, como num pós-jogo, o bloco que acabou — quem mandou melhor, pontos fortes e fracos, o andamento e a reação do público. Seja perspicaz, direto e opinativo, em 2 a 3 frases. Fale em português.${directionClause(debate)}${TTS_STYLE}`;
      userPrompt = `Tema do programa: ${debate.topic}\nBloco que acabou: "${block.title}" — ${block.focus}\n\nHistórico até agora:\n${transcript}\n\nFaça seu comentário pós-bloco. ${wordsCap} NÃO inclua seu nome nem prefixo — só o conteúdo da fala.`;
    } else if (isMod) {
      const whoM = debate.moderator_name ? `Você é ${debate.moderator_name}, ${debate.moderator_style ?? "apresentador do programa"}.` : "Você é o MEDIADOR/APRESENTADOR de um programa de debate de TV.";
      const modHint = engine.phaseHint(next.phase, "moderator");
      sysPrompt = `${whoM} ${engine.tone}${modHint ? ` ${modHint}` : ""} Fale em português.${directionClause(debate)}${TTS_STYLE}`;
      if (next.phase === "veredito") {
        const extra = engine.verdictPromptExtra ? `\n\n${engine.verdictPromptExtra}` : "";
        userPrompt = `Tema: ${debate.topic}\n\nHistórico completo:\n${transcript}\n\nEncerre o programa com seu VEREDITO conforme a natureza do formato. Cite momentos reais. ${wordsCap}${extra}`;
      } else if (next.phase === "abertura") {
        const names = parts.map((p) => `${p.display_name} (${p.role})`).join(", ");
        userPrompt = `Tema do programa: ${debate.topic}\nParticipantes: ${names}\n\nAbra o programa com energia jornalística (${wordsCap}): saúde a audiência, apresente cada participante em UMA frase, e dê a largada para a primeira fala. NÃO faça veredito.`;
      } else if (next.phase === "pergunta-incisiva") {
        userPrompt = `Tema: ${debate.topic}\nBloco: "${block.title}" — ${block.focus}\n\nHistórico:\n${transcript}\n\nVocê INTERROMPE para fazer UMA pergunta incisiva e direta, cobrando uma resposta que ficou no ar ou expondo uma contradição.${dynamicGuidance ? `\nFoco: ${dynamicGuidance}` : ""} ${wordsCap}`;
      } else if (next.phase.startsWith("síntese")) {
        userPrompt = `Tema: ${debate.topic}\nBloco: "${block.title}" — ${block.focus}\n\nHistórico:\n${transcript}\n\nFaça a síntese intermediária entre os dois últimos sábios. ${wordsCap}`;
      } else if (next.phase.startsWith("pergunta")) {
        userPrompt = `Tema: ${debate.topic}\nBloco: "${block.title}" — ${block.focus}\nParticipantes: ${parts.map((p) => p.display_name).join(", ")}\n\nFaça UMA pergunta DIRECIONADA pelo nome a um candidato (escolha quem ainda não foi interpelado neste bloco). ${wordsCap}`;
      } else {
        userPrompt = `Tema geral: ${debate.topic}\n\nVinheta de abertura do bloco "${block.title}" (foco: ${block.focus}). 2-3 frases anunciando o sub-tema com energia de TV. ${wordsCap} NÃO faça veredito.`;
      }
    } else {
      const fmtHint = engine.phaseHint(next.phase, next.role ?? speaker?.role);
      const teamHint = speaker?.team ? ` Você integra o TIME ${speaker.team}.` : "";
      sysPrompt = `Você é ${speaker?.display_name}. ${speaker?.persona_prompt?.slice(0, 6000) || ""}\n${fmtHint}${teamHint}\nVocê está num programa de debate de TV ao vivo. ${engine.tone} Vá direto ao argumento, rebata quando fizer sentido, sem se reapresentar a cada fala. Fale em português.${directionClause(debate)}${TTS_STYLE}`;
      const guide = dynamicGuidance ? `\nOrientação do mediador: ${dynamicGuidance}` : "";
      userPrompt = `Tema geral: ${debate.topic}\nBloco atual: "${block.title}" — foco: ${block.focus}\n\nHistórico até agora:\n${transcript || "(o programa está começando)"}${guide}\n\nSua tarefa: produzir a fala da fase "${next.phase}". ${wordsCap} NÃO inclua seu nome nem prefixo — só o conteúdo da fala.`;
    }


    const content = await chatComplete(
      [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
      model,
    );

    const { data: inserted, error: iErr } = await context.supabase
      .from("debate_messages").insert({
        debate_id: data.debateId,
        user_id: context.userId,
        role: roleMsg,
        phase: next.phase,
        block_index: next.block_index,
        content,
        order_index: existing.length,
      }).select().single();
    if (iErr) throw new Error(iErr.message);

    // Em century_problem o veredito é seguido de N falas curtas de fechamento.
    // Em outros formatos, o veredito ENCERRA o programa.
    const isLast = !seq[seqCount + 1];
    const willDone = isLast || (next.phase === "veredito" && engine.verdictKind !== "synthesis") || (!debate.dynamic_flow && seqCount + 1 >= seq.length);
    if (willDone) {
      await context.supabase.from("debates").update({ status: "completed" }).eq("id", data.debateId);
    }

    return { done: false, message: inserted };
  });
