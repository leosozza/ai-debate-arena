import { cn } from "@/lib/utils";
import emblem from "@/assets/legends-arena-emblem.png";

const SIZES = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-24 w-24",
  xl: "h-48 w-48 md:h-64 md:w-64",
} as const;

interface Props {
  size?: keyof typeof SIZES;
  className?: string;
  alt?: string;
}

export function LegendsLogo({ size = "md", className, alt = "Legends Arena" }: Props) {
  return (
    <div className={cn(SIZES[size], "relative shrink-0", className)}>
      <img
        src={emblem}
        alt={alt}
        width={1024}
        height={1024}
        loading="lazy"
        className="h-full w-full object-contain drop-shadow-[0_0_24px_oklch(0.72_0.15_230/0.35)]"
      />
    </div>
  );
}

/** Wordmark "LEGENDS ARENA" — prata metálico + dourado. */
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
