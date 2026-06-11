/**
 * HologramAvatar — "Holographic Summoning"
 *
 * Renders a persona's portrait as a holographic projection rising from a
 * portal platform (the Legends Arena identity). 2D-photo first, CSS-only —
 * no WebGL per avatar (they appear in lists and on the stage; a Canvas each
 * would be wasteful). Tone ties to the duel palette: blue = side A, gold = B.
 */
type Tone = "blue" | "gold" | "neutral";

const TONES: Record<Tone, { core: string; glow: string }> = {
  blue: { core: "oklch(0.74 0.15 235)", glow: "oklch(0.70 0.19 235)" },
  gold: { core: "oklch(0.80 0.14 78)", glow: "oklch(0.78 0.16 68)" },
  neutral: { core: "oklch(0.70 0.18 280)", glow: "oklch(0.62 0.205 277)" },
};

// Máscara radial: a figura emerge do escuro em todas as bordas (etéreo),
// e o terço inferior some pra "subir" da plataforma-portal.
const MASK = "radial-gradient(118% 96% at 50% 34%, #000 44%, rgba(0,0,0,0.35) 72%, transparent 90%)";

export function HologramAvatar({
  src,
  name,
  tone = "blue",
  size = 128,
  speaking = false,
  className = "",
}: {
  src?: string | null;
  name?: string;
  tone?: Tone;
  size?: number;
  speaking?: boolean;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div className={`relative inline-flex flex-col items-center ${className}`} style={{ width: size }}>
      {/* Projection */}
      <div
        className="relative w-full animate-[holo-flicker_6s_ease-in-out_infinite]"
        style={{
          aspectRatio: "1 / 1.08",
          filter: `drop-shadow(0 0 ${Math.round(size * (speaking ? 0.26 : 0.16))}px ${t.glow})`,
          transition: "filter 0.4s ease",
        }}
      >
        {src ? (
          <>
            <img
              src={src}
              alt={name ?? ""}
              className="absolute inset-0 h-full w-full object-cover object-top"
              style={{ filter: "grayscale(1) contrast(1.12) brightness(1.08)", maskImage: MASK, WebkitMaskImage: MASK }}
            />
            <div className="absolute inset-0" style={{ background: t.core, mixBlendMode: "color", maskImage: MASK, WebkitMaskImage: MASK }} />
            <div className="absolute inset-0 opacity-50" style={{ background: t.glow, mixBlendMode: "overlay", maskImage: MASK, WebkitMaskImage: MASK }} />
            <div className="holo-scanlines absolute inset-0 opacity-70 mix-blend-overlay" style={{ maskImage: MASK, WebkitMaskImage: MASK }} />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ color: t.core, filter: `drop-shadow(0 0 12px ${t.glow})` }}>
            <span className="font-display text-5xl font-extrabold">?</span>
          </div>
        )}
      </div>

      {/* Portal platform */}
      <div className="relative -mt-1 h-5 w-full">
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2"
          style={{ width: "62%", height: size * 0.5, background: `radial-gradient(ellipse at bottom, ${t.glow} 0%, transparent 70%)`, opacity: speaking ? 0.5 : 0.32 }}
        />
        <div
          className="absolute bottom-1 left-1/2 h-3 rounded-[50%] animate-[portal-pulse_3s_ease-in-out_infinite]"
          style={{ width: "82%", border: `1px solid ${t.core}`, boxShadow: `0 0 16px ${t.glow}, inset 0 0 12px ${t.glow}` }}
        />
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 rounded-[50%]" style={{ width: "52%", background: t.glow, filter: "blur(3px)" }} />
      </div>
    </div>
  );
}
