import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Dices, Swords, Check, Sparkles } from "lucide-react";

export type RoulettePersona = {
  id: string;
  name: string;
  description?: string | null;
  persona_prompt: string;
};

/**
 * Slot-machine that randomly draws two distinct saved personas to be the
 * debaters. Fun reveal for YouTube: both reels spin fast then settle on A/B.
 */
export function PersonaRoulette({
  personas,
  open,
  onOpenChange,
  onPick,
  onSuggestThemes,
}: {
  personas: RoulettePersona[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (a: RoulettePersona, b: RoulettePersona, theme?: string) => void;
  onSuggestThemes?: (a: RoulettePersona, b: RoulettePersona) => Promise<string[]>;
}) {
  const enough = personas.length >= 2;
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const [showA, setShowA] = useState<RoulettePersona | null>(null);
  const [showB, setShowB] = useState<RoulettePersona | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const finalRef = useRef<{ a: RoulettePersona; b: RoulettePersona } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  // Reset whenever the dialog opens/closes.
  useEffect(() => {
    if (!open) {
      clearTimers();
      setSpinning(false);
      setDone(false);
      setShowA(null);
      setShowB(null);
      setThemes([]);
      setThemesLoading(false);
      finalRef.current = null;
    }
    return clearTimers;
  }, [open]);

  async function loadThemes() {
    if (!finalRef.current || !onSuggestThemes) return;
    setThemesLoading(true);
    setThemes([]);
    try {
      setThemes(await onSuggestThemes(finalRef.current.a, finalRef.current.b));
    } catch {
      setThemes([]);
    } finally {
      setThemesLoading(false);
    }
  }

  function rand() {
    return personas[Math.floor(Math.random() * personas.length)];
  }

  function spin() {
    if (!enough || spinning) return;
    clearTimers();
    setDone(false);
    setThemes([]);
    setSpinning(true);

    // Pick the two distinct winners up front.
    const a = rand();
    let b = rand();
    let guard = 0;
    while (b.id === a.id && guard++ < 50) b = rand();
    finalRef.current = { a, b };

    // Decelerating cycle: intervals grow so it "slows down" before landing.
    let delay = 60;
    let elapsed = 0;
    const duration = 1900;
    const tick = () => {
      setShowA(rand());
      setShowB(rand());
      elapsed += delay;
      delay = Math.min(delay * 1.18, 260);
      if (elapsed < duration) {
        timers.current.push(setTimeout(tick, delay));
      } else {
        setShowA(a);
        setShowB(b);
        setSpinning(false);
        setDone(true);
      }
    };
    tick();
  }

  function confirm(theme?: string) {
    if (finalRef.current) {
      onPick(finalRef.current.a, finalRef.current.b, theme);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Dices className="h-5 w-5 text-primary" /> Roleta de personas
          </DialogTitle>
          <DialogDescription>
            {enough
              ? "Sorteia duas personas salvas para se enfrentarem. Gire e veja quem cai de cada lado."
              : "Você precisa de pelo menos 2 personas salvas para sortear."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3 py-2">
          <Reel side="a" persona={showA} spinning={spinning} done={done} />
          <div className="flex items-center justify-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground">
              <Swords className="h-4 w-4" />
            </span>
          </div>
          <Reel side="b" persona={showB} spinning={spinning} done={done} />
        </div>

        {done ? (
          <div className="space-y-3 pt-1">
            {onSuggestThemes && (
              <div className="rounded-lg border border-border/60 bg-card/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Temas sob medida pra esse confronto</span>
                  <Button size="sm" variant="ghost" onClick={loadThemes} disabled={themesLoading} className="h-7 gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> {themesLoading ? "Gerando…" : themes.length ? "Outros" : "Sugerir"}
                  </Button>
                </div>
                {themesLoading && <p className="text-xs text-muted-foreground animate-pulse">Pensando nos melhores temas…</p>}
                {themes.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {themes.map((t) => (
                      <button
                        key={t}
                        onClick={() => confirm(t)}
                        className="text-left text-sm rounded-md border border-border/60 px-3 py-2 transition hover:border-primary/50 hover:bg-accent/50"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button variant="outline" onClick={spin} className="gap-2">
                <Dices className="h-4 w-4" /> Girar de novo
              </Button>
              <Button onClick={() => confirm()} className="gap-2">
                <Check className="h-4 w-4" /> Usar estes
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={spin} disabled={!enough || spinning} className="gap-2">
              <Dices className="h-4 w-4" /> {spinning ? "Girando…" : "Girar"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Reel({
  side,
  persona,
  spinning,
  done,
}: {
  side: "a" | "b";
  persona: RoulettePersona | null;
  spinning: boolean;
  done: boolean;
}) {
  const accent = side === "a" ? "side-a" : "side-b";
  const settled = done && !spinning;
  return (
    <motion.div
      animate={settled ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.4 }}
      className={`min-h-28 rounded-xl border-l-4 border border-border/60 bg-card/70 p-4 flex flex-col justify-center text-center overflow-hidden border-l-${accent}`}
    >
      <div className={`text-[10px] uppercase tracking-[0.25em] mb-1 text-${accent}`}>
        Debatedor {side.toUpperCase()}
      </div>
      <div className={`font-display font-bold text-lg leading-tight ${spinning ? "blur-[1px] opacity-80" : ""} text-${accent}`}>
        {persona?.name ?? "—"}
      </div>
      {settled && persona?.description && (
        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{persona.description}</div>
      )}
    </motion.div>
  );
}
