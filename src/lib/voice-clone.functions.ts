import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MB
const MAX_TOTAL_BYTES = 30 * 1024 * 1024; // 30 MB

function readUpload(data: unknown): { name: string; files: File[] } {
  if (!(data instanceof FormData)) throw new Error("Envio inválido (esperado FormData).");
  const name = String(data.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("Rótulo da voz deve ter 2 a 80 caracteres.");
  const files = data.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Envie ao menos 1 arquivo de áudio.");
  if (files.length > MAX_FILES) throw new Error(`Máximo ${MAX_FILES} arquivos.`);
  let total = 0;
  for (const f of files) {
    if (!f.type.startsWith("audio/")) throw new Error(`"${f.name}" não é um arquivo de áudio.`);
    if (f.size > MAX_FILE_BYTES) throw new Error(`"${f.name}" excede 12 MB.`);
    total += f.size;
  }
  if (total > MAX_TOTAL_BYTES) throw new Error("Total de áudio excede 30 MB.");
  return { name, files };
}

/** ElevenLabs Instant Voice Cloning. Requires plano Creator+. */
export const cloneVoiceEleven = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => readUpload(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ElevenLabs não está conectado neste projeto.");

    const fd = new FormData();
    fd.append("name", data.name);
    for (const f of data.files) fd.append("files", f, f.name);

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: fd,
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error("ElevenLabs: chave inválida ou sem permissão para clonar.");
      }
      if (res.status === 402) {
        throw new Error("ElevenLabs: seu plano não permite clonagem (Instant Voice Cloning). Tente o MiniMax.");
      }
      if (res.status === 422) {
        throw new Error("ElevenLabs: áudio inválido ou muito curto. Use 1–10 min de fala clara.");
      }
      throw new Error(`ElevenLabs falhou (${res.status}): ${body.slice(0, 180)}`);
    }
    const json = (await res.json()) as { voice_id?: string; name?: string };
    if (!json.voice_id) throw new Error("ElevenLabs não retornou voice_id.");
    return { voiceId: json.voice_id, name: json.name ?? data.name, provider: "eleven" as const };
  });

/** MiniMax Voice Cloning (fallback). */
export const cloneVoiceMinimax = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => readUpload(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error("MiniMax não configurado.");
    const groupId = process.env.MINIMAX_GROUP_ID;

    // 1) Upload do primeiro arquivo (MiniMax aceita 1 por clone)
    const file = data.files[0];
    const uploadFd = new FormData();
    uploadFd.append("purpose", "voice_clone");
    uploadFd.append("file", file, file.name);

    const uploadUrl = groupId
      ? `https://api.minimax.io/v1/files/upload?GroupId=${encodeURIComponent(groupId)}`
      : "https://api.minimax.io/v1/files/upload";

    const upRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadFd,
    });
    if (!upRes.ok) {
      const b = await upRes.text();
      throw new Error(`MiniMax upload falhou (${upRes.status}): ${b.slice(0, 180)}`);
    }
    const upJson = (await upRes.json()) as {
      file?: { file_id?: number | string };
      base_resp?: { status_code?: number; status_msg?: string };
    };
    if (upJson.base_resp && upJson.base_resp.status_code !== 0) {
      throw new Error(`MiniMax: ${upJson.base_resp.status_msg ?? "erro no upload"}`);
    }
    const fileId = upJson.file?.file_id;
    if (!fileId) throw new Error("MiniMax: sem file_id após upload.");

    // 2) Clone
    // voice_id precisa começar com letra e ter ≥8 chars
    const safeBase = data.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "voice";
    const customVoiceId = `v${safeBase}${Date.now().toString(36)}`.slice(0, 32);

    const cloneUrl = groupId
      ? `https://api.minimax.io/v1/voice_clone?GroupId=${encodeURIComponent(groupId)}`
      : "https://api.minimax.io/v1/voice_clone";

    const clRes = await fetch(cloneUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_id: fileId, voice_id: customVoiceId }),
    });
    if (!clRes.ok) {
      const b = await clRes.text();
      throw new Error(`MiniMax clone falhou (${clRes.status}): ${b.slice(0, 180)}`);
    }
    const clJson = (await clRes.json()) as {
      base_resp?: { status_code?: number; status_msg?: string };
    };
    if (clJson.base_resp && clJson.base_resp.status_code !== 0) {
      throw new Error(`MiniMax: ${clJson.base_resp.status_msg ?? "erro no clone"}`);
    }
    return { voiceId: customVoiceId, name: data.name, provider: "minimax" as const };
  });

/** Anexa uma voz (clonada ou Voice ID manual) a uma persona. */
export const attachVoiceToPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      personaId: z.string().uuid(),
      provider: z.enum(["browser", "eleven", "minimax", "replicate"]),
      voiceId: z.string().trim().min(1).max(2048),
      source: z.enum(["upload-eleven", "upload-minimax", "upload-replicate", "manual"]),
      cloneName: z.string().trim().max(120).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("personas")
      .update({
        voice_provider: data.provider,
        voice_id: data.voiceId,
        voice_clone_source: data.source,
        voice_clone_name: data.cloneName ?? null,
      })
      .eq("id", data.personaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
