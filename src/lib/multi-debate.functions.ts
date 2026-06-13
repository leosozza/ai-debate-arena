import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureBlockSubtopics, directionClause, type Debate } from "./debate.functions";

// ===========================================================================
// Motor de geração para formatos != "duel" (lê debate_participants).
// Aditivo: não toca no engine de duel. Ativado pelo detalhe quando format != duel.
// ===========================================================================

type Participant = {
  slot: number;
  role: string;
  display_name: string;
  persona_prompt: string;
  model: string | null;
  team: string | null;
};

type Msg = { role: string; phase: string; content: string; block_index?: number | null };

const TTS_STYLE = `\n\nFORMATO OBRIGATÓRIO: sua resposta vai direto para um sintetizador de voz (TTS). Escreva APENAS texto corrido falado, em português. PROIBIDO markdown, asteriscos, listas, títulos, emojis ou qualquer símbolo tipográfico além de . , ? ! ; :`;

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type SpeakerKind = "moderator" | "c0" | "c1" | number;
type Turn = { speaker: SpeakerKind; phase: string; block_index: number; role?: string };

function pushCommentators(seq: Turn[], blockIndex: number, isFinal: boolean, cCount: number) {
  const label = isFinal ? "comentário final" : `comentário bloco ${blockIndex + 1}`;
  for (let c = 0; c < cCount; c++) {
    seq.push({ speaker: (c === 0 ? "c0" : "c1"), phase: label, block_index: blockIndex });
  }
}

/** Constrói a sequência completa de turnos conforme o formato. */
function buildSequence(formatId: string, parts: Participant[], blocks: number, rounds: number, cCount: number = 0): Turn[] {
  const speakers = [...parts].sort((a, b) => a.slot - b.slot);
  const seq: Turn[] = [];

  if (formatId === "interview") {
    const interviewer = parts.find((p) => p.role === "interviewer") ?? speakers[0];
    const guests = speakers.filter((p) => p.slot !== interviewer?.slot);
    for (let b = 0; b < blocks; b++) {
      const isFinal = b === blocks - 1;
      seq.push({ speaker: "moderator", phase: `vinheta ${b + 1}`, block_index: b });
      for (const g of guests) {
        seq.push({ speaker: interviewer.slot, phase: `pergunta ${b + 1}`, block_index: b, role: "interviewer" });
        seq.push({ speaker: g.slot, phase: `resposta ${b + 1}`, block_index: b, role: "interviewee" });
      }
      pushCommentators(seq, b, isFinal, cCount);
      if (isFinal) seq.push({ speaker: "moderator", phase: "veredito", block_index: b });
    }
    return seq;
  }

  if (formatId === "tribunal") {
    const pros = speakers.filter((p) => p.role === "prosecutor");
    const def = speakers.filter((p) => p.role === "defender");
    const judges = speakers.filter((p) => p.role === "judge");
    const accused = speakers.filter((p) => p.role === "debater" || p.role === "interviewee");
    seq.push({ speaker: "moderator", phase: "abertura", block_index: 0 });
    for (const p of pros) seq.push({ speaker: p.slot, phase: "acusação", block_index: 0, role: "prosecutor" });
    for (const a of accused) seq.push({ speaker: a.slot, phase: "defesa do réu", block_index: 0, role: "debater" });
    for (const d of def) seq.push({ speaker: d.slot, phase: "defesa", block_index: 0, role: "defender" });
    for (const j of judges) seq.push({ speaker: j.slot, phase: "interrogatório", block_index: 0, role: "judge" });
    pushCommentators(seq, 0, true, cCount);
    seq.push({ speaker: "moderator", phase: "veredito", block_index: 0 });
    return seq;
  }

  // Round-robin (roundtable, sages_council, era_clash, century_problem, ideas_war, presidential, fallback)
  for (let b = 0; b < blocks; b++) {
    const isFinal = b === blocks - 1;
    seq.push({ speaker: "moderator", phase: `vinheta ${b + 1}`, block_index: b });
    if (isFinal) {
      for (const s of speakers) seq.push({ speaker: s.slot, phase: "considerações finais", block_index: b });
      pushCommentators(seq, b, true, cCount);
      seq.push({ speaker: "moderator", phase: "veredito", block_index: b });
    } else {
      for (const s of speakers) seq.push({ speaker: s.slot, phase: "abertura", block_index: b });
      for (let r = 1; r <= rounds; r++) {
        for (const s of speakers) seq.push({ speaker: s.slot, phase: `réplica ${r}`, block_index: b });
      }
      pushCommentators(seq, b, false, cCount);
    }
  }
  return seq;
}

function toneFor(formatId: string): string {
  if (formatId === "sages_council") return "Tom respeitoso e reflexivo de um conselho de sábios — sem ataques diretos, buscando sabedoria conjunta.";
  if (formatId === "tribunal") return "Tom solene de tribunal — argumentação rigorosa, respeito ao rito.";
  if (formatId === "presidential") return "Tom de debate presidencial — firme, com direito de resposta, sem desrespeito.";
  if (formatId === "interview") return "Tom de entrevista de TV — perguntas instigantes e respostas reveladoras.";
  return "Tom de mesa-redonda de TV — vivo, direto, com troca de ideias entre os convidados.";
}

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
    const seq = buildSequence(debate.format, parts, blocks, debate.rounds);

    const seqCount = existing.filter((m) => m.phase !== "reviravolta").length;
    let next = seq[seqCount];
    if (!next) {
      await context.supabase.from("debates").update({ status: "completed" }).eq("id", data.debateId);
      return { done: true, message: null };
    }

    const labels = labelMap(parts);
    const transcript = existing
      .map((m) => `[${labels[m.role] ?? m.role}] (${m.phase}): ${m.content}`)
      .join("\n\n");

    // Fluxo dinâmico em formatos multi: o mediador decide o próximo movimento
    // durante réplicas (mantém vinheta/abertura/considerações finais/veredito fixos).
    let dynamicGuidance: string | null = null;
    if (debate.dynamic_flow && next.speaker !== "moderator" && /^réplica/i.test(next.phase)) {
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
    const tone = toneFor(debate.format);

    const isMod = next.speaker === "moderator";
    const speaker = isMod ? null : parts.find((p) => p.slot === next.speaker);
    const roleMsg = isMod ? "moderator" : slotRole(next.speaker as number);
    const model = isMod ? debate.moderator_model : (speaker?.model || DEFAULT_MODEL);

    let sysPrompt: string;
    let userPrompt: string;

    if (isMod) {
      const whoM = debate.moderator_name ? `Você é ${debate.moderator_name}, ${debate.moderator_style ?? "apresentador do programa"}.` : "Você é o MEDIADOR/APRESENTADOR de um programa de debate de TV.";
      sysPrompt = `${whoM} ${tone} Fale em português.${directionClause(debate)}${TTS_STYLE}`;
      if (next.phase === "veredito") {
        userPrompt = `Tema: ${debate.topic}\n\nHistórico completo:\n${transcript}\n\nEncerre o programa com seu VEREDITO: quem se saiu melhor e por quê, citando momentos reais do debate. Máximo 180 palavras.`;
      } else if (next.phase === "abertura") {
        const names = parts.map((p) => `${p.display_name} (${p.role})`).join(", ");
        userPrompt = `Tema do programa: ${debate.topic}\nParticipantes: ${names}\n\nAbra o programa com energia jornalística (máx 130 palavras): saúde a audiência, apresente cada participante em UMA frase, e dê a largada para a primeira fala. NÃO faça veredito.`;
      } else if (next.phase === "pergunta-incisiva") {
        userPrompt = `Tema: ${debate.topic}\nBloco: "${block.title}" — ${block.focus}\n\nHistórico:\n${transcript}\n\nVocê INTERROMPE para fazer UMA pergunta incisiva e direta, cobrando uma resposta que ficou no ar ou expondo uma contradição.${dynamicGuidance ? `\nFoco: ${dynamicGuidance}` : ""} Máx 60 palavras.`;
      } else {
        userPrompt = `Tema geral: ${debate.topic}\n\nVinheta de abertura do bloco "${block.title}" (foco: ${block.focus}). 2-3 frases anunciando o sub-tema com energia de TV. Máx 70 palavras. NÃO faça veredito.`;
      }
    } else {
      const roleHint = next.role
        ? ({ interviewer: "Você é o ENTREVISTADOR: faça UMA pergunta instigante e direta ao convidado.", interviewee: "Você é o ENTREVISTADO: responda com profundidade e personalidade.", prosecutor: "Você é a ACUSAÇÃO: sustente a acusação com argumentos e evidências.", defender: "Você é a DEFESA: refute a acusação e defenda o réu.", judge: "Você é um JUIZ: questione os pontos fracos e pondere com imparcialidade." } as Record<string, string>)[next.role] ?? ""
        : "";
      sysPrompt = `Você é ${speaker?.display_name}. ${speaker?.persona_prompt?.slice(0, 6000) || ""}\n${roleHint}\nVocê está num programa de debate de TV ao vivo. ${tone} Vá direto ao argumento, rebata quando fizer sentido, sem se reapresentar a cada fala. Fale em português.${directionClause(debate)}${TTS_STYLE}`;
      const guide = dynamicGuidance ? `\nOrientação do mediador: ${dynamicGuidance}` : "";
      userPrompt = `Tema geral: ${debate.topic}\nBloco atual: "${block.title}" — foco: ${block.focus}\n\nHistórico até agora:\n${transcript || "(o programa está começando)"}${guide}\n\nSua tarefa: produzir a fala da fase "${next.phase}". Máximo 170 palavras. NÃO inclua seu nome nem prefixo — só o conteúdo da fala.`;
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

    const willDone = next.phase === "veredito" || (!debate.dynamic_flow && seqCount + 1 >= seq.length);
    if (willDone) {
      await context.supabase.from("debates").update({ status: "completed" }).eq("id", data.debateId);
    }

    return { done: false, message: inserted };
  });
