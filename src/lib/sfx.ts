// Efeitos sonoros sintetizados no navegador (Web Audio) — sem assets, sem CORS.
// Cada um é renderizado offline para bytes WAV (mono 44.1kHz) e cacheado.
export type SfxType = "ding" | "pop" | "whoosh" | "drumroll" | "suspense" | "applause";

export const SFX_TYPES: { type: SfxType; label: string; emoji: string }[] = [
  { type: "ding", label: "Ding", emoji: "🔔" },
  { type: "pop", label: "Pop", emoji: "✨" },
  { type: "whoosh", label: "Whoosh", emoji: "💨" },
  { type: "drumroll", label: "Rufar", emoji: "🥁" },
  { type: "suspense", label: "Suspense", emoji: "😨" },
  { type: "applause", label: "Aplauso", emoji: "👏" },
];

const DURATION: Record<SfxType, number> = { ding: 0.9, pop: 0.22, whoosh: 0.7, drumroll: 1.2, suspense: 1.6, applause: 1.8 };
const cache = new Map<SfxType, Uint8Array>();

export function sfxDuration(type: SfxType): number {
  return DURATION[type];
}

function noiseBuffer(ctx: OfflineAudioContext, dur: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * dur)), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function build(type: SfxType, ctx: OfflineAudioContext) {
  const out = ctx.destination;
  const dur = DURATION[type];
  if (type === "ding" || type === "pop") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const g = ctx.createGain();
    if (type === "ding") {
      osc.frequency.setValueAtTime(988, 0);
      osc.frequency.exponentialRampToValueAtTime(660, dur);
    } else {
      osc.frequency.setValueAtTime(420, 0);
      osc.frequency.exponentialRampToValueAtTime(900, dur);
    }
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(0.7, 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, dur);
    osc.connect(g).connect(out);
    osc.start(0);
    osc.stop(dur);
    return;
  }
  if (type === "whoosh") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(250, 0);
    bp.frequency.exponentialRampToValueAtTime(3200, dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.linearRampToValueAtTime(0.55, dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, dur);
    src.connect(bp).connect(g).connect(out);
    src.start(0);
    return;
  }
  if (type === "drumroll") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    // tremolo acelerando → rufar
    let t = 0;
    let rate = 0.05;
    g.gain.setValueAtTime(0, 0);
    while (t < dur - 0.05) {
      g.gain.setValueAtTime(0.5, t);
      g.gain.linearRampToValueAtTime(0.05, t + rate * 0.8);
      t += rate;
      rate = Math.max(0.018, rate * 0.92);
    }
    g.gain.linearRampToValueAtTime(0.8, dur - 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, dur);
    src.connect(bp).connect(g).connect(out);
    src.start(0);
    return;
  }
  if (type === "suspense") {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(70, 0);
    osc.frequency.linearRampToValueAtTime(180, dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.linearRampToValueAtTime(0.5, dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, dur);
    osc.connect(lp).connect(g).connect(out);
    osc.start(0);
    osc.stop(dur);
    return;
  }
  // applause — ruído modulado em amplitude (mãos batendo)
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 4500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.linearRampToValueAtTime(0.5, 0.15);
  let t = 0.15;
  while (t < dur - 0.2) {
    g.gain.linearRampToValueAtTime(0.18 + Math.random() * 0.35, t);
    t += 0.02 + Math.random() * 0.03;
  }
  g.gain.linearRampToValueAtTime(0.0001, dur);
  src.connect(lp).connect(g).connect(out);
  src.start(0);
}

function encodeWav(buf: AudioBuffer): Uint8Array {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const n = data.length;
  const ab = new ArrayBuffer(44 + n * 2);
  const view = new DataView(ab);
  const wstr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); view.setUint32(4, 36 + n * 2, true); wstr(8, "WAVE");
  wstr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  wstr(36, "data"); view.setUint32(40, n * 2, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(ab);
}

/** Renderiza o SFX e devolve bytes WAV (cacheado). */
export async function synthSfx(type: SfxType): Promise<Uint8Array> {
  const c = cache.get(type);
  if (c) return c;
  const sr = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(sr * DURATION[type]), sr);
  build(type, ctx);
  const rendered = await ctx.startRendering();
  const wav = encodeWav(rendered);
  cache.set(type, wav);
  return wav;
}

/** Toca o SFX agora (pré-escuta na timeline). */
export async function playSfx(type: SfxType): Promise<void> {
  const wav = await synthSfx(type);
  const blob = new Blob([wav as BlobPart], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  a.onended = () => URL.revokeObjectURL(url);
  await a.play().catch(() => URL.revokeObjectURL(url));
}

// ───────────────────────── Trilha sonora adaptativa ─────────────────────────
// "Beds" são pads sintetizados, com fade in/out, pensados para correr embaixo
// das falas conforme a FASE do debate. Sem assets externos — Web Audio puro.

export type BedType = "bed_intro" | "bed_tension" | "bed_reflective" | "bed_verdict";

interface BedPreset {
  freqs: number[];
  oscType: OscillatorType;
  lp: number;
  trem?: number;
  master: number;
}

const BED_PRESETS: Record<BedType, BedPreset> = {
  bed_intro: { freqs: [196.0, 261.63, 329.63, 392.0], oscType: "sine", lp: 2000, master: 0.32 },
  bed_tension: { freqs: [110.0, 164.81, 220.0], oscType: "sawtooth", lp: 700, trem: 5.5, master: 0.28 },
  bed_reflective: { freqs: [174.61, 220.0, 261.63, 349.23], oscType: "triangle", lp: 1500, master: 0.30 },
  bed_verdict: { freqs: [98.0, 130.81, 196.0, 246.94], oscType: "sine", lp: 1100, master: 0.34 },
};

const bedCache = new Map<string, Uint8Array>();

function buildBed(type: BedType, ctx: OfflineAudioContext, dur: number) {
  const out = ctx.destination;
  const preset = BED_PRESETS[type];
  const master = ctx.createGain();
  master.gain.value = preset.master;
  master.connect(out);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = preset.lp;
  lp.connect(master);

  const fade = Math.min(1.5, dur * 0.25);
  for (const f of preset.freqs) {
    const o = ctx.createOscillator();
    o.type = preset.oscType;
    o.frequency.value = f * (0.997 + Math.random() * 0.006);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.linearRampToValueAtTime(0.20, fade);
    g.gain.setValueAtTime(0.20, Math.max(fade, dur - fade));
    g.gain.linearRampToValueAtTime(0.0001, dur);
    o.connect(g).connect(lp);
    o.start(0);
    o.stop(dur);
  }

  if (preset.trem) {
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = preset.trem;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain).connect(master.gain);
    lfo.start(0);
    lfo.stop(dur);
  }
}

/** Renderiza um pad do tamanho pedido (cache por type+dur). */
export async function synthBed(type: BedType, durationSec: number): Promise<Uint8Array> {
  const dur = Math.max(2, Math.min(180, Math.ceil(durationSec)));
  const key = `${type}:${dur}`;
  const c = bedCache.get(key);
  if (c) return c;
  const sr = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
  buildBed(type, ctx, dur);
  const rendered = await ctx.startRendering();
  const wav = encodeWav(rendered);
  bedCache.set(key, wav);
  return wav;
}

