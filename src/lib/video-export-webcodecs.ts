// Browser-only WebCodecs + mp4-muxer encoder. ~10–50× faster than ffmpeg.wasm.
// Falls back to null when the browser doesn't support the required APIs; the
// caller (video-export.ts) then routes to the ffmpeg path.

import { stripMarkdownForTts } from "./text-utils";
import musicAsset from "@/assets/legends-opening.mp3.asset.json";
import {
  W,
  H,
  loadImage,
  drawDisclaimerFrame,
  drawVignetteFrame,
  drawIntroFrame,
  drawStageFrame,
  type ExportInput,
} from "./video-export";

type Segment = {
  draw: (ctx: CanvasRenderingContext2D) => void;
  audio: AudioBuffer | null;
  audioGain: number;
  /** Music to mix UNDER the spoken audio for this segment (already trimmed). */
  bedMusic?: { buffer: AudioBuffer; volume: number; fadeIn: number; fadeOut: number } | null;
  duration: number;
};

const FPS = 30;
// 44.1 kHz vs 48 kHz reduz ~8% do PCM em memória sem perda perceptível em fala/música.
const SAMPLE_RATE = 44100;
const VIDEO_BITRATE = 2_500_000;
const AUDIO_BITRATE = 128_000;

function logMem(stage: string): void {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
  if (perf.memory) {
    const used = (perf.memory.usedJSHeapSize / 1024 / 1024).toFixed(0);
    const lim = (perf.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0);
    console.info(`[video-export][mem] ${stage}: ${used}MB / ${lim}MB`);
  }
}

async function decodeAudioFromUrl(ac: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const r = await fetch(url);
    const ab = await r.arrayBuffer();
    return await ac.decodeAudioData(ab);
  } catch {
    return null;
  }
}

function trimBuffer(
  ac: BaseAudioContext,
  src: AudioBuffer,
  trimStart: number,
  trimEnd: number,
): AudioBuffer {
  const sr = src.sampleRate;
  const startSample = Math.max(0, Math.floor(trimStart * sr));
  const endSample = Math.max(startSample + 1, Math.floor((src.duration - trimEnd) * sr));
  const length = endSample - startSample;
  const out = ac.createBuffer(src.numberOfChannels, length, sr);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const data = src.getChannelData(ch).subarray(startSample, endSample);
    out.copyToChannel(data, ch, 0);
  }
  return out;
}

async function renderMixedAudio(segments: Segment[]): Promise<AudioBuffer> {
  const totalDur = segments.reduce((s, x) => s + x.duration, 0);
  const oac = new OfflineAudioContext(2, Math.ceil(totalDur * SAMPLE_RATE), SAMPLE_RATE);
  let t = 0;
  for (const seg of segments) {
    if (seg.audio) {
      const src = oac.createBufferSource();
      src.buffer = seg.audio;
      const g = oac.createGain();
      g.gain.value = seg.audioGain;
      src.connect(g).connect(oac.destination);
      src.start(t);
    }
    if (seg.bedMusic) {
      const src = oac.createBufferSource();
      src.buffer = seg.bedMusic.buffer;
      const g = oac.createGain();
      const { volume, fadeIn, fadeOut } = seg.bedMusic;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(volume, t + Math.max(0.05, fadeIn));
      const fadeStart = t + seg.duration - Math.max(0.05, fadeOut);
      g.gain.setValueAtTime(volume, Math.max(t + fadeIn, fadeStart));
      g.gain.linearRampToValueAtTime(0, t + seg.duration);
      src.connect(g).connect(oac.destination);
      src.start(t);
      src.stop(t + seg.duration + 0.05);
    }
    t += seg.duration;
  }
  return await oac.startRendering();
}

function planarFloat32(buf: AudioBuffer, offset: number, frames: number): {
  data: Float32Array; channels: number;
} {
  const ch = buf.numberOfChannels;
  const out = new Float32Array(ch * frames);
  for (let c = 0; c < ch; c++) {
    const src = buf.getChannelData(c);
    const slice = src.subarray(offset, Math.min(offset + frames, src.length));
    out.set(slice, c * frames);
  }
  return { data: out, channels: ch };
}

export async function tryExportDebateMp4Webcodecs(input: ExportInput): Promise<Blob | null> {
  // Feature check
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    VideoEncoder?: typeof VideoEncoder;
    AudioEncoder?: typeof AudioEncoder;
    VideoFrame?: typeof VideoFrame;
    AudioData?: typeof AudioData;
  };
  if (!w.VideoEncoder || !w.AudioEncoder || !w.VideoFrame || !w.AudioData) return null;

  const videoCodec = "avc1.42E01F";
  const supported = await VideoEncoder.isConfigSupported({
    codec: videoCodec,
    width: W,
    height: H,
    bitrate: VIDEO_BITRATE,
    framerate: FPS,
  }).catch(() => null);
  if (!supported || !supported.supported) return null;

  const audioSupported = await AudioEncoder.isConfigSupported({
    codec: "mp4a.40.2",
    numberOfChannels: 2,
    sampleRate: SAMPLE_RATE,
    bitrate: AUDIO_BITRATE,
  }).catch(() => null);
  if (!audioSupported || !audioSupported.supported) return null;

  const {
    topic, aName, bName, aImageUrl, bImageUrl, aDescription, bDescription,
    messages, musicUrl, musicVolume = 0.18, onProgress,
  } = input;
  const log = (s: string, p: number) => onProgress?.(s, Math.max(0, Math.min(1, p)));

  log("Carregando avatares", 0.02);
  const [aImg, bImg] = await Promise.all([
    aImageUrl ? loadImage(aImageUrl) : Promise.resolve(null),
    bImageUrl ? loadImage(bImageUrl) : Promise.resolve(null),
  ]);

  // ── Audio prep ──
  log("Decodificando áudios", 0.06);
  const ac = new AudioContext({ sampleRate: SAMPLE_RATE });
  // Avoid the AC ever running for output; OfflineAudioContext does the work.
  try { await ac.suspend(); } catch { /* noop */ }

  const openingBuf = await decodeAudioFromUrl(ac, musicAsset.url);
  const bgMusicBuf = musicUrl ? await decodeAudioFromUrl(ac, musicUrl) : null;

  const segments: Segment[] = [];

  // Disclaimer (4s) — opening music quiet
  segments.push({
    draw: (ctx) => drawDisclaimerFrame(ctx),
    audio: null,
    audioGain: 1,
    bedMusic: openingBuf ? { buffer: trimBuffer(ac, openingBuf, 0, 0), volume: 0.55, fadeIn: 0.4, fadeOut: 0.7 } : null,
    duration: 4,
  });

  // Vignette (6s) — opening music up
  if (openingBuf) {
    segments.push({
      draw: (ctx) => drawVignetteFrame(ctx, topic),
      audio: null,
      audioGain: 1,
      bedMusic: { buffer: trimBuffer(ac, openingBuf, 0, 0), volume: 0.85, fadeIn: 0.4, fadeOut: 0.8 },
      duration: 6,
    });
  }

  // Messages — decode each clip
  let decoded = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const raw = await decodeAudioFromUrl(ac, m.audioUrl);
    decoded++;
    log(`Decodificando voz ${decoded}/${messages.length}`, 0.06 + 0.14 * (decoded / messages.length));
    if (!raw) continue;
    const dur = raw.duration;
    const ts = Math.max(0, Math.min(dur - 0.2, m.trimStart ?? 0));
    const te = Math.max(0, Math.min(dur - ts - 0.2, m.trimEnd ?? 0));
    const trimmed = trimBuffer(ac, raw, ts, te);
    const effective = trimmed.duration;
    const showSubtitle = m.subtitle !== false;
    const caption = showSubtitle ? stripMarkdownForTts(m.content) : "";

    const draw = i === 0
      ? (ctx: CanvasRenderingContext2D) => drawIntroFrame(ctx, { topic, aName, bName, aImg, bImg, aDescription, bDescription })
      : (ctx: CanvasRenderingContext2D) => drawStageFrame(ctx, { topic, aName, bName, aImg, bImg, role: m.role, phase: m.phase, caption });

    const bed = bgMusicBuf
      ? { buffer: trimBuffer(ac, bgMusicBuf, 0, Math.max(0, bgMusicBuf.duration - effective - 0.1)), volume: musicVolume, fadeIn: 0.3, fadeOut: 0.3 }
      : null;
    segments.push({ draw, audio: trimmed, audioGain: 1, bedMusic: bed, duration: effective + 0.05 });
  }

  if (segments.length === 0) throw new Error("Sem segmentos pra codificar");

  logMem("antes do mix de áudio");
  log("Misturando áudio", 0.22);
  const mixed = await renderMixedAudio(segments);

  // Libera os AudioBuffers originais — não são mais necessários, e somam ~8MB/min cada.
  for (const seg of segments) {
    seg.audio = null;
    seg.bedMusic = null;
  }
  try { await ac.close(); } catch { /* noop */ }
  logMem("após mix (buffers liberados)");

  // ── Encoders + Muxer ──
  log("Iniciando encoder", 0.25);
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: W, height: H, frameRate: FPS },
    audio: { codec: "aac", sampleRate: SAMPLE_RATE, numberOfChannels: 2 },
    fastStart: "in-memory",
  });

  let videoErr: unknown = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { videoErr = e; },
  });
  videoEncoder.configure({
    codec: videoCodec,
    width: W,
    height: H,
    bitrate: VIDEO_BITRATE,
    framerate: FPS,
    // avc.format omitted — default "avc" works
  });

  let audioErr: unknown = null;
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => { audioErr = e; },
  });
  audioEncoder.configure({
    codec: "mp4a.40.2",
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 2,
    bitrate: AUDIO_BITRATE,
  });

  // ── Video: draw each segment once, emit FPS*duration frames ──
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const FRAME_DUR_US = Math.round(1_000_000 / FPS);
  let frameIndex = 0;
  const totalFrames = segments.reduce((s, x) => s + Math.round(x.duration * FPS), 0);

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx];
    seg.draw(ctx);
    const segFrames = Math.round(seg.duration * FPS);
    // Encode segFrames frames. Each frame uses the same canvas snapshot but a
    // unique timestamp; the encoder will produce tiny P-frames for the repeats.
    for (let f = 0; f < segFrames; f++) {
      // Backpressure: don't pile up more than ~2s of frames in the encoder.
      while (videoEncoder.encodeQueueSize > FPS * 2) {
        await new Promise((r) => setTimeout(r, 4));
        if (videoErr) throw videoErr;
      }
      const ts = frameIndex * FRAME_DUR_US;
      const frame = new VideoFrame(canvas, { timestamp: ts, duration: FRAME_DUR_US });
      try {
        videoEncoder.encode(frame, { keyFrame: f === 0 || f % (FPS * 2) === 0 });
      } finally {
        frame.close();
      }
      frameIndex++;
    }
    log(
      `Codificando vídeo ${segIdx + 1}/${segments.length}`,
      0.25 + 0.55 * (frameIndex / Math.max(1, totalFrames)),
    );
    if (videoErr) throw videoErr;
  }

  log("Finalizando vídeo", 0.82);
  await videoEncoder.flush();
  videoEncoder.close();
  if (videoErr) throw videoErr;

  // ── Audio: feed AudioData chunks of 1024 frames ──
  log("Codificando áudio", 0.86);
  const CHUNK = 1024;
  const totalSamples = mixed.length;
  let offset = 0;
  while (offset < totalSamples) {
    const frames = Math.min(CHUNK, totalSamples - offset);
    const { data, channels } = planarFloat32(mixed, offset, frames);
    const ts = Math.round((offset / SAMPLE_RATE) * 1_000_000);
    const ad = new AudioData({
      format: "f32-planar",
      sampleRate: SAMPLE_RATE,
      numberOfFrames: frames,
      numberOfChannels: channels,
      timestamp: ts,
      data: data.buffer as ArrayBuffer,
    });
    try {
      audioEncoder.encode(ad);
    } finally {
      ad.close();
    }
    offset += frames;
    if (audioErr) throw audioErr;
    if (audioEncoder.encodeQueueSize > 50) {
      await new Promise((r) => setTimeout(r, 4));
    }
  }
  await audioEncoder.flush();
  audioEncoder.close();
  if (audioErr) throw audioErr;

  log("Empacotando MP4", 0.97);
  muxer.finalize();
  const buf = muxer.target.buffer;
  try { await ac.close(); } catch { /* noop */ }
  return new Blob([buf], { type: "video/mp4" });
}
