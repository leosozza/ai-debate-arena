// Per-speech MP4 export. Generates one short MP4 per debate speech and exposes
// a helper to concatenate the parts into a single MP4 without re-encoding.
//
// Why: rendering the whole debate in a single browser pass overflows the tab's
// RAM (audio buffers + canvas + muxer all in memory at once) and Chrome kills
// the tab. By rendering one short clip at a time, RAM peaks at ~100 MB and the
// tab stays alive even for 15-minute debates.

import { exportDebateMp4, type ExportInput, type ExportMessage } from "./video-export";

export interface PerSpeechInput {
  /** Shared metadata for every part. */
  topic: string;
  aName: string;
  bName: string;
  aImageUrl?: string | null;
  bImageUrl?: string | null;
  aDescription?: string | null;
  bDescription?: string | null;
  /** Background music URL (mixed under each part at low volume). */
  musicUrl?: string | null;
  musicVolume?: number;
}

/**
 * Render a single speech to an MP4 blob, with no opening disclaimer / vignette.
 * Designed to be called repeatedly inside a sequential loop.
 */
export async function exportSpeechToMp4(
  base: PerSpeechInput,
  message: ExportMessage,
  onProgress?: (label: string, pct: number) => void,
): Promise<Blob> {
  const input: ExportInput = {
    ...base,
    messages: [message],
    includeIntro: false,
    onProgress,
  };
  return await exportDebateMp4(input);
}

/**
 * Concatenate N MP4 parts into a single MP4 using ffmpeg.wasm.
 *
 * Plan A: `-c copy` (no re-encode) — fast (~5–15 s for 33 parts) and almost
 * zero CPU. Works when all parts share encoder/resolution/fps/sample-rate,
 * which they always do here (same `exportDebateMp4` pipeline).
 *
 * Plan B: full re-encode with `-preset ultrafast` — only triggered if A fails.
 */
export async function concatMp4Parts(
  parts: Blob[],
  onProgress?: (label: string, pct: number) => void,
): Promise<Blob> {
  if (parts.length === 0) throw new Error("Sem partes para juntar.");
  if (parts.length === 1) return parts[0];

  const log = (label: string, pct: number) =>
    onProgress?.(label, Math.max(0, Math.min(1, pct)));

  log("Carregando codificador", 0.05);
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  // Escreve cada parte no FS virtual.
  const names: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const name = `part${String(i).padStart(3, "0")}.mp4`;
    const bytes = new Uint8Array(await parts[i].arrayBuffer());
    await ffmpeg.writeFile(name, bytes);
    names.push(name);
    log(`Preparando parte ${i + 1}/${parts.length}`, 0.05 + 0.25 * ((i + 1) / parts.length));
  }

  // Lista para o concat demuxer.
  const list = names.map((n) => `file '${n}'`).join("\n");
  await ffmpeg.writeFile("list.txt", new TextEncoder().encode(list));

  // ── Plano A: concat sem reencode (rápido) ──
  log("Juntando partes (sem reencode)", 0.5);
  let outName = "out.mp4";
  let okFastPath = true;
  try {
    await ffmpeg.exec([
      "-f", "concat",
      "-safe", "0",
      "-i", "list.txt",
      "-c", "copy",
      "-movflags", "+faststart",
      outName,
    ]);
  } catch (e) {
    console.warn("[concat] reencode falhou no plano A, tentando plano B:", e);
    okFastPath = false;
  }

  // ── Plano B: reencode rápido (raro — caso parts tenham timebase divergente) ──
  if (!okFastPath) {
    log("Juntando partes (reencode rápido)", 0.6);
    outName = "out_re.mp4";
    await ffmpeg.exec([
      "-f", "concat",
      "-safe", "0",
      "-i", "list.txt",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "44100",
      "-movflags", "+faststart",
      outName,
    ]);
  }

  log("Empacotando MP4 final", 0.95);
  const out = (await ffmpeg.readFile(outName)) as Uint8Array;

  // Cleanup
  for (const n of names) await ffmpeg.deleteFile(n).catch(() => {});
  await ffmpeg.deleteFile("list.txt").catch(() => {});
  await ffmpeg.deleteFile(outName).catch(() => {});

  log("Pronto", 1);
  return new Blob([out as BlobPart], { type: "video/mp4" });
}

/** Build a ZIP with every part as a numbered MP4. */
export async function zipMp4Parts(
  parts: { name: string; blob: Blob }[],
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const p of parts) {
    zip.file(p.name, p.blob);
  }
  return await zip.generateAsync({ type: "blob", compression: "STORE" });
}
