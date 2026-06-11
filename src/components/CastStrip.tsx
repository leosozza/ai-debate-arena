import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";

export type CastMember = {
  key: string;
  name: string;
  imageUrl: string | null;
  roleLabel: string;
  accent: "side-a" | "side-b" | "accent" | "primary";
  personaId?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  debater: "Convidado",
  judge: "Jurado",
  prosecutor: "Promotor",
  defender: "Defensor",
  interviewer: "Entrevistador",
  interviewee: "Entrevistado",
  team_a: "Time A",
  team_b: "Time B",
  moderator: "Mediador",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function Avatar({ name, src, accent }: { name: string; src: string | null; accent: CastMember["accent"] }) {
  const ring =
    accent === "side-a" ? "ring-side-a/60"
    : accent === "side-b" ? "ring-side-b/60"
    : accent === "primary" ? "ring-primary/60"
    : "ring-accent/60";
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div className={`h-14 w-14 rounded-full overflow-hidden ring-2 ${ring} bg-muted/40 flex items-center justify-center shrink-0`}>
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-muted-foreground">{initials || "?"}</span>}
    </div>
  );
}

function MemberCard({ m }: { m: CastMember }) {
  const inner = (
    <>
      <Avatar name={m.name} src={m.imageUrl} accent={m.accent} />
      <div className="min-w-0">
        <div className="font-display font-semibold text-sm leading-tight truncate max-w-[140px] flex items-center gap-1">
          {m.name}
          {m.personaId && <Pencil className="h-3 w-3 opacity-50 shrink-0" />}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.roleLabel}</div>
      </div>
    </>
  );
  const className = "flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/40 px-3 py-2 shrink-0 transition-colors";
  if (m.personaId) {
    return (
      <Link
        to="/personas"
        search={{ edit: m.personaId }}
        className={`${className} hover:bg-background/70 hover:border-primary/40 cursor-pointer`}
        title="Editar persona"
      >
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function CastStrip({ formatLabel, members }: { formatLabel?: string; members: CastMember[] }) {
  return (
    <Card className="p-4 mb-6 bg-card/50">
      {formatLabel && (
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{formatLabel}</Badge>
          <span className="text-xs text-muted-foreground">Elenco do programa · clique para editar</span>
        </div>
      )}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {members.map((m) => <MemberCard key={m.key} m={m} />)}
      </div>
    </Card>
  );
}
