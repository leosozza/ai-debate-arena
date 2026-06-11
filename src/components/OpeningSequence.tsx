import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Volume2, VolumeX } from "lucide-react";

type Guest = {
  name: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  description?: string | null;
};

interface Props {
  topic: string;
  a: Guest;
  b: Guest;
  onDone: () => void;
}

type Step = "title" | "a" | "b" | "vs";

const STEP_MS: Record<Step, number> = { title: 2800, a: 7500, b: 7500, vs: 2200 };

/** Cinematic opening: title -> guest A vignette -> guest B vignette -> VS card. */
export function OpeningSequence({ topic, a, b, onDone }: Props) {
  const [step, setStep] = useState<Step>("title");
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const order: Step[] = ["title", "a", "b", "vs"];
    const i = order.indexOf(step);
    const t = setTimeout(() => {
      if (i < order.length - 1) setStep(order[i + 1]);
      else onDone();
    }, STEP_MS[step]);
    return () => clearTimeout(t);
  }, [step, onDone]);

  // Try to play video on guest steps (muted autoplays everywhere; unmuted needs prior gesture).
  useEffect(() => {
    if (step !== "a" && step !== "b") return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.play().catch(() => { /* fallback to ken-burns image visible behind */ });
  }, [step, muted]);

  const guest = step === "a" ? a : step === "b" ? b : null;
  const accent = step === "a" ? "side-a" : step === "b" ? "side-b" : "primary";

  return (
    <div className="fixed inset-0 z-[55] bg-[oklch(0.06_0.02_264)] text-foreground overflow-hidden">
      {/* Skip & mute controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {(step === "a" || step === "b") && guest?.videoUrl && (
          <Button size="icon" variant="ghost" onClick={() => setMuted((m) => !m)} aria-label="Som">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDone} className="text-xs uppercase tracking-widest">
          <X className="h-3.5 w-3.5 mr-1" /> Pular abertura
        </Button>
      </div>

      {step === "title" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center animate-in fade-in zoom-in-95 duration-700">
          <div className="text-xs md:text-sm uppercase tracking-[0.5em] text-primary font-semibold mb-6">
            Legends Arena · Hoje no programa
          </div>
          <h1 className="font-display text-4xl md:text-7xl font-extrabold tracking-tight text-foreground max-w-5xl text-balance">
            {topic}
          </h1>
          <div className="mt-10 h-1 w-24 rounded-full bg-primary animate-pulse" />
        </div>
      )}

      {(step === "a" || step === "b") && guest && (
        <div key={step} className="absolute inset-0 animate-in fade-in duration-500">
          {/* Background: video if available, else ken-burns image */}
          {guest.videoUrl ? (
            <video
              ref={videoRef}
              src={guest.videoUrl}
              autoPlay
              muted={muted}
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : guest.imageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center animate-[kenburns_8s_ease-out_forwards]"
              style={{ backgroundImage: `url(${guest.imageUrl})` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-background to-muted" />
          )}
          {/* Vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/30" />
          <div className="absolute inset-x-0 bottom-0 p-8 md:p-14 animate-in slide-in-from-bottom-4 duration-700">
            <div className={`text-xs md:text-sm uppercase tracking-[0.4em] mb-3 font-semibold text-${accent}`}>
              {step === "a" ? "Convidado A" : "Convidado B"}
            </div>
            <h2 className="font-display text-5xl md:text-8xl font-extrabold tracking-tight text-white text-balance">
              {guest.name}
            </h2>
            {guest.description && (
              <p className="mt-4 text-base md:text-xl text-white/85 max-w-2xl leading-relaxed">
                {guest.description}
              </p>
            )}
          </div>
        </div>
      )}

      {step === "vs" && (
        <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in-90 duration-500">
          <div className="grid grid-cols-3 items-center gap-4 md:gap-8 px-6 w-full max-w-5xl">
            <div className="flex flex-col items-center gap-3 animate-in slide-in-from-left-8 duration-700">
              {a.imageUrl && (
                <img src={a.imageUrl} alt={a.name} className="h-32 w-32 md:h-44 md:w-44 rounded-full border-4 border-side-a object-cover" />
              )}
              <div className="font-display text-xl md:text-3xl font-extrabold text-side-a text-center">{a.name}</div>
            </div>
            <div className="text-center">
              <div className="font-display text-6xl md:text-9xl font-black text-primary drop-shadow-[0_0_30px_oklch(0.62_0.205_277_/_0.6)]">
                VS
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 animate-in slide-in-from-right-8 duration-700">
              {b.imageUrl && (
                <img src={b.imageUrl} alt={b.name} className="h-32 w-32 md:h-44 md:w-44 rounded-full border-4 border-side-b object-cover" />
              )}
              <div className="font-display text-xl md:text-3xl font-extrabold text-side-b text-center">{b.name}</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1.0) translate(0, 0); }
          100% { transform: scale(1.15) translate(-2%, -1%); }
        }
      `}</style>
    </div>
  );
}
