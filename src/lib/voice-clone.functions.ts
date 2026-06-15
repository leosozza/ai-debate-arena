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
      provider: z.enum(["kokoro", "piper", "eleven", "minimax", "replicate"]),
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

/* ============================================================
 * CLONAGEM EM CASCATA — qualidade máxima.
 * Tenta ElevenLabs → MiniMax → Replicate (Chatterbox).
 * ============================================================ */

type CascadeResult = {
  provider: "eleven" | "minimax" | "replicate";
  voiceId: string;
  name: string;
  source: "upload-eleven" | "upload-minimax" | "upload-replicate";
  attempts: { provider: string; ok: boolean; error?: string }[];
};

async function tryEleven(name: string, files: File[]): Promise<{ voiceId: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ElevenLabs não conectado");
  const fd = new FormData();
  fd.append("name", name);
  for (const f of files) fd.append("files", f, f.name);
  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Eleven ${res.status}: ${body.slice(0, 160)}`);
  }
  const json = (await res.json()) as { voice_id?: string };
  if (!json.voice_id) throw new Error("Eleven sem voice_id");
  return { voiceId: json.voice_id };
}

async function tryMinimax(name: string, file: File): Promise<{ voiceId: string }> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("MiniMax não configurado");
  const groupId = process.env.MINIMAX_GROUP_ID;
  const upFd = new FormData();
  upFd.append("purpose", "voice_clone");
  upFd.append("file", file, file.name);
  const upUrl = groupId
    ? `https://api.minimax.io/v1/files/upload?GroupId=${encodeURIComponent(groupId)}`
    : "https://api.minimax.io/v1/files/upload";
  const upRes = await fetch(upUrl, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: upFd });
  if (!upRes.ok) throw new Error(`MiniMax upload ${upRes.status}: ${(await upRes.text()).slice(0, 160)}`);
  const upJson = (await upRes.json()) as { file?: { file_id?: number | string }; base_resp?: { status_code?: number; status_msg?: string } };
  if (upJson.base_resp && upJson.base_resp.status_code !== 0) throw new Error(`MiniMax: ${upJson.base_resp.status_msg}`);
  const fileId = upJson.file?.file_id;
  if (!fileId) throw new Error("MiniMax sem file_id");
  const safe = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "voice";
  const voiceId = `v${safe}${Date.now().toString(36)}`.slice(0, 32);
  const clUrl = groupId
    ? `https://api.minimax.io/v1/voice_clone?GroupId=${encodeURIComponent(groupId)}`
    : "https://api.minimax.io/v1/voice_clone";
  const clRes = await fetch(clUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId, voice_id: voiceId }),
  });
  if (!clRes.ok) throw new Error(`MiniMax clone ${clRes.status}: ${(await clRes.text()).slice(0, 160)}`);
  const clJson = (await clRes.json()) as { base_resp?: { status_code?: number; status_msg?: string } };
  if (clJson.base_resp && clJson.base_resp.status_code !== 0) throw new Error(`MiniMax: ${clJson.base_resp.status_msg}`);
  return { voiceId };
}

async function tryReplicate(file: File): Promise<{ voiceId: string }> {
  const { uploadFile } = await import("./replicate.server");
  const url = await uploadFile(file);
  return { voiceId: `chatterbox:${url}` };
}

export const cloneVoiceCascade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => readUpload(d))
  .handler(async ({ data, context }): Promise<CascadeResult> => {
    const attempts: CascadeResult["attempts"] = [];

    // 1) ElevenLabs
    try {
      const r = await tryEleven(data.name, data.files);
      attempts.push({ provider: "eleven", ok: true });
      await savePreset(context, `${data.name} (ElevenLabs)`, r.voiceId, "eleven");
      return { provider: "eleven", voiceId: r.voiceId, name: data.name, source: "upload-eleven", attempts };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[cascade] eleven falhou:", msg);
      attempts.push({ provider: "eleven", ok: false, error: msg });
    }

    // 2) MiniMax
    try {
      const r = await tryMinimax(data.name, data.files[0]);
      attempts.push({ provider: "minimax", ok: true });
      await savePreset(context, `${data.name} (MiniMax)`, r.voiceId, "minimax");
      return { provider: "minimax", voiceId: r.voiceId, name: data.name, source: "upload-minimax", attempts };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[cascade] minimax falhou:", msg);
      attempts.push({ provider: "minimax", ok: false, error: msg });
    }

    // 3) Replicate (Chatterbox)
    try {
      const r = await tryReplicate(data.files[0]);
      attempts.push({ provider: "replicate", ok: true });
      await savePreset(context, `${data.name} (Replicate)`, r.voiceId, "replicate");
      return { provider: "replicate", voiceId: r.voiceId, name: data.name, source: "upload-replicate", attempts };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[cascade] replicate falhou:", msg);
      attempts.push({ provider: "replicate", ok: false, error: msg });
    }

    throw new Error(
      "Todos os provedores falharam: " + attempts.map((a) => `${a.provider}=${a.error ?? "ok"}`).join(" | "),
    );
  });

async function savePreset(
  context: { supabase: SupabaseLike; userId: string },
  name: string,
  voiceId: string,
  provider: "eleven" | "minimax" | "replicate",
) {

  try {
    // Para Replicate, voiceId já vem como "chatterbox:<url>"; extrai URL para voice_url.
    // Para Eleven/MiniMax, salvamos o voice_id no próprio voice_url (não é URL, mas
    // serve como identificador estável para o picker reusar).
    const voiceUrl = provider === "replicate" ? voiceId.replace(/^chatterbox:/, "") : voiceId;
    await context.supabase.from("voice_presets").insert({
      user_id: context.userId,
      name,
      voice_url: voiceUrl,
      is_real_person: true,
      notes: `provider=${provider};voice_id=${voiceId}`,
    });
  } catch (e) {
    console.warn("[savePreset] falha:", e);
  }
}

/** Re-clona um preset existente usando a cascata de qualidade máxima. */
export const reCloneVoicePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: preset, error } = await context.supabase
      .from("voice_presets")
      .select("id,name,voice_url")
      .eq("id", data.presetId)
      .single();
    if (error || !preset) throw new Error("Preset não encontrado");
    if (!/^https?:\/\//i.test(preset.voice_url)) {
      throw new Error("Este preset não tem áudio de referência (provavelmente já é Eleven/MiniMax). Use o áudio original.");
    }
    const res = await fetch(preset.voice_url);
    if (!res.ok) throw new Error(`Falha ao baixar áudio original: ${res.status}`);
    const blob = await res.blob();
    const file = new File([blob], "reference.mp3", { type: blob.type || "audio/mpeg" });
    const fd = new FormData();
    const newName = `${preset.name} (HD)`;
    fd.append("name", newName);
    fd.append("files", file, file.name);
    // Reusa cascade
    const parsed = readUpload(fd);
    const attempts: CascadeResult["attempts"] = [];
    try {
      const r = await tryEleven(parsed.name, parsed.files);
      await savePreset(context, `${parsed.name} (ElevenLabs)`, r.voiceId, "eleven");
      return { provider: "eleven" as const, voiceId: r.voiceId, name: parsed.name, source: "upload-eleven" as const, attempts };
    } catch (e) {
      attempts.push({ provider: "eleven", ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    try {
      const r = await tryMinimax(parsed.name, parsed.files[0]);
      await savePreset(context, `${parsed.name} (MiniMax)`, r.voiceId, "minimax");
      return { provider: "minimax" as const, voiceId: r.voiceId, name: parsed.name, source: "upload-minimax" as const, attempts };
    } catch (e) {
      attempts.push({ provider: "minimax", ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    throw new Error("Eleven e MiniMax falharam: " + attempts.map((a) => `${a.provider}=${a.error}`).join(" | "));
  });

