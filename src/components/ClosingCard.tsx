import { Bot, Trophy } from "lucide-react";
import type { Verdict } from "@/lib/debate.functions";

type Debater = {
  name: string;
  imageUrl?: string | null;
};

type Props = {
  topic: string;
  verdict: Verdict;
  a: Debater;
  b: Debater;
};

/**
 * Full-stage closing card shown after the verdict — two debaters side by side
 * with score and winner highlighted, TV-show style.
 */
export function ClosingCard({ topic, verdict, a, b }: Props) {
  const winA = verdict.winner === "a";
  const winB = verdict.winner === "b";
  const tie = verdict.winner === "empate";
  const winnerLabel = tie ? "Empate técnico" : winA ? a.name : b.name;
  const winnerColor = tie ? "text-foreground" : winA ? "text-side-a" : "text-side-b";

  return (
    <div className="w-full h-full flex flex-col items-center justify-between gap-6 py-2 animate-in fade-in zoom-in-95 duration-700">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground mb-2 flex items-center justify-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Encerramento do programa
        </div>
        <div className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto text-balance">
          {topic}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 md:gap-8 items-center w-full max-w-5xl px-4">
        <ClosingGuest d={a} side="a" winner={winA} loser={winB} />

        <div className="flex flex-col items-center gap-3">
          <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Placar final</div>
          <div className="flex items-center gap-3 md:gap-5">
            <span className={`font-display text-4xl md:text-6xl font-extrabold tabular-nums ${winA ? "text-side-a" : "text-muted-foreground/60"}`}>{verdict.scoreA}</span>
            <span className="text-muted-foreground text-2xl">×</span>
            <span className={`font-display text-4xl md:text-6xl font-extrabold tabular-nums ${winB ? "text-side-b" : "text-muted-foreground/60"}`}>{verdict.scoreB}</span>
          </div>
          <div className={`mt-2 font-display text-2xl md:text-4xl font-extrabold tracking-tight ${winnerColor} text-center text-balance`}>
            {winnerLabel}
          </div>
        </div>

        <ClosingGuest d={b} side="b" winner={winB} loser={winA} />
      </div>

      {verdict.summary && (
        <p className="text-base md:text-xl leading-relaxed text-foreground/90 max-w-3xl mx-auto text-balance text-center px-4">
          {verdict.summary}
        </p>
      )}
    </div>
  );
}

function ClosingGuest({ d, side, winner, loser }: { d: Debater; side: "a" | "b"; winner: boolean; loser: boolean }) {
  const accent = side === "a" ? "text-side-a border-side-a/70" : "text-side-b border-side-b/70";
  const labelTone = side === "a" ? "text-side-a" : "text-side-b";
  const dim = loser ? "opacity-60" : "";
  return (
    <div className={`flex flex-col items-center text-center gap-3 ${dim}`}>
      <div className={`relative flex h-28 w-28 md:h-44 md:w-44 items-center justify-center overflow-hidden rounded-full border-4 bg-background/60 ${accent}`}>
        {winner && <span className="absolute inset-[-10px] rounded-full border border-current opacity-30 animate-ping" />}
        {d.imageUrl ? (
          <img src={d.imageUrl} alt={d.name} className="h-full w-full object-cover" />
        ) : (
          <Bot className="h-14 w-14 md:h-20 md:w-20" />
        )}
        {winner && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground shadow-lg">
            Vencedor
          </div>
        )}
      </div>
      <div className={`text-[10px] font-semibold uppercase tracking-[0.32em] ${labelTone}`}>
        Convidado {side.toUpperCase()}
      </div>
      <h3 className="font-display text-xl md:text-3xl font-extrabold tracking-tight text-foreground text-balance">
        {d.name}
      </h3>
    </div>
  );
}
