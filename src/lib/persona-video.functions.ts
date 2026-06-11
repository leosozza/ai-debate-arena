import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKET = "persona-videos";
const SIGNED_TTL = 60 * 60 * 24 * 365;

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
    const imgResp = await fetch(persona.image_url);
    if (!imgResp.ok) throw new Error("Falha ao baixar a imagem da persona.");
    const imgBuf = await imgResp.arrayBuffer();
    const ct = imgResp.headers.get("content-type") ?? "image/png";
    const ext = ct.includes("jpeg") ? "jpg" : ct.includes("webp") ? "webp" : "png";
    const imgFile = new File([imgBuf], `persona.${ext}`, { type: ct });
    const inputImageUrl = await uploadFile(imgFile);

    // 3) build prompt
    const prompt = `Cinematic short vignette portrait of ${persona.name}${
      persona.description ? `, ${persona.description}` : ""
    }. Subtle camera movement (slow push-in), shallow depth of field, professional lighting, coherent environment, dignified expression. ${
      data.withAudio ? "Ambient background sound." : ""
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
