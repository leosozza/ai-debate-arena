// Piper TTS — vozes neurais pt-BR GRÁTIS rodando no navegador (ONNX/WASM).
// Carregado da CDN em runtime (escondido do bundler → não vai pro bundle do
// servidor, não quebra o Cloudflare). Falhas degradam pro navegador.
export { PIPER_VOICES } from "./piper-voices";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modPromise: Promise<any> | null = null;

async function getMod() {
  if (!modPromise) {
    modPromise = (async () => {
      const cdn = "https://esm.sh/@mintplex-labs/piper-tts-web@1.0.4";
      const dynamicImport = new Function("u", "return import(u)") as unknown as (u: string) => Promise<Record<string, unknown>>;
      return await dynamicImport(cdn);
    })().catch((e) => {
      modPromise = null; // permite nova tentativa
      throw e;
    });
  }
  return modPromise;
}

const urlCache = new Map<string, string>();

/** Sintetiza `text` com a voz Piper `voiceId` e devolve uma blob URL (cacheada). */
export async function piperSynthUrl(text: string, voiceId: string): Promise<string> {
  const key = `${voiceId}|${text}`;
  const cached = urlCache.get(key);
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await getMod()) as any;
  const wav: Blob = await mod.predict({ text, voiceId });
  const url = URL.createObjectURL(wav);
  urlCache.set(key, url);
  return url;
}
