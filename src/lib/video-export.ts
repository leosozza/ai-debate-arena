// Browser-only debate-to-MP4 exporter (ffmpeg.wasm + canvas).
// Lazy-imported from the presentation page; never runs on the server.

import { stripMarkdownForTts } from "./text-utils";
import { AI_DISCLAIMER_TEXT } from "@/components/AIDisclaimer";

export type ExportSide = "moderator" | "a" | "b";

export interface ExportMessage {
  id: string;
  role: ExportSide;
  phase: string;
  content: string;
  /** data: URL or http URL of the spoken audio (mp3/wav). Required. */
  audioUrl: string;
}

export interface ExportInput {
  topic: string;
  aName: string;
  bName: string;
  aImageUrl?: string | null;
  bImageUrl?: string | null;
  aDescription?: string | null;
  bDescription?: string | null;
  messages: ExportMessage[];
  onProgress?: (stage: string, pct: number) => void;
}

const W = 1280;
const H = 720;

/** Loads an HTMLImageElement (with crossOrigin for canvas tainting safety). */
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

function drawStageFrame(
  ctx: CanvasRenderingContext2D,
  opts: {
    topic: string;
    aName: string;
    bName: string;
    aImg: HTMLImageElement | null;
    bImg: HTMLImageElement | null;
    role: ExportSide;
    phase: string;
    caption: string;
  },
) {
  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1020");
  bg.addColorStop(1, "#05060d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top accent line
  ctx.fillStyle = "#7c3aed";
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, 0, W, 2);
  ctx.globalAlpha = 1;

  // Topic
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  const topic = opts.topic.length > 90 ? opts.topic.slice(0, 87) + "…" : opts.topic;
  ctx.fillText(topic, W / 2, 36);

  // Phase pill (center)
  if (opts.phase) {
    ctx.fillStyle = "#1e293b";
    const pillW = 220;
    const pillH = 26;
    const px = (W - pillW) / 2;
    const py = 54;
    roundRect(ctx, px, py, pillW, pillH, 13, "#1e293b");
    ctx.fillStyle = "#a78bfa";
    ctx.font = "600 12px system-ui";
    ctx.fillText(opts.phase.toUpperCase(), W / 2, py + 17);
  }

  // Debater panels
  const aActive = opts.role === "a";
  const bActive = opts.role === "b";
  const modActive = opts.role === "moderator";

  drawDebater(ctx, {
    x: 40,
    y: 110,
    w: 540,
    h: 460,
    name: opts.aName,
    img: opts.aImg,
    color: "#06b6d4",
    active: aActive,
    label: "DEBATEDOR A",
  });
  drawDebater(ctx, {
    x: W - 540 - 40,
    y: 110,
    w: 540,
    h: 460,
    name: opts.bName,
    img: opts.bImg,
    color: "#f59e0b",
    active: bActive,
    label: "DEBATEDOR B",
  });

  // VS badge
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(W / 2, 340, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 18px system-ui";
  ctx.fillText("VS", W / 2, 347);

  // Caption box (who is speaking)
  const speakerName =
    opts.role === "a" ? opts.aName : opts.role === "b" ? opts.bName : "Mediador";
  const speakerColor = aActive ? "#06b6d4" : bActive ? "#f59e0b" : "#a78bfa";

  // Caption background
  roundRect(ctx, 40, 590, W - 80, 110, 14, "rgba(15,23,42,0.92)");
  ctx.strokeStyle = speakerColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const r = 14;
  ctx.moveTo(40 + r, 590);
  ctx.arcTo(W - 40, 590, W - 40, 700, r);
  ctx.arcTo(W - 40, 700, 40, 700, r);
  ctx.arcTo(40, 700, 40, 590, r);
  ctx.arcTo(40, 590, W - 40, 590, r);
  ctx.closePath();
  ctx.stroke();

  // Speaker label
  ctx.fillStyle = speakerColor;
  ctx.font = "700 13px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(speakerName.toUpperCase(), 60, 612);

  // Caption text (wrap)
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "500 20px system-ui";
  ctx.textAlign = "left";
  const lines = wrapText(ctx, opts.caption, W - 120).slice(0, 3);
  lines.forEach((ln, i) => {
    ctx.fillText(ln, 60, 642 + i * 26);
  });
  if (wrapText(ctx, opts.caption, W - 120).length > 3) {
    ctx.fillStyle = "#64748b";
    ctx.fillText("…", 60 + ctx.measureText(lines[2] ?? "").width + 6, 642 + 2 * 26);
  }

  // Mod indicator dot
  if (modActive) {
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath();
    ctx.arc(W / 2, 90, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}


/** Opening disclaimer card: full-screen AI simulation warning. */
function drawDisclaimerFrame(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#05060d");
  bg.addColorStop(1, "#0b1020");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Warning triangle (simple)
  ctx.fillStyle = "#a78bfa";
  ctx.beginPath();
  ctx.moveTo(W / 2, 130);
  ctx.lineTo(W / 2 - 40, 200);
  ctx.lineTo(W / 2 + 40, 200);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0b1020";
  ctx.font = "800 36px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("!", W / 2, 195);

  ctx.fillStyle = "#a78bfa";
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("AVISO", W / 2, 240);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const titleLines = wrapText(ctx, "Este programa é uma simulação por inteligência artificial", W - 200).slice(0, 2);
  titleLines.forEach((ln, i) => ctx.fillText(ln, W / 2, 290 + i * 42));

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "400 18px system-ui";
  const bodyLines = wrapText(ctx, AI_DISCLAIMER_TEXT, W - 280).slice(0, 6);
  const startY = 290 + titleLines.length * 42 + 30;
  bodyLines.forEach((ln, i) => ctx.fillText(ln, W / 2, startY + i * 26));
}

/** Opening frame: two guests side-by-side with bios, Roda Viva style. */
function drawIntroFrame(
  ctx: CanvasRenderingContext2D,
  opts: {
    topic: string;
    aName: string;
    bName: string;
    aImg: HTMLImageElement | null;
    bImg: HTMLImageElement | null;
    aDescription?: string | null;
    bDescription?: string | null;
  },
) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1020");
  bg.addColorStop(1, "#05060d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // diagonal accent stripe
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.1);
  const grad = ctx.createLinearGradient(-W, 0, W, 0);
  grad.addColorStop(0, "rgba(124,58,237,0.0)");
  grad.addColorStop(0.5, "rgba(124,58,237,0.35)");
  grad.addColorStop(1, "rgba(124,58,237,0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(-W, -90, W * 2, 180);
  ctx.restore();

  // Header label
  ctx.fillStyle = "#a78bfa";
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("HOJE NO PROGRAMA", W / 2, 48);

  // Topic
  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const topicLines = wrapText(ctx, opts.topic, W - 160).slice(0, 2);
  topicLines.forEach((ln, i) => ctx.fillText(ln, W / 2, 92 + i * 40));

  // Guest columns
  drawIntroGuest(ctx, {
    cx: W * 0.25,
    name: opts.aName,
    img: opts.aImg,
    color: "#06b6d4",
    label: "CONVIDADO A",
    description: opts.aDescription ?? "",
  });
  drawIntroGuest(ctx, {
    cx: W * 0.75,
    name: opts.bName,
    img: opts.bImg,
    color: "#f59e0b",
    label: "CONVIDADO B",
    description: opts.bDescription ?? "",
  });

  // VS badge center
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 + 10, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("VS", W / 2, H / 2 + 17);

  // Footer label
  ctx.fillStyle = "#64748b";
  ctx.font = "600 12px system-ui";
  ctx.fillText("APRESENTAÇÃO DOS CONVIDADOS", W / 2, H - 24);
}

function drawIntroGuest(
  ctx: CanvasRenderingContext2D,
  o: {
    cx: number;
    name: string;
    img: HTMLImageElement | null;
    color: string;
    label: string;
    description: string;
  },
) {
  const cy = 270;
  const radius = 95;
  ctx.save();
  ctx.beginPath();
  ctx.arc(o.cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (o.img) {
    const iw = o.img.naturalWidth;
    const ih = o.img.naturalHeight;
    const scale = Math.max((radius * 2) / iw, (radius * 2) / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(o.img, o.cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(o.cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = "#64748b";
    ctx.font = "700 70px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((o.name?.[0] ?? "?").toUpperCase(), o.cx, cy);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  ctx.strokeStyle = o.color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(o.cx, cy, radius + 3, 0, Math.PI * 2);
  ctx.stroke();

  // Label
  ctx.fillStyle = o.color;
  ctx.font = "700 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(o.label, o.cx, cy + radius + 30);

  // Name
  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 28px system-ui";
  const name = o.name.length > 24 ? o.name.slice(0, 22) + "…" : o.name;
  ctx.fillText(name, o.cx, cy + radius + 60);

  // Description (wrap 3 lines)
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 15px system-ui";
  const lines = wrapText(ctx, o.description, 460).slice(0, 3);
  lines.forEach((ln, i) => ctx.fillText(ln, o.cx, cy + radius + 90 + i * 22));
}


function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
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

function drawDebater(
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    name: string;
    img: HTMLImageElement | null;
    color: string;
    active: boolean;
    label: string;
  },
) {
  // Panel background
  roundRect(
    ctx,
    o.x,
    o.y,
    o.w,
    o.h,
    18,
    o.active ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.55)",
  );
  // Border (active)
  if (o.active) {
    ctx.strokeStyle = o.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const r = 18;
    ctx.moveTo(o.x + r, o.y);
    ctx.arcTo(o.x + o.w, o.y, o.x + o.w, o.y + o.h, r);
    ctx.arcTo(o.x + o.w, o.y + o.h, o.x, o.y + o.h, r);
    ctx.arcTo(o.x, o.y + o.h, o.x, o.y, r);
    ctx.arcTo(o.x, o.y, o.x + o.w, o.y, r);
    ctx.closePath();
    ctx.stroke();
  }

  // Avatar (round, centered top)
  const cx = o.x + o.w / 2;
  const cy = o.y + 150;
  const radius = 110;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (o.img) {
    // cover fit
    const iw = o.img.naturalWidth;
    const ih = o.img.naturalHeight;
    const scale = Math.max((radius * 2) / iw, (radius * 2) / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(o.img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = "#64748b";
    ctx.font = "700 80px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((o.name?.[0] ?? "?").toUpperCase(), cx, cy);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  // Avatar ring
  ctx.strokeStyle = o.active ? o.color : "#334155";
  ctx.lineWidth = o.active ? 5 : 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
  ctx.stroke();

  // Label
  ctx.fillStyle = o.active ? o.color : "#64748b";
  ctx.font = "700 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(o.label, cx, o.y + o.h - 90);

  // Name
  ctx.fillStyle = o.active ? "#f8fafc" : "#94a3b8";
  ctx.font = "800 28px system-ui";
  const name = o.name.length > 24 ? o.name.slice(0, 22) + "…" : o.name;
  ctx.fillText(name, cx, o.y + o.h - 55);
}

/** Decodes audio (data: or http) to a Uint8Array. */
async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  const ab = await r.arrayBuffer();
  return new Uint8Array(ab);
}

/** Gets duration (seconds) of an audio source by loading it in an Audio element. */
function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 5);
    a.onerror = () => resolve(5);
    a.src = url;
  });
}

export async function exportDebateMp4(input: ExportInput): Promise<Blob> {
  const { topic, aName, bName, aImageUrl, bImageUrl, aDescription, bDescription, messages, onProgress } = input;
  const log = (stage: string, pct: number) => onProgress?.(stage, Math.max(0, Math.min(1, pct)));

  log("Carregando avatares", 0.02);
  const [aImg, bImg] = await Promise.all([
    aImageUrl ? loadImage(aImageUrl) : Promise.resolve(null),
    bImageUrl ? loadImage(bImageUrl) : Promise.resolve(null),
  ]);

  log("Iniciando codificador de vídeo", 0.05);
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");
  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  // Offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const segments: string[] = [];
  const total = messages.length;

  // ── Disclaimer segment (4s, silent audio) ──
  log("Renderizando aviso de IA", 0.08);
  drawDisclaimerFrame(ctx);
  {
    const pngBlob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), "image/png"),
    );
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    await ffmpeg.writeFile("disclaimer.png", pngBytes);
    await ffmpeg.exec([
      "-loop", "1",
      "-framerate", "2",
      "-i", "disclaimer.png",
      "-f", "lavfi",
      "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-t", "4",
      "-c:v", "libx264",
      "-tune", "stillimage",
      "-pix_fmt", "yuv420p",
      "-vf", "scale=1280:720",
      "-r", "24",
      "-c:a", "aac",
      "-b:a", "160k",
      "-ar", "44100",
      "-shortest",
      "-movflags", "+faststart",
      "seg_disclaimer.mp4",
    ]);
    await ffmpeg.deleteFile("disclaimer.png").catch(() => {});
    segments.push("seg_disclaimer.mp4");
  }


  for (let i = 0; i < total; i++) {
    const m = messages[i];
    const caption = stripMarkdownForTts(m.content);
    // O primeiro turno é a vinheta de abertura — usamos o frame de apresentação
    // dos convidados (estilo Roda Viva) em vez do palco padrão.
    if (i === 0) {
      drawIntroFrame(ctx, { topic, aName, bName, aImg, bImg, aDescription, bDescription });
    } else {
      drawStageFrame(ctx, {
        topic,
        aName,
        bName,
        aImg,
        bImg,
        role: m.role,
        phase: m.phase,
        caption,
      });
    }
    // PNG bytes
    const pngBlob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), "image/png"),
    );
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const imgName = `img${i}.png`;
    const audName = `aud${i}`;
    const segName = `seg${i}.mp4`;

    const audBytes = await fetchBytes(m.audioUrl);
    const duration = await getAudioDuration(m.audioUrl);

    await ffmpeg.writeFile(imgName, pngBytes);
    await ffmpeg.writeFile(audName, audBytes);

    // image + audio → mp4 segment. -shortest stops at audio end.
    await ffmpeg.exec([
      "-loop", "1",
      "-framerate", "2",
      "-i", imgName,
      "-i", audName,
      "-t", String(duration + 0.2),
      "-c:v", "libx264",
      "-tune", "stillimage",
      "-pix_fmt", "yuv420p",
      "-vf", "scale=1280:720",
      "-r", "24",
      "-c:a", "aac",
      "-b:a", "160k",
      "-ar", "44100",
      "-shortest",
      "-movflags", "+faststart",
      segName,
    ]);

    // free intermediate input bytes
    await ffmpeg.deleteFile(imgName).catch(() => {});
    await ffmpeg.deleteFile(audName).catch(() => {});

    segments.push(segName);
    log(`Codificando fala ${i + 1}/${total}`, 0.1 + (0.8 * (i + 1)) / total);
  }

  // Concat list
  const list = segments.map((s) => `file '${s}'`).join("\n");
  await ffmpeg.writeFile("list.txt", new TextEncoder().encode(list));

  log("Juntando segmentos", 0.92);
  await ffmpeg.exec([
    "-f", "concat",
    "-safe", "0",
    "-i", "list.txt",
    "-c", "copy",
    "-movflags", "+faststart",
    "out.mp4",
  ]);

  const out = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
  log("Pronto", 1);
  // Cleanup
  for (const s of segments) await ffmpeg.deleteFile(s).catch(() => {});
  await ffmpeg.deleteFile("list.txt").catch(() => {});
  await ffmpeg.deleteFile("out.mp4").catch(() => {});

  return new Blob([out as BlobPart], { type: "video/mp4" });
}
