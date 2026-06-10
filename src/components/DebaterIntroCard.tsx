import { Bot, Radio, X, AlertTriangle } from "lucide-react";
import { AI_DISCLAIMER_TEXT } from "./AIDisclaimer";

type Debater = {
  name: string;
  imageUrl?: string | null;
  description?: string | null;
};

type Props = {
  topic: string;
  a: Debater;
  b: Debater;
  onSkip?: () => void;
};

/**
 * Full-screen opening card in TV-debate style (Roda Viva).
 * Renders the two guests side-by-side while the mediator's opening
 * narration plays underneath via the regular TTS pipeline.
 */
export function DebaterIntroCard({ topic, a, b, onSkip }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[oklch(0.08_0.02_264)] text-foreground overflow-hidden animate-in fade-in duration-500">
      {/* Diagonal stage stripe */}
      <div
        className="absolute inset-x-[-20%] h-72 top-[42%] -translate-y-1/2 -rotate-6 bg-gradient-to-r from-primary/10 via-primary/25 to-primary/10"
        aria-hidden
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-xs md:text-sm uppercase tracking-[0.4em] text-primary font-semibold">
          <Radio className="h-4 w-4" />
          Hoje no programa
        </div>
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-xs uppercase tracking-widest text-muted-foreground/70 hover:text-foreground transition-colors flex items-center gap-1"
            aria-label="Pular apresentação"
          >
            <X className="h-3.5 w-3.5" />
            Pular
          </button>
        )}
      </div>

      {/* Topic */}
      <div className="relative z-10 px-6 text-center animate-in slide-in-from-top-2 duration-700">
        <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground text-balance max-w-5xl mx-auto">
          {topic}
        </h1>
      </div>

      {/* Two guests side-by-side */}
      <div className="relative z-10 flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-8 px-6 md:px-12 py-8 md:py-10 items-stretch">
        <GuestColumn d={a} side="a" />
        <div className="hidden md:flex items-center justify-center">
          <div className="relative flex h-full w-20 items-center justify-center">
            <div className="absolute inset-y-10 w-px bg-gradient-to-b from-transparent via-border to-transparent" aria-hidden />
            <div className="z-10 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-xs font-extrabold text-muted-foreground shadow-2xl">
              VS
            </div>
          </div>
        </div>
        <GuestColumn d={b} side="b" />
      </div>

      <div className="relative z-10 pb-4 px-6 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground/70">
        Apresentação dos convidados
      </div>

      {/* Rodapé obrigatório: aviso de simulação por IA */}
      <div className="relative z-10 border-t border-border/40 bg-background/60 px-6 py-2 text-center">
        <p className="mx-auto max-w-4xl text-[10px] md:text-xs text-muted-foreground/90 leading-snug flex items-center justify-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-primary shrink-0" />
          <span className="line-clamp-2">{AI_DISCLAIMER_TEXT}</span>
        </p>
      </div>
    </div>
  );
}

function GuestColumn({ d, side }: { d: Debater; side: "a" | "b" }) {
  const accent = side === "a" ? "text-side-a border-side-a/60" : "text-side-b border-side-b/60";
  const labelTone = side === "a" ? "text-side-a" : "text-side-b";
  const slideClass = side === "a" ? "animate-in slide-in-from-left-8 duration-700" : "animate-in slide-in-from-right-8 duration-700";

  return (
    <div className={`flex flex-col items-center text-center gap-4 md:gap-5 ${slideClass}`}>
      <div className={`relative flex h-40 w-40 md:h-56 md:w-56 items-center justify-center overflow-hidden rounded-full border-4 bg-background/60 ${accent}`}>
        <span className="absolute inset-[-10px] rounded-full border border-current opacity-30 animate-ping" />
        {d.imageUrl ? (
          <img src={d.imageUrl} alt={d.name} className="h-full w-full object-cover" />
        ) : (
          <Bot className="h-20 w-20 md:h-28 md:w-28" />
        )}
      </div>
      <div className={`text-xs font-semibold uppercase tracking-[0.32em] ${labelTone}`}>
        Convidado {side.toUpperCase()}
      </div>
      <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight text-foreground text-balance">
        {d.name}
      </h2>
      {d.description && (
        <p className="text-sm md:text-base leading-relaxed text-muted-foreground max-w-sm text-balance">
          {d.description}
        </p>
      )}
    </div>
  );
}
