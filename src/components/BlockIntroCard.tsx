import { useEffect } from "react";

type Props = {
  blockIndex: number;
  total: number;
  title: string;
  focus?: string;
  onDone: () => void;
  durationMs?: number;
};

export function BlockIntroCard({ blockIndex, total, title, focus, onDone, durationMs = 2800 }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [onDone, durationMs]);

  return (
    <button
      onClick={onDone}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[oklch(0.08_0.02_264)] text-foreground overflow-hidden cursor-pointer"
      aria-label="Pular vinheta"
    >
      {/* Faixa diagonal estilo programa de TV */}
      <div
        className="absolute inset-x-[-20%] h-40 top-1/2 -translate-y-1/2 -rotate-6 bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30 animate-in slide-in-from-left duration-700"
        aria-hidden
      />
      <div
        className="absolute inset-x-[-20%] h-1 top-[calc(50%+90px)] -translate-y-1/2 -rotate-6 bg-primary/80 animate-in slide-in-from-right duration-700"
        aria-hidden
      />

      <div className="relative z-10 text-center px-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-xs md:text-sm uppercase tracking-[0.45em] text-primary/80 mb-2 font-semibold">
          Bloco {blockIndex + 1} de {total}
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-4 text-balance">
          {title}
        </h1>
        {focus && (
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto text-balance">{focus}</p>
        )}
      </div>

      <div className="absolute bottom-8 text-xs text-muted-foreground/70 uppercase tracking-widest">
        toque para pular
      </div>
    </button>
  );
}
