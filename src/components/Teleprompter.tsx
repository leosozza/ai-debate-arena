import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  /** Está falando agora? Quando true, ativa o auto-scroll. */
  active: boolean;
  /** Duração total do áudio em ms (quando conhecida). Se ausente, usa estimativa por caractere. */
  durationMs?: number | null;
  className?: string;
  /** Altura visível em rem (default 7 ≈ 4 linhas). */
  heightRem?: number;
}

/** Estima a duração em ms para uma fala em PT-BR (≈ 14 chars/seg). */
function estimateDuration(text: string): number {
  const len = Math.max(20, text.length);
  return Math.round((len / 14) * 1000);
}

/**
 * Teleprompter estilo TV: mostra o texto inteiro com rolagem automática
 * sincronizada com a fala, e destaque suave da linha "atual".
 */
export function Teleprompter({
  text,
  active,
  durationMs,
  className,
  heightRem = 7,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0); // 0..1

  // Quebra em sentenças para o highlight (mantém pontuação).
  const sentences = useMemo(() => {
    const parts = text.split(/(?<=[\.\!\?\…])\s+/).filter(Boolean);
    return parts.length ? parts : [text];
  }, [text]);

  // Reset ao mudar de texto ou ao despausar.
  useEffect(() => {
    startedAtRef.current = null;
    setProgress(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [text]);

  // Loop de animação.
  useEffect(() => {
    if (!active || !text) return;
    const total = durationMs && durationMs > 200 ? durationMs : estimateDuration(text);
    startedAtRef.current = performance.now();

    const tick = (now: number) => {
      const start = startedAtRef.current ?? now;
      const p = Math.min(1, (now - start) / total);
      setProgress(p);

      const container = containerRef.current;
      const inner = innerRef.current;
      if (container && inner) {
        const max = Math.max(0, inner.scrollHeight - container.clientHeight);
        // pequena antecipação (5%) para o olho acompanhar
        const target = Math.min(max, max * Math.min(1, p + 0.05));
        // smoothing
        const cur = container.scrollTop;
        container.scrollTop = cur + (target - cur) * 0.18;
      }

      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active, text, durationMs]);

  const activeIdx = Math.min(
    sentences.length - 1,
    Math.floor(progress * sentences.length),
  );

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg",
        className,
      )}
      style={{ height: `${heightRem}rem` }}
    >
      {/* gradientes nas bordas */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-background/90 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-background/90 to-transparent" />

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto scroll-smooth px-4 py-2 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div ref={innerRef} className="text-base md:text-xl leading-relaxed">
          {sentences.map((s, i) => (
            <span
              key={i}
              className={cn(
                "transition-colors duration-300",
                active && i === activeIdx
                  ? "text-foreground font-semibold"
                  : i < activeIdx
                  ? "text-muted-foreground/70"
                  : "text-muted-foreground",
              )}
            >
              {s}{" "}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
