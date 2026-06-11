// Piper TTS — vozes neurais pt-BR GRÁTIS rodando no navegador (ONNX/WASM).
// Carregado da CDN em runtime (escondido do bundler → não vai pro bundle do
// servidor, não quebra o Cloudflare). Falhas degradam pro navegador.
export { PIPER_VOICES } from "./piper-voices";
import { loadCdnModule } from "./load-cdn";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modPromise: Promise<any> | null = null;

async function getMod() {
  if (!modPromise) {
    modPromise = (async () => {
      return await loadCdnModule("https://esm.sh/@mintplex-labs/piper-tts-web@1.0.4");
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
  // Cache limitado: evita vazamento de memória em debates longos.
  if (urlCache.size >= 200) {
    const oldest = urlCache.keys().next().value;
    if (oldest) { const old = urlCache.get(oldest); if (old) URL.revokeObjectURL(old); urlCache.delete(oldest); }
  }
  urlCache.set(key, url);
  return url;
}
