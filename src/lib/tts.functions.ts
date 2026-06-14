import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { paceToSpeed, styleForPhase } from "./phase-style";

const TtsInput = z.object({
  text: z.string().trim().min(1).max(5000),
  voiceId: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(60).default("speech-02-hd"),
  speed: z.number().min(0.5).max(2).default(1),
  pitch: z.number().min(-12).max(12).default(0),
  vol: z.number().min(0.1).max(10).default(1),
  /** Opcional: nome da fase. Quando presente, ajusta o ritmo automaticamente. */
  phase: z.string().trim().max(60).optional(),
  /** Opcional: papel ("moderator" | "c0" | "c1" | role da persona). */
  phaseRole: z.string().trim().max(40).optional(),
});


/** Synthesize speech via MiniMax T2A v2. Returns base64-encoded mp3. */
export const minimaxTts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TtsInput.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error("MINIMAX_API_KEY ausente.");
    const groupId = process.env.MINIMAX_GROUP_ID;

    const url = groupId
      ? `https://api.minimax.io/v1/t2a_v2?GroupId=${encodeURIComponent(groupId)}`
      : `https://api.minimax.io/v1/t2a_v2`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: data.model,
          text: data.text,
          stream: false,
          language_boost: "Portuguese",
          voice_setting: {
            voice_id: data.voiceId,
            speed: data.phase
              ? Math.min(2, Math.max(0.5, data.speed * paceToSpeed(styleForPhase(data.phase, data.phaseRole).pace)))
              : data.speed,
            vol: data.vol,
            pitch: data.pitch,
          },

          audio_setting: {
            // 44.1kHz / 256kbps = qualidade alta (antes era 32k/128k, baixo).
            sample_rate: 44100,
            bitrate: 256000,
            format: "mp3",
            channel: 1,
          },
        }),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (ctrl.signal.aborted) throw new Error("MiniMax não respondeu em 30s (timeout).");
      throw e;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MiniMax TTS falhou (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      data?: { audio?: string };
      base_resp?: { status_code?: number; status_msg?: string };
    };

    if (json.base_resp && json.base_resp.status_code !== 0) {
      throw new Error(`MiniMax: ${json.base_resp.status_msg ?? "erro desconhecido"}`);
    }

    const hex = json.data?.audio;
    if (!hex) throw new Error("MiniMax: resposta sem áudio.");

    // Convert hex to base64 (server-side, Buffer available in Workers nodejs_compat)
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);

    return { audioBase64: base64, mime: "audio/mpeg" as const };
  });

export const MINIMAX_VOICES = [
  { id: "male-qn-qingse", label: "Masc · Qingse (PT/EN)" },
  { id: "male-qn-jingying", label: "Masc · Jingying" },
  { id: "male-qn-badao", label: "Masc · Badao (firme)" },
  { id: "female-shaonv", label: "Fem · Shaonv (jovem)" },
  { id: "female-yujie", label: "Fem · Yujie (madura)" },
  { id: "female-chengshu", label: "Fem · Chengshu" },
  { id: "female-tianmei", label: "Fem · Tianmei (doce)" },
  { id: "presenter_male", label: "Apresentador (masc)" },
  { id: "presenter_female", label: "Apresentadora (fem)" },
  { id: "audiobook_male_1", label: "Audiobook masc 1" },
  { id: "audiobook_female_1", label: "Audiobook fem 1" },
] as const;
