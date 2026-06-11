import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKET = "persona-videos";
const SIGNED_TTL = 60 * 60 * 24 * 365;

function resolveImageUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  try {
    const req = getRequest();
    const origin = new URL(req.url).origin;
    return new URL(raw, origin).toString();
  } catch {
    throw new Error(`Imagem da persona usa caminho relativo (${raw}). Regenere a imagem para salvá-la no storage.`);
  }
}

function pickUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === "string") return output[0];
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    if (typeof o.video === "string") return o.video;
    if (typeof o.url === "string") return o.url;
  }
  return null;
}

export const generatePersonaVignette = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        personaId: z.string().uuid(),
        aspectRatio: z.enum(["16:9", "9:16"]).default("9:16"),
        withAudio: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runPrediction, uploadFile } = await import("./replicate.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) load persona (must belong to user)
    const { data: persona, error: pErr } = await context.supabase
      .from("personas")
      .select("id, name, description, image_url, user_id")
      .eq("id", data.personaId)
      .single();
    if (pErr || !persona) throw new Error("Persona não encontrada.");
    if (persona.user_id !== context.userId) throw new Error("Sem permissão.");
    if (!persona.image_url) throw new Error("A persona precisa ter uma imagem antes de gerar a vinheta.");

    // 2) download the persona image and upload to Replicate as a File
    const imgResp = await fetch(resolveImageUrl(persona.image_url));
    if (!imgResp.ok) throw new Error("Falha ao baixar a imagem da persona.");
    const imgBuf = await imgResp.arrayBuffer();
    const ct = imgResp.headers.get("content-type") ?? "image/png";
    const ext = ct.includes("jpeg") ? "jpg" : ct.includes("webp") ? "webp" : "png";
    const imgFile = new File([imgBuf], `persona.${ext}`, { type: ct });
    const inputImageUrl = await uploadFile(imgFile);

    // 3) build prompt — Legends Arena holographic portal vignette
    const prompt = `Cinematic vignette: a circular metallic projector disc on a dark amphitheater floor activates with a burst of cyan-blue light; from the rising beam, a translucent blue holographic bust of ${persona.name}${
      persona.description ? ` (${persona.description})` : ""
    } materializes with glowing particles and digital scan lines, dignified expression, slow push-in camera, distant warm ambient stage lights in the background, deep black surroundings, sci-fi hologram aesthetic, dramatic rim light, photoreal. ${
      data.withAudio ? "Subtle electric hum and ambient stage sound." : ""
    }`;

    // 4) try Veo 3 Fast first when audio is requested, otherwise Wan
    type Attempt = { model: string; input: Record<string, unknown>; useVersion?: boolean };
    const attempts: Attempt[] = [];
    if (data.withAudio) {
      attempts.push({
        model: "google/veo-3-fast",
        input: {
          prompt,
          image: inputImageUrl,
          aspect_ratio: data.aspectRatio,
          duration: 8,
        },
      });
    }
    attempts.push({
      model: "wan-video/wan-2.2-i2v-fast",
      input: { image: inputImageUrl, prompt, num_frames: 81 },
    });

    let output: unknown = null;
    let modelUsed = "";
    const errors: string[] = [];
    for (const a of attempts) {
      try {
        output = await runPrediction(a.model, a.input, { maxMs: 540_000, useVersion: a.useVersion });
        modelUsed = a.model;
        break;
      } catch (e) {
        errors.push(`${a.model}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (!output) throw new Error(`Geração de vinheta falhou. ${errors.join(" | ")}`);

    const videoUrl = pickUrl(output);
    if (!videoUrl) throw new Error("Replicate: saída sem vídeo.");

    // 5) download MP4 and store in our bucket
    const vResp = await fetch(videoUrl);
    if (!vResp.ok) throw new Error(`Falha ao baixar o vídeo (${vResp.status}).`);
    const vBytes = new Uint8Array(await vResp.arrayBuffer());

    const path = `${context.userId}/${crypto.randomUUID()}.mp4`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, vBytes, { contentType: "video/mp4", upsert: false });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL);
    if (sErr || !signed) throw new Error(`Signed URL falhou: ${sErr?.message}`);

    // 6) persist on the persona
    await context.supabase
      .from("personas")
      .update({ vignette_url: signed.signedUrl, vignette_model: modelUsed })
      .eq("id", persona.id);

    return { vignetteUrl: signed.signedUrl, model: modelUsed };
  });

/** Returns existing vignette if present; otherwise generates one (Wan no-audio, faster). */
export const ensurePersonaVignette = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ personaId: z.string().uuid(), aspectRatio: z.enum(["16:9", "9:16"]).default("16:9") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: persona, error: pErr } = await context.supabase
      .from("personas")
      .select("id, vignette_url, image_url, name, description, user_id")
      .eq("id", data.personaId)
      .single();
    if (pErr || !persona) throw new Error("Persona não encontrada.");
    if (persona.user_id !== context.userId) throw new Error("Sem permissão.");
    if (persona.vignette_url) return { vignetteUrl: persona.vignette_url, cached: true };
    if (!persona.image_url) return { vignetteUrl: null as string | null, cached: false };
    // Skip auto-gen for bundle/relative paths (server can't fetch its own dev URL)
    if (!/^https?:\/\//i.test(persona.image_url)) return { vignetteUrl: null as string | null, cached: false };

    const { runPrediction, uploadFile } = await import("./replicate.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const imgResp = await fetch(resolveImageUrl(persona.image_url));
    if (!imgResp.ok) throw new Error("Falha ao baixar a imagem.");
    const imgBuf = await imgResp.arrayBuffer();
    const ct = imgResp.headers.get("content-type") ?? "image/png";
    const ext = ct.includes("jpeg") ? "jpg" : ct.includes("webp") ? "webp" : "png";
    const file = new File([imgBuf], `persona.${ext}`, { type: ct });
    const inputImageUrl = await uploadFile(file);

    const prompt = `Cinematic vignette: a circular metallic projector disc on a dark amphitheater floor activates with a burst of cyan-blue light; from the rising beam, a translucent blue holographic bust of ${persona.name}${
      persona.description ? ` (${persona.description})` : ""
    } materializes with glowing particles and digital scan lines, dignified expression, slow push-in camera, distant warm ambient stage lights, deep black surroundings, sci-fi hologram aesthetic, photoreal.`;

    const output = await runPrediction(
      "wan-video/wan-2.2-i2v-fast",
      { image: inputImageUrl, prompt, num_frames: 81 },
      { maxMs: 300_000 },
    );
    const videoUrl = pickUrl(output);
    if (!videoUrl) throw new Error("Sem vídeo.");

    const vResp = await fetch(videoUrl);
    if (!vResp.ok) throw new Error(`Download falhou (${vResp.status}).`);
    const vBytes = new Uint8Array(await vResp.arrayBuffer());
    const path = `${context.userId}/${crypto.randomUUID()}.mp4`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, vBytes, { contentType: "video/mp4", upsert: false });
    if (upErr) throw new Error(`Upload: ${upErr.message}`);
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL);
    if (sErr || !signed) throw new Error(`Signed URL: ${sErr?.message}`);

    await context.supabase
      .from("personas")
      .update({ vignette_url: signed.signedUrl, vignette_model: "wan-video/wan-2.2-i2v-fast" })
      .eq("id", persona.id);

    return { vignetteUrl: signed.signedUrl, cached: false };
  });
