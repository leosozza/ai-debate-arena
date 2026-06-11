import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  className?: string;
  controls?: boolean;
  /** Quanto pular do início (segundos) — onde a foto ainda está nítida. */
  skipSeconds?: number;
  /** Duração do intro de luz (ms) que cobre o salto inicial. */
  introMs?: number;
}

/**
 * Player de vinheta de persona: começa preto com um pulso de luz crescendo
 * do centro (a "ativação do portal"), e só revela o vídeo quando a persona
 * já está materializando — escondendo o primeiro frame (foto realista) do
 * modelo i2v.
 */
export function PersonaVignettePlayer({
  src,
  className = "",
  controls = true,
  skipSeconds = 0.8,
  introMs = 1100,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      try { v.currentTime = Math.min(skipSeconds, Math.max(0, (v.duration || 2) - 1)); } catch { /* ignore */ }
    };
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [src, skipSeconds]);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), introMs);
    return () => clearTimeout(t);
  }, [src, introMs]);

  return (
    <div className={`relative overflow-hidden rounded-md border border-border bg-black ${className}`}>
      <video
        ref={videoRef}
        src={src}
        controls={controls}
        playsInline
        className={`w-full h-full transition-opacity duration-500 ${revealed ? "opacity-100" : "opacity-0"}`}
      />
      {/* Intro: pulso de luz cyan */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${revealed ? "opacity-0" : "opacity-100"}`}
        aria-hidden
      >
        <div className="absolute inset-0 bg-black" />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 12,
            height: 12,
            background: "oklch(0.85 0.18 235)",
            boxShadow: "0 0 60px 20px oklch(0.74 0.22 235 / 0.9), 0 0 160px 80px oklch(0.62 0.205 235 / 0.5)",
            animation: `vignetteBurst ${introMs}ms ease-out forwards`,
          }}
        />
      </div>
      <style>{`
        @keyframes vignetteBurst {
          0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
          25%  { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(14); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
