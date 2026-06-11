import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, Music2, Captions, Mic2, Film, Loader2 } from "lucide-react";

export interface TimelineClip {
  id: string;
  role: "moderator" | "a" | "b";
  phase: string;
  content: string;
  audioUrl: string;
  /** raw audio duration in seconds */
  duration: number;
  /** seconds trimmed from start (0..duration) */
  trimStart: number;
  /** seconds trimmed from end (0..duration) */
  trimEnd: number;
  /** include subtitle in export */
  subtitle: boolean;
}

export interface TimelineMusic {
  enabled: boolean;
  url: string;
  volume: number; // 0..1
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialClips: TimelineClip[];
  musicUrl: string;
  onExport: (clips: TimelineClip[], music: TimelineMusic) => Promise<void>;
  /** export progress (0..1) and label; null means idle */
  progress: { label: string; pct: number } | null;
}

const PX_PER_SEC = 40;
const TRACK_H = 56;

const COLORS: Record<TimelineClip["role"], string> = {
  moderator: "hsl(262 83% 65%)",
  a: "hsl(189 94% 50%)",
  b: "hsl(38 92% 55%)",
};

export function TimelineEditor({ open, onOpenChange, initialClips, musicUrl, onExport, progress }: Props) {
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [music, setMusic] = useState<TimelineMusic>({ enabled: true, url: musicUrl, volume: 0.25 });
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open) {
      setClips(initialClips);
    }
  }, [open, initialClips]);

  // cumulative effective duration
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

  function play(c: TimelineClip) {
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(c.audioUrl);
    a.currentTime = c.trimStart;
    audioRef.current = a;
    setPlayingId(c.id);
    const stopAt = c.duration - c.trimEnd;
    const tick = () => {
      if (a.currentTime >= stopAt) {
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

  // ruler ticks every 5s
  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let s = 0; s <= Math.ceil(totalSec); s += 5) arr.push(s);
    return arr;
  }, [totalSec]);

  const busy = progress !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Editor de timeline</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Music controls */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Music2 className="h-4 w-4 text-primary" />
              <Label htmlFor="mus">Música de fundo</Label>
              <Switch id="mus" checked={music.enabled} onCheckedChange={(v) => setMusic((m) => ({ ...m, enabled: v }))} />
            </div>
            <div className="flex items-center gap-2 min-w-[220px] flex-1">
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
              Duração total: <span className="tabular-nums font-medium text-foreground">{fmt(totalSec)}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border overflow-x-auto bg-muted/20">
            <div className="min-w-full" style={{ width: Math.max(800, totalSec * PX_PER_SEC + 160) }}>
              {/* Ruler */}
              <div className="relative h-6 border-b bg-background/60">
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
                  return (
                    <ClipBlock
                      key={c.id}
                      left={120 + seg.start * PX_PER_SEC}
                      width={seg.eff * PX_PER_SEC}
                      color={COLORS[c.role]}
                      label={`${labelFor(c.role)} · ${fmt(seg.eff)}`}
                      playing={playingId === c.id}
                      onPlay={() => (playingId === c.id ? stop() : play(c))}
                      onTrimLeft={(deltaPx) => {
                        const delta = deltaPx / PX_PER_SEC;
                        const newStart = clamp(c.trimStart + delta, 0, c.duration - c.trimEnd - 0.2);
                        updateClip(c.id, { trimStart: newStart });
                      }}
                      onTrimRight={(deltaPx) => {
                        const delta = -deltaPx / PX_PER_SEC;
                        const newEnd = clamp(c.trimEnd + delta, 0, c.duration - c.trimStart - 0.2);
                        updateClip(c.id, { trimEnd: newEnd });
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
            Arraste as bordas dos blocos de voz para cortar início/fim. Clique no bloco da legenda para ligar/desligar.
            Use ▶ para pré-ouvir só o trecho selecionado.
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
    <div className="relative border-b last:border-b-0" style={{ height: TRACK_H }}>
      <div className="absolute left-0 top-0 bottom-0 w-[120px] border-r bg-background/60 px-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground">
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
  onPlay,
  onTrimLeft,
  onTrimRight,
}: {
  left: number;
  width: number;
  color: string;
  label: string;
  playing: boolean;
  onPlay: () => void;
  onTrimLeft: (deltaPx: number) => void;
  onTrimRight: (deltaPx: number) => void;
}) {
  function startDrag(e: React.PointerEvent, cb: (delta: number) => void) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    let lastX = startX;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - lastX;
      lastX = ev.clientX;
      cb(dx);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      className="absolute top-2 bottom-2 rounded-md flex items-center overflow-hidden select-none group shadow-sm"
      style={{ left, width: Math.max(20, width), backgroundColor: color, opacity: 0.92 }}
    >
      {/* left handle */}
      <div
        className="h-full w-2 cursor-ew-resize bg-black/30 hover:bg-black/50 transition"
        onPointerDown={(e) => startDrag(e, onTrimLeft)}
        title="Arraste para cortar início"
      />
      <button
        className="flex-1 h-full px-2 text-left text-[11px] font-semibold text-black/85 truncate hover:bg-black/10"
        onClick={onPlay}
      >
        {playing ? <Pause className="inline h-3 w-3 mr-1" /> : <Play className="inline h-3 w-3 mr-1" />}
        {label}
      </button>
      {/* right handle */}
      <div
        className="h-full w-2 cursor-ew-resize bg-black/30 hover:bg-black/50 transition"
        onPointerDown={(e) => startDrag(e, onTrimRight)}
        title="Arraste para cortar fim"
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
