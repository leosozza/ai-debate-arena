import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKET = "persona-images";
const SIGNED_TTL = 60 * 60 * 24 * 365;

const FLUX_MODELS = {
  schnell: "black-forest-labs/flux-schnell",
  "1.1-pro": "black-forest-labs/flux-1.1-pro",
} as const;

function pickUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === "string") return output[0];
  return null;
}

export const generatePersonaImageReplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(500).optional(),
        model: z.enum(["schnell", "1.1-pro"]).default("schnell"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { runPrediction } = await import("./replicate.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const prompt = `Photorealistic head-and-shoulders portrait avatar of "${data.name}"${
      data.description ? `, ${data.description}` : ""
    }. Square framing, neutral studio background, soft lighting, dignified expression, sharp focus, ultra-high detail, 85mm lens.`;

    const modelName = FLUX_MODELS[data.model];
    const input: Record<string, unknown> =
      data.model === "schnell"
        ? { prompt, aspect_ratio: "1:1", output_format: "png", num_outputs: 1, go_fast: true }
        : { prompt, aspect_ratio: "1:1", output_format: "png", safety_tolerance: 5 };

    const output = await runPrediction(modelName, input, { maxMs: 180_000 });
    const url = pickUrl(output);
    if (!url) throw new Error("Replicate FLUX: resposta sem imagem.");

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Falha ao baixar imagem do Replicate (${resp.status}).`);
    const bytes = new Uint8Array(await resp.arrayBuffer());

    const path = `${context.userId}/${crypto.randomUUID()}.png`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL);
    if (sErr || !signed) throw new Error(`Signed URL falhou: ${sErr?.message}`);

    return { imageUrl: signed.signedUrl, model: modelName };
  });
