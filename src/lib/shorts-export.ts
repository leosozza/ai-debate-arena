// Browser-only 9:16 short exporter — variante vertical do video-export.
// Foco: highlight reel curto (3 trechos), avatar grande no topo,
// legenda CapCut grande na base, bed de tensão por baixo.

import { stripMarkdownForTts } from "./text-utils";
import { synthBed } from "./sfx";

export type ShortSide = "moderator" | "a" | "b";

export interface ShortMessage {
  id: string;
  role: ShortSide;
  speakerName: string;
  imageUrl?: string | null;
  phase: string;
  content: string;
  audioUrl: string;
}

export interface ShortExportInput {
  topic: string;
  messages: ShortMessage[];
  /** Volume do bed musical (0..1, default 0.18). */
  bedVolume?: number;
  onProgress?: (stage: string, pct: number) => void;
}

const W = 1080;
const H = 1920;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function colorFor(role: ShortSide): string {
  return role === "a" ? "#06b6d4" : role === "b" ? "#f59e0b" : "#a78bfa";
}

function drawShortFrame(
  ctx: CanvasRenderingContext2D,
  opts: { topic: string; msg: ShortMessage; img: HTMLImageElement | null },
) {
  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1020");
  bg.addColorStop(1, "#05060d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top topic
  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  const topic = opts.topic.length > 70 ? opts.topic.slice(0, 67) + "…" : opts.topic;
  ctx.fillText(topic, W / 2, 70);

  // Phase pill
  if (opts.msg.phase) {
    const pillW = 340, pillH = 44;
    roundRect(ctx, (W - pillW) / 2, 100, pillW, pillH, 22, "#1e293b");
    ctx.fillStyle = colorFor(opts.msg.role);
    ctx.font = "700 22px system-ui";
    ctx.fillText(opts.msg.phase.toUpperCase(), W / 2, 130);
  }

  // Avatar (big circle, centered)
  const cx = W / 2;
  const cy = 620;
  const radius = 320;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (opts.img) {
    const iw = opts.img.naturalWidth;
    const ih = opts.img.naturalHeight;
    const scale = Math.max((radius * 2) / iw, (radius * 2) / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(opts.img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = "#64748b";
    ctx.font = "800 220px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((opts.msg.speakerName?.[0] ?? "?").toUpperCase(), cx, cy);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  // Ring
  ctx.strokeStyle = colorFor(opts.msg.role);
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.stroke();

  // Speaker name
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 56px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  const name = opts.msg.speakerName.length > 26 ? opts.msg.speakerName.slice(0, 24) + "…" : opts.msg.speakerName;
  ctx.fillText(name, cx, cy + radius + 90);

  // Caption block (CapCut style, big, with stroke)
  const caption = stripMarkdownForTts(opts.msg.content);
  ctx.font = "800 52px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const maxW = W - 120;
  const allLines = wrapText(ctx, caption, maxW);
  const lines = allLines.slice(0, 8);
  const lineH = 64;
  const blockH = lines.length * lineH + 60;
  const blockY = H - blockH - 80;
  roundRect(ctx, 40, blockY, W - 80, blockH, 24, "rgba(15,23,42,0.92)");
  ctx.strokeStyle = colorFor(opts.msg.role);
  ctx.lineWidth = 4;
  ctx.beginPath();
  const r = 24;
  ctx.moveTo(40 + r, blockY);
  ctx.arcTo(W - 40, blockY, W - 40, blockY + blockH, r);
  ctx.arcTo(W - 40, blockY + blockH, 40, blockY + blockH, r);
  ctx.arcTo(40, blockY + blockH, 40, blockY, r);
  ctx.arcTo(40, blockY, W - 40, blockY, r);
  ctx.closePath();
  ctx.stroke();

  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.textAlign = "left";
  lines.forEach((ln, i) => {
    const y = blockY + 70 + i * lineH;
    ctx.strokeText(ln, 80, y);
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(ln, 80, y);
  });
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  const ab = await r.arrayBuffer();
  return new Uint8Array(ab);
}

function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 5);
    a.onerror = () => resolve(5);
    a.src = url;
  });
}

export async function exportShortMp4(input: ShortExportInput): Promise<Blob> {
  const { topic, messages, bedVolume = 0.18, onProgress } = input;
  const log = (stage: string, pct: number) => onProgress?.(stage, Math.max(0, Math.min(1, pct)));
  if (messages.length === 0) throw new Error("Sem mensagens para o short.");

  log("Carregando avatares", 0.02);
  const imgs = await Promise.all(messages.map((m) => (m.imageUrl ? loadImage(m.imageUrl) : Promise.resolve(null))));

  log("Iniciando codificador", 0.05);
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const segments: string[] = [];
  let totalDur = 0;

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    drawShortFrame(ctx, { topic, msg: m, img: imgs[i] });
    const pngBlob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const imgName = `img${i}.png`;
    const audName = `aud${i}`;
    const segName = `seg${i}.mp4`;
    const audBytes = await fetchBytes(m.audioUrl);
    const dur = await getAudioDuration(m.audioUrl);
    await ffmpeg.writeFile(imgName, pngBytes);
    await ffmpeg.writeFile(audName, audBytes);
    await ffmpeg.exec([
      "-loop", "1",
      "-framerate", "2",
      "-i", imgName,
      "-i", audName,
      "-t", String(dur + 0.05),
      "-c:v", "libx264",
      "-tune", "stillimage",
      "-pix_fmt", "yuv420p",
      "-vf", `scale=${W}:${H}`,
      "-r", "24",
      "-c:a", "aac",
      "-b:a", "160k",
      "-ar", "44100",
      "-shortest",
      "-movflags", "+faststart",
      segName,
    ]);
    await ffmpeg.deleteFile(imgName).catch(() => {});
    await ffmpeg.deleteFile(audName).catch(() => {});
    segments.push(segName);
    totalDur += dur;
    log(`Codificando trecho ${i + 1}/${messages.length}`, 0.05 + (0.75 * (i + 1)) / messages.length);
  }

  log("Juntando trechos", 0.85);
  const list = segments.map((s) => `file '${s}'`).join("\n");
  await ffmpeg.writeFile("list.txt", new TextEncoder().encode(list));
  await ffmpeg.exec([
    "-f", "concat",
    "-safe", "0",
    "-i", "list.txt",
    "-c", "copy",
    "-movflags", "+faststart",
    "concat.mp4",
  ]);

  let finalFile = "concat.mp4";
  try {
    log("Misturando trilha", 0.93);
    const bedBytes = await synthBed("bed_tension", Math.max(4, totalDur));
    await ffmpeg.writeFile("bed.wav", bedBytes);
    const vol = Math.max(0, Math.min(1, bedVolume));
    await ffmpeg.exec([
      "-i", "concat.mp4",
      "-i", "bed.wav",
      "-filter_complex",
      `[1:a]volume=${vol.toFixed(2)},afade=t=in:st=0:d=0.6,afade=t=out:st=${Math.max(0, totalDur - 0.8).toFixed(2)}:d=0.8[b];[0:a][b]amix=inputs=2:duration=first:normalize=0[a]`,
      "-map", "0:v",
      "-map", "[a]",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "out.mp4",
    ]);
    await ffmpeg.deleteFile("bed.wav").catch(() => {});
    await ffmpeg.deleteFile("concat.mp4").catch(() => {});
    finalFile = "out.mp4";
  } catch {
    // sem bed — usa concat puro
  }

  const out = (await ffmpeg.readFile(finalFile)) as Uint8Array;
  log("Pronto", 1);
  for (const s of segments) await ffmpeg.deleteFile(s).catch(() => {});
  await ffmpeg.deleteFile("list.txt").catch(() => {});
  await ffmpeg.deleteFile(finalFile).catch(() => {});
  return new Blob([out as BlobPart], { type: "video/mp4" });
}
