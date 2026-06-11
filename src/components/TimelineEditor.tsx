import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play,
  Pause,
  Music2,
  Captions,
  Mic2,
  Film,
  Loader2,
  Magnet,
  GripHorizontal,
  Eye,
} from "lucide-react";

export interface TimelineClip {
  id: string;
  role: "moderator" | "a" | "b";
  phase: string;
  content: string;
  audioUrl: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  subtitle: boolean;
}

export interface TimelineMusic {
  enabled: boolean;
  url: string;
  volume: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialClips: TimelineClip[];
  musicUrl: string;
  onExport: (clips: TimelineClip[], music: TimelineMusic) => Promise<void>;
  progress: { label: string; pct: number } | null;
}

const PX_PER_SEC = 40;
const TRACK_H = 56;
const PREVIEW_WINDOW = 1.2; // seconds played around a trim edit

const COLORS: Record<TimelineClip["role"], string> = {
  moderator: "hsl(262 83% 65%)",
  a: "hsl(189 94% 50%)",
  b: "hsl(38 92% 55%)",
};

const SNAP_OPTIONS: { value: string; label: string; seconds: number }[] = [
  { value: "off", label: "Sem snap", seconds: 0 },
  { value: "frame30", label: "1 frame (30fps)", seconds: 1 / 30 },
  { value: "frame24", label: "1 frame (24fps)", seconds: 1 / 24 },
  { value: "0.1", label: "0,1s", seconds: 0.1 },
  { value: "0.25", label: "0,25s", seconds: 0.25 },
  { value: "0.5", label: "0,5s", seconds: 0.5 },
  { value: "1", label: "1s", seconds: 1 },
];

export function TimelineEditor({ open, onOpenChange, initialClips, musicUrl, onExport, progress }: Props) {
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [music, setMusic] = useState<TimelineMusic>({ enabled: true, url: musicUrl, volume: 0.25 });
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [snapKey, setSnapKey] = useState<string>("0.25");
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragSrcIdxRef = useRef<number | null>(null);

  const snap = SNAP_OPTIONS.find((o) => o.value === snapKey)?.seconds ?? 0;

  useEffect(() => {
    if (open) setClips(initialClips);
  }, [open, initialClips]);

  const segs = useMemo(() => {
    let t = 0;
    return clips.map((c) => {
      const eff = Math.max(0.2, c.duration - c.trimStart - c.trimEnd);
      const seg = { id: c.id, start: t, eff };
      t += eff;
      return seg;
    });
  }, [clips]);
  const totalSec = segs.reduce((a, s) => a + s.eff, 0);

  function updateClip(id: string, patch: Partial<TimelineClip>) {
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function quantize(v: number) {
    if (snap <= 0) return v;
    return Math.round(v / snap) * snap;
  }

  function play(c: TimelineClip, fromSec?: number, untilSec?: number) {
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(c.audioUrl);
    const start = fromSec ?? c.trimStart;
    const stop = untilSec ?? c.duration - c.trimEnd;
    a.currentTime = start;
    audioRef.current = a;
    setPlayingId(c.id);
    const tick = () => {
      if (a.currentTime >= stop) {
        a.pause();
        setPlayingId(null);
      }
    };
    a.addEventListener("timeupdate", tick);
    a.addEventListener("ended", () => setPlayingId(null));
    a.play().catch(() => setPlayingId(null));
  }
  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }
  useEffect(() => () => audioRef.current?.pause(), []);

  /** Preview a short window around the new trim edge. */
  function previewEdge(c: TimelineClip, side: "left" | "right") {
    const w = PREVIEW_WINDOW;
    if (side === "left") {
      const s = c.trimStart;
      const e = Math.min(c.duration - c.trimEnd, s + w);
      play(c, s, e);
    } else {
      const e = c.duration - c.trimEnd;
      const s = Math.max(c.trimStart, e - w);
      play(c, s, e);
    }
  }

  function reorder(from: number, to: number) {
    if (from === to || to < 0 || to >= clips.length) return;
    setClips((cs) => {
      const next = cs.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }

  const ticks = useMemo(() => {
    const arr: number[] = [];
    const step = snap > 0 && snap <= 1 ? Math.max(1, Math.round(1 / Math.max(snap, 0.1))) : 5;
    const interval = Math.max(1, Math.round(5 / Math.max(1, step)) || 5);
    for (let s = 0; s <= Math.ceil(totalSec); s += Math.max(1, interval)) arr.push(s);
    return arr;
  }, [totalSec, snap]);

  // sub-grid lines aligned to snap
  const gridLines = useMemo(() => {
    if (snap <= 0 || snap > 1) return [];
    const arr: number[] = [];
    for (let s = 0; s <= totalSec + 0.0001; s += snap) arr.push(s);
    return arr.slice(0, 2000);
  }, [snap, totalSec]);

  const busy = progress !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Editor de timeline</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Top controls */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Magnet className="h-4 w-4 text-primary" />
              <Label className="text-xs">Snap</Label>
              <Select value={snapKey} onValueChange={setSnapKey}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SNAP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Music2 className="h-4 w-4 text-primary" />
              <Label htmlFor="mus" className="text-xs">Música</Label>
              <Switch id="mus" checked={music.enabled} onCheckedChange={(v) => setMusic((m) => ({ ...m, enabled: v }))} />
            </div>
            <div className="flex items-center gap-2 min-w-[200px] flex-1">
              <span className="text-xs text-muted-foreground w-14">Volume</span>
              <Slider
                value={[Math.round(music.volume * 100)]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => setMusic((m) => ({ ...m, volume: (v[0] ?? 0) / 100 }))}
                disabled={!music.enabled}
              />
              <span className="tabular-nums text-xs w-8 text-right">{Math.round(music.volume * 100)}%</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Total: <span className="tabular-nums font-medium text-foreground">{fmt(totalSec)}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border overflow-x-auto bg-muted/20">
            <div className="min-w-full relative" style={{ width: Math.max(800, totalSec * PX_PER_SEC + 160) }}>
              {/* Grid overlay */}
              {gridLines.length > 0 && (
                <div className="pointer-events-none absolute left-0 right-0 top-6 bottom-0 z-0">
                  {gridLines.map((s, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px bg-foreground/5"
                      style={{ left: 120 + s * PX_PER_SEC }}
                    />
                  ))}
                </div>
              )}

              {/* Ruler */}
              <div className="relative h-6 border-b bg-background/60 z-10">
                {ticks.map((s) => (
                  <div key={s} className="absolute top-0 h-full flex flex-col items-start" style={{ left: 120 + s * PX_PER_SEC }}>
                    <div className="w-px h-2 bg-border" />
                    <span className="text-[10px] text-muted-foreground ml-0.5">{fmt(s)}</span>
                  </div>
                ))}
              </div>

              {/* Voice track */}
              <TrackRow icon={<Mic2 className="h-3.5 w-3.5" />} label="VOZ">
                {clips.map((c, i) => {
                  const seg = segs[i];
                  const isOver = dragOverIdx === i;
                  return (
                    <ClipBlock
                      key={c.id}
                      left={120 + seg.start * PX_PER_SEC}
                      width={seg.eff * PX_PER_SEC}
                      color={COLORS[c.role]}
                      label={`${labelFor(c.role)} · ${fmt(seg.eff)}`}
                      playing={playingId === c.id}
                      isDropTarget={isOver}
                      onPlay={() => (playingId === c.id ? stop() : play(c))}
                      onPreviewLeft={() => previewEdge(c, "left")}
                      onPreviewRight={() => previewEdge(c, "right")}
                      onTrimLeft={(deltaPx) => {
                        const raw = c.trimStart + deltaPx / PX_PER_SEC;
                        const q = quantize(raw);
                        const newStart = clamp(q, 0, c.duration - c.trimEnd - 0.2);
                        if (newStart !== c.trimStart) updateClip(c.id, { trimStart: newStart });
                      }}
                      onTrimRight={(deltaPx) => {
                        const raw = c.trimEnd + -deltaPx / PX_PER_SEC;
                        const q = quantize(raw);
                        const newEnd = clamp(q, 0, c.duration - c.trimStart - 0.2);
                        if (newEnd !== c.trimEnd) updateClip(c.id, { trimEnd: newEnd });
                      }}
                      onTrimEndCommit={(side) => previewEdge(c, side)}
                      onDragStart={() => (dragSrcIdxRef.current = i)}
                      onDragOver={() => setDragOverIdx(i)}
                      onDragEnd={() => {
                        const from = dragSrcIdxRef.current;
                        const to = dragOverIdx;
                        dragSrcIdxRef.current = null;
                        setDragOverIdx(null);
                        if (from != null && to != null) reorder(from, to);
                      }}
                    />
                  );
                })}
              </TrackRow>

              {/* Music track */}
              <TrackRow icon={<Music2 className="h-3.5 w-3.5" />} label="MÚSICA">
                {music.enabled && totalSec > 0 && (
                  <div
                    className="absolute top-2 bottom-2 rounded-md border border-primary/40 bg-primary/15"
                    style={{ left: 120, width: totalSec * PX_PER_SEC }}
                  >
                    <div className="px-2 py-1 text-[10px] text-primary truncate">
                      🎵 trilha · {Math.round(music.volume * 100)}%
                    </div>
                  </div>
                )}
              </TrackRow>

              {/* Subtitle track */}
              <TrackRow icon={<Captions className="h-3.5 w-3.5" />} label="LEGENDA">
                {clips.map((c, i) => {
                  const seg = segs[i];
                  return (
                    <div
                      key={c.id}
                      className={`absolute top-2 bottom-2 rounded-md border text-[10px] px-2 py-1 truncate cursor-pointer transition ${
                        c.subtitle
                          ? "border-foreground/30 bg-foreground/10 text-foreground/90"
                          : "border-dashed border-muted-foreground/30 bg-transparent text-muted-foreground/60"
                      }`}
                      style={{ left: 120 + seg.start * PX_PER_SEC, width: seg.eff * PX_PER_SEC }}
                      onClick={() => updateClip(c.id, { subtitle: !c.subtitle })}
                      title="Clique para alternar legenda"
                    >
                      {c.subtitle ? "CC " : "—  "}
                      {c.content.slice(0, 80)}
                    </div>
                  );
                })}
              </TrackRow>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <Magnet className="inline h-3 w-3 mr-1" />Snap em <b>{SNAP_OPTIONS.find((o) => o.value === snapKey)?.label}</b>.
            Arraste as bordas para cortar (pré-escuta automática do trecho ao soltar).
            Use a alça <GripHorizontal className="inline h-3 w-3" /> no centro para reordenar falas.
            Clique <Eye className="inline h-3 w-3" /> para pré-ouvir a borda novamente.
          </p>

          {progress && (
            <div>
              <Progress value={Math.round(progress.pct * 100)} className="h-1.5" />
              <div className="text-xs text-muted-foreground mt-1">{progress.label}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => onExport(clips, music)} disabled={busy || clips.length === 0}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Film className="h-4 w-4 mr-1" />}
            {busy ? "Exportando…" : "Exportar MP4"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── helpers ── */

function TrackRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="relative border-b last:border-b-0 z-10" style={{ height: TRACK_H }}>
      <div className="absolute left-0 top-0 bottom-0 w-[120px] border-r bg-background/80 px-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground z-20">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function ClipBlock({
  left,
  width,
  color,
  label,
  playing,
  isDropTarget,
  onPlay,
  onPreviewLeft,
  onPreviewRight,
  onTrimLeft,
  onTrimRight,
  onTrimEndCommit,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  left: number;
  width: number;
  color: string;
  label: string;
  playing: boolean;
  isDropTarget: boolean;
  onPlay: () => void;
  onPreviewLeft: () => void;
  onPreviewRight: () => void;
  onTrimLeft: (deltaPx: number) => void;
  onTrimRight: (deltaPx: number) => void;
  onTrimEndCommit: (side: "left" | "right") => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}) {
  function startTrim(e: React.PointerEvent, side: "left" | "right", cb: (delta: number) => void) {
    e.stopPropagation();
    e.preventDefault();
    let lastX = e.clientX;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - lastX;
      lastX = ev.clientX;
      cb(dx);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onTrimEndCommit(side);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
      className={`absolute top-2 bottom-2 rounded-md flex items-center overflow-hidden select-none group shadow-sm transition ${
        isDropTarget ? "ring-2 ring-foreground/60" : ""
      }`}
      style={{ left, width: Math.max(20, width), backgroundColor: color, opacity: 0.92 }}
    >
      <div
        className="h-full w-2 cursor-ew-resize bg-black/30 hover:bg-black/50 transition"
        onPointerDown={(e) => startTrim(e, "left", onTrimLeft)}
        title="Arraste para cortar início (snap ativo)"
      />
      <button
        className="px-1 text-black/70 hover:text-black"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onPreviewLeft();
        }}
        title="Pré-ouvir início"
      >
        <Eye className="h-3 w-3" />
      </button>
      <button
        className="flex-1 h-full px-1 text-left text-[11px] font-semibold text-black/85 truncate hover:bg-black/10"
        onClick={onPlay}
      >
        {playing ? <Pause className="inline h-3 w-3 mr-1" /> : <Play className="inline h-3 w-3 mr-1" />}
        {label}
      </button>
      <span
        className="px-1 text-black/60 cursor-grab active:cursor-grabbing"
        title="Arraste para reordenar"
      >
        <GripHorizontal className="h-3.5 w-3.5" />
      </span>
      <button
        className="px-1 text-black/70 hover:text-black"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onPreviewRight();
        }}
        title="Pré-ouvir fim"
      >
        <Eye className="h-3 w-3" />
      </button>
      <div
        className="h-full w-2 cursor-ew-resize bg-black/30 hover:bg-black/50 transition"
        onPointerDown={(e) => startTrim(e, "right", onTrimRight)}
        title="Arraste para cortar fim (snap ativo)"
      />
    </div>
  );
}

function labelFor(role: TimelineClip["role"]) {
  return role === "a" ? "Lado A" : role === "b" ? "Lado B" : "Mediador";
}
function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
