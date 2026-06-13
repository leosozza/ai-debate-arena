import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import type { MultiVerdict } from "@/lib/debate.functions";
import { accentForSlot, type CastAccent } from "@/components/CastStrip";

const MEDALS: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

function barClass(accent: CastAccent): string {
  switch (accent) {
    case "side-a": return "bg-side-a";
    case "side-b": return "bg-side-b";
    case "chart-4": return "bg-chart-4";
    case "chart-5": return "bg-chart-5";
    case "primary": return "bg-primary";
    default: return "bg-accent";
  }
}

function textClass(accent: CastAccent): string {
  switch (accent) {
    case "side-a": return "text-side-a";
    case "side-b": return "text-side-b";
    case "chart-4": return "text-chart-4";
    case "chart-5": return "text-chart-5";
    case "primary": return "text-primary";
    default: return "text-accent";
  }
}

function slotOfKey(key: string): number {
  if (key === "a") return 0;
  if (key === "b") return 1;
  if (key.startsWith("ex")) return Number(key.slice(2)) || 0;
  return 0;
}

export function MultiScoreboard({ verdict }: { verdict: MultiVerdict }) {
  const winner = verdict.ranking[0];
  const max = Math.max(1, ...verdict.ranking.map((r) => r.score));
  return (
    <Card className="p-5 mb-6 bg-card/70">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold">
          Vencedor: <span className={textClass(accentForSlot(slotOfKey(winner?.key ?? "a")))}>{winner?.name ?? "—"}</span>
        </h3>
      </div>

      <div className="space-y-2 mb-5">
        {verdict.ranking.map((r, i) => {
          const accent = accentForSlot(slotOfKey(r.key));
          return (
            <div key={r.key} className="flex items-center gap-3">
              <span className="w-8 text-center text-lg">{MEDALS[i] ?? `${i + 1}.`}</span>
              <span className={`min-w-[120px] font-medium ${i === 0 ? textClass(accent) : ""}`}>{r.name}</span>
              <div className="flex-1 h-3 rounded-full bg-muted/40 overflow-hidden">
                <div className={`h-full ${barClass(accent)}`} style={{ width: `${(r.score / max) * 100}%` }} />
              </div>
              <span className="w-10 text-right font-display font-bold tabular-nums">{r.score}</span>
            </div>
          );
        })}
      </div>

      {verdict.criteria.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1 pr-3 font-normal">Critério</th>
                {verdict.ranking.map((r) => (
                  <th key={r.key} className="text-right py-1 px-2 font-normal whitespace-nowrap">{r.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {verdict.criteria.map((c) => (
                <tr key={c.name} className="border-t border-border/40">
                  <td className="py-1.5 pr-3">
                    {c.name} <span className="text-muted-foreground">({Math.round(c.weight * 100)}%)</span>
                  </td>
                  {verdict.ranking.map((r) => (
                    <td key={r.key} className="text-right py-1.5 px-2 tabular-nums">{c.scores[r.key] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {verdict.summary && <p className="text-sm text-foreground/90 leading-relaxed mb-3">{verdict.summary}</p>}
      {verdict.mvp_quote && (
        <blockquote className="border-l-2 border-primary/50 pl-3 text-sm italic text-muted-foreground">“{verdict.mvp_quote}”</blockquote>
      )}
    </Card>
  );
}
