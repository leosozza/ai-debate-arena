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
import { Dices, Check } from "lucide-react";

type Accent = "primary" | "side-a" | "side-b";

/**
 * Single-reel roulette over a list of string options (curated + AI).
 * The parent fetches `options` (and toggles `loading`); the reel spins
 * through them, decelerates and lands on one.
 */
export function Roulette({
  open,
  onOpenChange,
  title,
  description,
  options,
  loading = false,
  accent = "primary",
  confirmLabel = "Usar",
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  options: string[];
  loading?: boolean;
  accent?: Accent;
  confirmLabel?: string;
  onPick: (value: string) => void;
}) {
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const [display, setDisplay] = useState<string>("");
  const finalRef = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  useEffect(() => {
    if (!open) {
      clearTimers();
      setSpinning(false);
      setDone(false);
      setDisplay("");
      finalRef.current = null;
    }
    return clearTimers;
  }, [open]);

  const ready = !loading && options.length > 0;

  function spin() {
    if (!ready || spinning) return;
    clearTimers();
    setDone(false);
    setSpinning(true);
    const final = options[Math.floor(Math.random() * options.length)];
    finalRef.current = final;

    let delay = 55;
    let elapsed = 0;
    const duration = 1700;
    const tick = () => {
      setDisplay(options[Math.floor(Math.random() * options.length)]);
      elapsed += delay;
      delay = Math.min(delay * 1.18, 260);
      if (elapsed < duration) {
        timers.current.push(setTimeout(tick, delay));
      } else {
        setDisplay(final);
        setSpinning(false);
        setDone(true);
      }
    };
    tick();
  }

  function confirm() {
    if (finalRef.current) {
      onPick(finalRef.current);
      onOpenChange(false);
    }
  }

  const accentText = `text-${accent}`;
  const accentBorder = `border-l-${accent}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Dices className={`h-5 w-5 ${accentText}`} /> {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <motion.div
          animate={done && !spinning ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 0.4 }}
          className={`min-h-24 rounded-xl border border-border/60 border-l-4 ${accentBorder} bg-card/70 p-5 flex items-center justify-center text-center`}
        >
          {loading ? (
            <span className="text-sm text-muted-foreground animate-pulse">Preparando opções…</span>
          ) : options.length === 0 ? (
            <span className="text-sm text-muted-foreground">Nenhuma opção disponível.</span>
          ) : (
            <span className={`font-display font-semibold text-lg leading-snug ${spinning ? "blur-[1px] opacity-80" : ""}`}>
              {display || "Gire para sortear"}
            </span>
          )}
        </motion.div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {done ? (
            <>
              <Button variant="outline" onClick={spin} disabled={!ready} className="gap-2">
                <Dices className="h-4 w-4" /> Girar de novo
              </Button>
              <Button onClick={confirm} className="gap-2">
                <Check className="h-4 w-4" /> {confirmLabel}
              </Button>
            </>
          ) : (
            <Button onClick={spin} disabled={!ready || spinning} className="gap-2">
              <Dices className="h-4 w-4" /> {spinning ? "Girando…" : "Girar"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
