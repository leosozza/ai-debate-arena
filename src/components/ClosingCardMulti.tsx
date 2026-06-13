import { Bot, Trophy } from "lucide-react";
import type { MultiVerdict } from "@/lib/debate.functions";
import { accentForSlot, type CastAccent } from "@/components/CastStrip";

type SpeakerLite = {
  key: string;       // "a" | "b" | "ex<slot>"
  slot: number;
  name: string;
  imageUrl: string | null;
};

type Props = {
  topic: string;
  verdict: MultiVerdict;
  speakers: SpeakerLite[];
};

function textClass(a: CastAccent): string {
  switch (a) {
    case "side-a": return "text-side-a";
    case "side-b": return "text-side-b";
    case "chart-4": return "text-chart-4";
    case "chart-5": return "text-chart-5";
    case "primary": return "text-primary";
    default: return "text-accent";
  }
}
function borderClass(a: CastAccent): string {
  switch (a) {
    case "side-a": return "border-side-a/70";
    case "side-b": return "border-side-b/70";
    case "chart-4": return "border-chart-4/70";
    case "chart-5": return "border-chart-5/70";
    case "primary": return "border-primary/70";
    default: return "border-accent/70";
  }
}
function bgClass(a: CastAccent): string {
  switch (a) {
    case "side-a": return "bg-side-a";
    case "side-b": return "bg-side-b";
    case "chart-4": return "bg-chart-4";
    case "chart-5": return "bg-chart-5";
    case "primary": return "bg-primary";
    default: return "bg-accent";
  }
}

const MEDALS: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

/**
 * Tela de encerramento para programas multi-participante (mesa redonda,
 * júri, mesa-de-sábios, etc) — ranking completo com pódio destacado.
 */
export function ClosingCardMulti({ topic, verdict, speakers }: Props) {
  const speakerByKey = new Map(speakers.map((s) => [s.key, s]));
  const ranked = verdict.ranking.map((r, i) => {
    const sp = speakerByKey.get(r.key);
    const slot = sp?.slot ?? (r.key === "a" ? 0 : r.key === "b" ? 1 : Number(r.key.replace(/^ex/, "")) || i);
    return { ...r, slot, imageUrl: sp?.imageUrl ?? null, accent: accentForSlot(slot) };
  });
  const max = Math.max(1, ...ranked.map((r) => r.score));
  const winner = ranked[0];

  return (
    <div className="w-full h-full flex flex-col items-center justify-between gap-5 py-2 animate-in fade-in zoom-in-95 duration-700">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground mb-2 flex items-center justify-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Encerramento do programa
        </div>
        <div className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto text-balance">{topic}</div>
      </div>

      {winner && (
        <div className="flex flex-col items-center gap-3">
          <div className={`relative flex h-32 w-32 md:h-44 md:w-44 items-center justify-center overflow-hidden rounded-full border-4 bg-background/60 ${borderClass(winner.accent)}`}>
            <span className="absolute inset-[-10px] rounded-full border border-current opacity-30 animate-ping" />
            {winner.imageUrl ? (
              <img src={winner.imageUrl} alt={winner.name} className="h-full w-full object-cover" />
            ) : (
              <Bot className="h-14 w-14 md:h-20 md:w-20" />
            )}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground shadow-lg">
              Vencedor
            </div>
          </div>
          <div className={`font-display text-3xl md:text-5xl font-extrabold tracking-tight ${textClass(winner.accent)} text-center text-balance`}>
            {winner.name}
          </div>
          <div className="text-sm uppercase tracking-widest text-muted-foreground">{winner.score} pts</div>
        </div>
      )}

      <div className="w-full max-w-2xl space-y-2 px-4">
        {ranked.map((r, i) => (
          <div key={r.key} className="flex items-center gap-3">
            <span className="w-8 text-center text-lg">{MEDALS[i] ?? `${i + 1}.`}</span>
            <span className={`min-w-[140px] truncate font-medium ${i === 0 ? textClass(r.accent) : "text-foreground/90"}`}>{r.name}</span>
            <div className="flex-1 h-2 rounded-full bg-border/60 overflow-hidden">
              <div className={`h-full ${bgClass(r.accent)}`} style={{ width: `${(r.score / max) * 100}%` }} />
            </div>
            <span className="w-12 text-right font-display font-bold tabular-nums">{r.score}</span>
          </div>
        ))}
      </div>

      {verdict.summary && (
        <p className="text-sm md:text-lg leading-relaxed text-foreground/90 max-w-3xl mx-auto text-balance text-center px-4">
          {verdict.summary}
        </p>
      )}
    </div>
  );
}
