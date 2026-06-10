import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Aviso obrigatório de simulação por IA.
 * Variantes:
 * - "footer": rodapé fixo discreto (presentation / preview).
 * - "card":   tela cheia, mostrada como 1ª "fala" do programa.
 * - "inline": bloco compacto em forms/exports.
 */
export const AI_DISCLAIMER_TEXT =
  "As falas, opiniões e posições atribuídas às personas neste programa são SIMULAÇÕES geradas por inteligência artificial. Não representam o pensamento real das pessoas retratadas — sejam figuras históricas, públicas ou contemporâneas. Conteúdo destinado a entretenimento, educação e debate de ideias.";

type Props = {
  variant?: "footer" | "card" | "inline";
  className?: string;
};

export function AIDisclaimer({ variant = "inline", className }: Props) {
  if (variant === "footer") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 right-0 z-20",
          "bg-gradient-to-t from-background/95 via-background/70 to-transparent",
          "px-4 pb-2 pt-6 text-center",
          className,
        )}
      >
        <p className="mx-auto max-w-3xl text-[10px] md:text-xs text-muted-foreground/90 leading-snug">
          <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5 text-primary" />
          Simulação por IA — falas não representam as pessoas reais retratadas.
        </p>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center gap-6 px-6 text-center animate-in fade-in duration-500", className)}>
        <AlertTriangle className="h-14 w-14 md:h-20 md:w-20 text-primary" />
        <div className="text-xs uppercase tracking-[0.4em] text-primary font-semibold">Aviso</div>
        <h2 className="font-display text-2xl md:text-4xl font-extrabold text-foreground max-w-3xl text-balance">
          Este programa é uma simulação por inteligência artificial
        </h2>
        <p className="text-sm md:text-lg leading-relaxed text-muted-foreground max-w-3xl text-balance">
          {AI_DISCLAIMER_TEXT}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground", className)}>
      <AlertTriangle className="h-4 w-4 shrink-0 text-primary mt-0.5" />
      <p className="leading-snug">{AI_DISCLAIMER_TEXT}</p>
    </div>
  );
}
