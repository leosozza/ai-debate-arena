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

/** Chama a API nativa do Google Gemini (gemini-2.5-flash-image) usando a
 *  GEMINI_API_KEY do projeto — não depende dos créditos do Lovable AI. */
async function callGeminiDirect(prompt: string, refDataUrls: string[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente.");
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  for (const url of refDataUrls) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(url);
    if (!m) continue;
    parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }
  const model = "gemini-2.5-flash-image";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Gemini: limite de uso atingido. Tente em instantes.");
    throw new Error(`Gemini falhou (${res.status}): ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string }; inline_data?: { data?: string } }> } }>;
  };
  for (const cand of json.candidates ?? []) {
    for (const p of cand.content?.parts ?? []) {
      const b64 = p.inlineData?.data ?? p.inline_data?.data;
      if (b64) return b64;
    }
  }
  throw new Error("Gemini não retornou imagem.");
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Gera avatar da persona. Se for pessoa real, busca imagens de referência
 *  na web (Firecrawl) e usa Gemini image edit para produzir um avatar fiel.
 *  Se não houver referências, cai num fallback puramente textual (gpt-image-2). */
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
    const { firecrawlImageSearch } = await import("./firecrawl.server");

    // 1) tenta achar referências reais da pessoa
    let refs: Array<{ url: string; title: string }> = [];
    try {
      refs = await firecrawlImageSearch(`${data.name} retrato rosto`, { limit: 6 });
    } catch {
      refs = [];
    }

    // 2) baixa até 3 referências como data URLs
    const refDataUrls: string[] = [];
    for (const r of refs.slice(0, 6)) {
      if (refDataUrls.length >= 3) break;
      try {
        const resp = await fetch(r.url, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) continue;
        const ct = resp.headers.get("content-type") ?? "image/jpeg";
        if (!ct.startsWith("image/")) continue;
        const buf = new Uint8Array(await resp.arrayBuffer());
        if (buf.byteLength < 4_000 || buf.byteLength > 6 * 1024 * 1024) continue;
        // btoa em chunks (evita stack overflow em buffers grandes)
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) {
          bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        }
        refDataUrls.push(`data:${ct};base64,${btoa(bin)}`);
      } catch {
        // ignora referência ruim
      }
    }

    const baseInstruction = `Photorealistic head-and-shoulders portrait of "${data.name}"${
      data.description ? `, ${data.description}` : ""
    }. Centered face, neutral dignified expression, soft studio lighting, plain dark neutral background, ultra-detailed, sharp focus on the face, 85mm lens, color photograph, museum-quality reference portrait. No text, no watermarks, no frames, no special effects, no holograms. Square 1:1 framing.`;

    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const instruction = refDataUrls.length > 0
      ? `${baseInstruction}\n\nIMPORTANT: The reference images below show the REAL person — reproduce their actual face, features, ethnicity, age range and hair faithfully. Output a clean photorealistic portrait (NOT a hologram, NOT stylized) — just a high-quality reference photo of this person.`
      : baseInstruction;

    let b64: string;
    try {
      if (hasGeminiKey) {
        // Caminho preferido: API nativa do Google Gemini com a chave do projeto
        // (não consome créditos do Lovable AI).
        b64 = await callGeminiDirect(instruction, refDataUrls);
      } else if (refDataUrls.length > 0) {
        b64 = await callImageGateway({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: instruction },
                ...refDataUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
              ],
            },
          ],
          modalities: ["image", "text"],
        });
      } else {
        b64 = await callImageGateway({
          model: "openai/gpt-image-2",
          prompt: baseInstruction,
          size: "1024x1024",
          quality: "low",
          n: 1,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao gerar imagem";
      console.error("[generatePersonaImage]", msg);
      return { imageUrl: null as string | null, referencesUsed: refDataUrls.length, error: msg, fallback: true as const };
    }

    const url = await uploadAndSign(context.userId, b64ToBytes(b64), "image/png", "png");
    return { imageUrl: url as string | null, referencesUsed: refDataUrls.length, error: null as string | null, fallback: false as const };
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
