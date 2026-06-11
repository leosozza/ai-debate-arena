import { cn } from "@/lib/utils";

// Emblema auto-contido (SVG) — o portal de invocação do banner: anéis com
// split azul→dourado e o "?" central. Sem dependência de imagem (não quebra).
const SIZES = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-20 w-20",
  xl: "h-40 w-40 md:h-56 md:w-56",
} as const;

interface Props {
  size?: keyof typeof SIZES;
  className?: string;
  alt?: string;
}

export function LegendsLogo({ size = "md", className, alt = "Legends Arena" }: Props) {
  return (
    <div className={cn(SIZES[size], "relative shrink-0", className)} role="img" aria-label={alt}>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="la-split" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.72 0.16 232)" />
            <stop offset="46%" stopColor="oklch(0.9 0.05 210)" />
            <stop offset="54%" stopColor="oklch(0.9 0.06 95)" />
            <stop offset="100%" stopColor="oklch(0.8 0.15 78)" />
          </linearGradient>
          <radialGradient id="la-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.85 0.1 200 / 0.55)" />
            <stop offset="60%" stopColor="oklch(0.7 0.12 120 / 0.18)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        <circle cx="50" cy="50" r="50" fill="url(#la-glow)" />
        {/* anéis do portal */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#la-split)" strokeWidth="2.2" opacity="0.95" />
        <circle cx="50" cy="50" r="37" fill="none" stroke="url(#la-split)" strokeWidth="1.4" opacity="0.6">
          <animate attributeName="opacity" values="0.6;0.95;0.6" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="50" cy="50" r="29" fill="none" stroke="url(#la-split)" strokeWidth="1" opacity="0.4" />

        {/* "?" central */}
        <text
          x="50"
          y="53"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-display), Outfit, sans-serif"
          fontWeight="800"
          fontSize="46"
          fill="url(#la-split)"
          style={{ filter: "drop-shadow(0 0 6px oklch(0.8 0.12 200 / 0.5))" }}
        >
          ?
        </text>
      </svg>
    </div>
  );
}

/** Wordmark "LEGENDS ARENA" — prata metálico + dourado, como o banner. */
export function LegendsWordmark({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <div className={cn("font-display font-extrabold leading-[0.9] text-center tracking-tight select-none", className)}>
      <span
        className="block bg-gradient-to-b from-slate-100 via-slate-300 to-slate-500 bg-clip-text text-transparent"
        style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6)) drop-shadow(0 0 14px oklch(0.72 0.15 230 / 0.35))" }}
      >
        LEGENDS
      </span>
      <span
        className="block text-[0.42em] font-bold tracking-[0.34em] bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent"
        style={{ filter: "drop-shadow(0 0 10px oklch(0.8 0.15 78 / 0.4))" }}
      >
        ARENA
      </span>
      {tagline && (
        <span className="block mt-2 text-[0.13em] font-semibold tracking-[0.45em] text-muted-foreground">
          GREAT MINDS · ONE ARENA
        </span>
      )}
    </div>
  );
}
