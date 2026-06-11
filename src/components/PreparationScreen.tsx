import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";

type Task = { label: string; done: number; total: number; status: "idle" | "running" | "done" | "error"; message?: string };

interface Props {
  tasks: Task[];
  onSkip: () => void;
  canSkip: boolean;
}

export function PreparationScreen({ tasks, onSkip, canSkip }: Props) {
  const allDone = tasks.every((t) => t.status === "done" || t.status === "error");
  return (
    <div className="fixed inset-0 z-[58] bg-[oklch(0.08_0.02_264)] text-foreground flex flex-col items-center justify-center px-6">
      <div className="absolute inset-0 bg-[radial-gradient(80rem_55rem_at_50%_-10%,oklch(0.62_0.205_277_/_0.18),transparent_55%)] pointer-events-none" />
      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Sparkles className="h-10 w-10 mx-auto text-primary animate-pulse" />
          <h2 className="font-display text-2xl md:text-3xl font-extrabold">Preparando o programa…</h2>
          <p className="text-sm text-muted-foreground">
            Gerando vozes e vinhetas para uma transmissão sem cortes.
          </p>
        </div>

        <div className="space-y-3">
          {tasks.map((t, i) => {
            const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : t.status === "done" ? 100 : 0;
            return (
              <div key={i} className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium flex items-center gap-2">
                    {t.status === "done" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    ) : t.status === "running" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : t.status === "error" ? (
                      <span className="h-3.5 w-3.5 rounded-full bg-destructive/70 inline-block" />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-full bg-muted inline-block" />
                    )}
                    {t.label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{t.message ?? `${pct}%`}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className={`h-full transition-all ${t.status === "error" ? "bg-destructive/60" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {canSkip && (
          <div className="text-center">
            <Button variant={allDone ? "default" : "ghost"} size="sm" onClick={onSkip}>
              {allDone ? "Começar agora →" : "Pular preparação"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
