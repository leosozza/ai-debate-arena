import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Volume2, VolumeX } from "lucide-react";
import { LegendsLogo } from "./LegendsLogo";
import musicAsset from "@/assets/legends-opening.mp3.asset.json";

interface Props {
  topic: string;
  onDone: () => void;
  /** Whether the audio element was primed inside a user gesture upstream. */
  audioPrimed?: boolean;
  /** Shorter sequence (~3.8s) for when narration starts right after. */
  compact?: boolean;
}

/** Cinematic news-broadcast intro: scanlines → particles → flash → logo → topic reveal. */
export function OpeningVignette({ topic, onDone, audioPrimed = false, compact = false }: Props) {
  const TOTAL_MS = compact ? 3800 : 8200;
  const LOGO_AT = compact ? 600 : 1800;
  const TOPIC_AT = compact ? 1500 : 3800;
  const [muted, setMuted] = useState(false);
  const [stage, setStage] = useState(0); // 0 boot, 1 logo, 2 topic, 3 fade out
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Choreography
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), LOGO_AT); // logo in
    const t2 = setTimeout(() => setStage(2), TOPIC_AT); // topic in
    const t3 = setTimeout(() => setStage(3), TOTAL_MS - 500); // fade out
    const t4 = setTimeout(() => onDone(), TOTAL_MS);
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, [onDone, LOGO_AT, TOPIC_AT, TOTAL_MS]);

  // Audio
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0;
    a.muted = muted;
    a.play().catch(() => { /* autoplay blocked — silent vignette */ });
    // fade in
    const fadeIn = setInterval(() => {
      if (!a) return;
      if (a.volume < 0.85) a.volume = Math.min(0.85, a.volume + 0.07);
      else clearInterval(fadeIn);
    }, 60);
    // fade out near end
    const fadeOutAt = setTimeout(() => {
      const fadeOut = setInterval(() => {
        if (!a) return;
        if (a.volume > 0.04) a.volume = Math.max(0, a.volume - 0.08);
        else { a.pause(); clearInterval(fadeOut); }
      }, 60);
    }, TOTAL_MS - 900);
    return () => { clearInterval(fadeIn); clearTimeout(fadeOutAt); try { a.pause(); } catch { /* ignore */ } };
  }, [muted, TOTAL_MS]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const letters = "LEGENDS ARENA".split("");

  return (
    <div
      className={`fixed inset-0 z-[60] overflow-hidden bg-black text-foreground transition-opacity duration-500 ${stage === 3 ? "opacity-0" : "opacity-100"}`}
    >
      <audio ref={audioRef} src={musicAsset.url} preload="auto" playsInline {...(audioPrimed ? {} : {})} />

      {/* Controls */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => setMuted((m) => !m)} aria-label="Som">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="text-xs uppercase tracking-widest">
          <X className="h-3.5 w-3.5 mr-1" /> Pular
        </Button>
      </div>

      {/* Layer 1: deep gradient bg */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.18_0.05_264)_0%,oklch(0.05_0.02_264)_60%,#000_100%)]" />

      {/* Layer 2: scanlines sweeping across */}
      <div className="absolute inset-0 opacity-40 mix-blend-screen">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.72_0.18_221)] to-transparent animate-[scanline_2.4s_ease-out_forwards]" />
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.85_0.15_60)] to-transparent animate-[scanline_2.4s_ease-out_0.4s_forwards]" />
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.72_0.18_221)] to-transparent animate-[scanline_2.4s_ease-out_0.8s_forwards]" />
      </div>

      {/* Layer 3: particles rising */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute bottom-0 block w-1 h-1 rounded-full bg-[oklch(0.85_0.15_60)] opacity-0 animate-[particle_4s_ease-out_infinite]"
            style={{
              left: `${(i * 4.1) % 100}%`,
              animationDelay: `${(i % 8) * 0.25}s`,
              boxShadow: "0 0 8px oklch(0.85 0.15 60)",
            }}
          />
        ))}
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={`b-${i}`}
            className="absolute bottom-0 block w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.18_221)] opacity-0 animate-[particle_5s_ease-out_infinite]"
            style={{
              left: `${(i * 6.3 + 3) % 100}%`,
              animationDelay: `${(i % 6) * 0.4 + 0.2}s`,
              boxShadow: "0 0 12px oklch(0.72 0.18 221)",
            }}
          />
        ))}
      </div>

      {/* Layer 4: rotating geometric orbit */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-[600px] h-[600px] md:w-[900px] md:h-[900px] animate-[orbit_18s_linear_infinite]">
          <div className="absolute inset-0 rounded-full border border-[oklch(0.72_0.18_221/0.2)]" />
          <div className="absolute inset-[8%] rounded-full border border-[oklch(0.85_0.15_60/0.15)]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 rounded-full bg-[oklch(0.72_0.18_221)] shadow-[0_0_20px_oklch(0.72_0.18_221)]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-2 rounded-full bg-[oklch(0.85_0.15_60)] shadow-[0_0_20px_oklch(0.85_0.15_60)]" />
        </div>
      </div>

      {/* Layer 5: flash burst */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-2 h-2 rounded-full bg-white animate-[flashBurst_1.6s_ease-out_1.4s_forwards] opacity-0" />
      </div>

      {/* Layer 6: logo + kinetic typography */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className={`transition-all duration-700 ${stage >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
          <LegendsLogo size="lg" className="mb-6 mx-auto animate-[logoPulse_2s_ease-in-out_infinite]" />
        </div>

        <h1 className="font-display font-black tracking-tight flex justify-center flex-wrap gap-x-[0.05em]">
          {letters.map((ch, i) => (
            <span
              key={i}
              className="inline-block text-4xl md:text-7xl text-white opacity-0 animate-[letterReveal_0.7s_cubic-bezier(0.16,1,0.3,1)_forwards]"
              style={{
                animationDelay: `${1.9 + i * 0.06}s`,
                textShadow: "0 0 20px oklch(0.72 0.18 221 / 0.6), 0 0 40px oklch(0.72 0.18 221 / 0.3)",
              }}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </h1>

        {/* Topic reveal — masked wipe */}
        <div className={`mt-10 md:mt-14 transition-opacity duration-500 ${stage >= 2 ? "opacity-100" : "opacity-0"}`}>
          <div className="text-[10px] md:text-xs uppercase tracking-[0.5em] text-[oklch(0.85_0.15_60)] font-bold mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            Hoje no programa
          </div>
          <div className="relative inline-block overflow-hidden">
            <h2
              className={`font-display text-2xl md:text-5xl font-extrabold text-white max-w-4xl text-balance px-6 ${stage >= 2 ? "animate-[maskWipe_1.2s_cubic-bezier(0.16,1,0.3,1)_forwards]" : ""}`}
              style={{ clipPath: stage >= 2 ? undefined : "inset(0 100% 0 0)" }}
            >
              {topic}
            </h2>
          </div>
        </div>
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,#000_95%)] pointer-events-none" />

      <style>{`
        @keyframes scanline {
          0% { top: -2px; opacity: 0; }
          10% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes particle {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-110vh) scale(1.2); opacity: 0; }
        }
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes flashBurst {
          0% { transform: scale(1); opacity: 0; box-shadow: 0 0 0 0 #fff; }
          30% { opacity: 1; }
          100% { transform: scale(120); opacity: 0; box-shadow: 0 0 80px 40px #fff; }
        }
        @keyframes letterReveal {
          0% { opacity: 0; transform: translateY(20px) scale(1.4); filter: blur(8px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes maskWipe {
          0% { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes logoPulse {
          0%, 100% { filter: drop-shadow(0 0 20px oklch(0.72 0.18 221 / 0.5)); }
          50% { filter: drop-shadow(0 0 40px oklch(0.72 0.18 221 / 0.9)); }
        }
      `}</style>
    </div>
  );
}
