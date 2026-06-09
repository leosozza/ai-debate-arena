import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const BUCKET = "persona-images";
const SIGNED_TTL = 60 * 60 * 24 * 365; // 1 ano

async function uploadAndSign(
  userId: string,
  bytes: Uint8Array,
  contentType: string,
  ext: string,
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL);
  if (error || !data) throw new Error(`Signed URL falhou: ${error?.message}`);
  return data.signedUrl;
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
}

async function callImageGateway(body: object): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Limite de uso atingido. Tente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados.");
    throw new Error(`Geração de imagem falhou (${res.status}): ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("Resposta da IA sem imagem.");
  return b64;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Gera avatar realista da persona via AI Gateway (gpt-image-2). */
export const generatePersonaImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const prompt = `Photorealistic portrait avatar of "${data.name}"${
      data.description ? `, ${data.description}` : ""
    }. Head-and-shoulders, neutral studio background, soft lighting, dignified expression, square framing, ultra-high detail.`;
    const b64 = await callImageGateway({
      model: "openai/gpt-image-2",
      prompt,
      size: "1024x1024",
      quality: "low",
      n: 1,
    });
    const url = await uploadAndSign(context.userId, b64ToBytes(b64), "image/png", "png");
    return { imageUrl: url };
  });

/** Upload direto de imagem da persona. */
export const uploadPersonaImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Esperado FormData.");
    const file = d.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Envie 1 imagem.");
    if (!file.type.startsWith("image/")) throw new Error("Arquivo não é uma imagem.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Imagem excede 8 MB.");
    return { file };
  })
  .handler(async ({ data, context }) => {
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const url = await uploadAndSign(context.userId, bytes, data.file.type, extFromMime(data.file.type));
    return { imageUrl: url };
  });

/** Melhora/edita imagem enviada via Gemini image edit. */
export const enhancePersonaImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Esperado FormData.");
    const file = d.get("file");
    const prompt = String(d.get("prompt") ?? "").trim();
    if (!(file instanceof File) || file.size === 0) throw new Error("Envie 1 imagem.");
    if (!file.type.startsWith("image/")) throw new Error("Arquivo não é uma imagem.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Imagem excede 8 MB.");
    return { file, prompt };
  })
  .handler(async ({ data, context }) => {
    const buf = new Uint8Array(await data.file.arrayBuffer());
    const inputB64 = btoa(String.fromCharCode(...buf));
    const dataUrl = `data:${data.file.type};base64,${inputB64}`;
    const instruction =
      data.prompt && data.prompt.length > 2
        ? data.prompt
        : "Enhance this portrait into a clean head-and-shoulders avatar: sharpen details, fix lighting to soft studio light, neutral background, photorealistic, ultra-high detail. Keep the person's identity unchanged.";
    const b64 = await callImageGateway({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      modalities: ["image", "text"],
    });
    const url = await uploadAndSign(context.userId, b64ToBytes(b64), "image/png", "png");
    return { imageUrl: url };
  });
