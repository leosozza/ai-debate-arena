// Kokoro TTS — voz neural GRÁTIS rodando 100% no navegador (WebGPU/WASM).
// Carregado da CDN em runtime (não entra no bundle do app). O modelo (~80MB)
// baixa uma vez e fica cacheado pelo browser. Qualquer falha degrada pro
// navegador (quem chama trata o erro).

export { KOKORO_VOICES } from "./kokoro-voices";
import { loadCdnModule } from "./load-cdn";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsPromise: Promise<any> | null = null;

async function getTTS(onProgress?: (p: number) => void) {
  if (!ttsPromise) {
    ttsPromise = (async () => {
      // CDN via <script type=module> (sem import() de URL nem eval) → o bundle
      // do servidor (Cloudflare) fica limpo e o build da Lovable não quebra.
      const mod = await loadCdnModule("https://esm.sh/kokoro-js@^1");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const KokoroTTS = (mod as any).KokoroTTS;
      const hasGpu = typeof navigator !== "undefined" && "gpu" in navigator;
      const device = hasGpu ? "webgpu" : "wasm";
      return await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: device === "webgpu" ? "fp32" : "q8",
        device,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: onProgress ? (x: any) => { if (typeof x?.progress === "number") onProgress(x.progress); } : undefined,
      });
    })().catch((e) => {
      ttsPromise = null; // permite nova tentativa
      throw e;
    });
  }
  return ttsPromise;
}

const urlCache = new Map<string, string>();

/** Sintetiza `text` com a voz `voice` e devolve uma blob URL (cacheada). */
export async function kokoroSynthUrl(text: string, voice: string, onProgress?: (p: number) => void): Promise<string> {
  const key = `${voice}|${text}`;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const tts = await getTTS(onProgress);
  const audio = await tts.generate(text, { voice });
  const blob: Blob = audio.toBlob();
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

/** Pré-carrega o modelo (ex.: durante a tela de preparação). */
export async function preloadKokoro(onProgress?: (p: number) => void): Promise<void> {
  await getTTS(onProgress);
}
