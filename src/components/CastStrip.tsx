import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type CastAccent = "side-a" | "side-b" | "accent" | "primary" | "chart-4" | "chart-5";
export type CastMember = {
  key: string;
  name: string;
  imageUrl: string | null;
  roleLabel: string;
  accent: CastAccent;
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

/** Paleta cíclica por índice de slot — usada quando o formato não é "duelo". */
export const ACCENT_PALETTE: CastAccent[] = ["side-a", "side-b", "chart-4", "chart-5", "primary", "accent"];
export function accentForSlot(slot: number): CastAccent {
  return ACCENT_PALETTE[((slot % ACCENT_PALETTE.length) + ACCENT_PALETTE.length) % ACCENT_PALETTE.length];
}

/** Tom por papel — em formatos como tribunal/entrevista o papel diz mais que o slot. */
const ROLE_ACCENTS: Record<string, CastAccent> = {
  prosecutor: "side-b",   // azul — acusação
  defender: "chart-4",    // dourado — defesa
  judge: "primary",       // destaque neutro
  interviewer: "accent",
  team_a: "side-a",
  team_b: "side-b",
};
export function accentForRole(role: string | null | undefined, slot: number): CastAccent {
  if (role && ROLE_ACCENTS[role]) return ROLE_ACCENTS[role];
  return accentForSlot(slot);
}

function ringClass(accent: CastAccent): string {
  switch (accent) {
    case "side-a": return "ring-side-a/60";
    case "side-b": return "ring-side-b/60";
    case "primary": return "ring-primary/60";
    case "chart-4": return "ring-chart-4/60";
    case "chart-5": return "ring-chart-5/60";
    default: return "ring-accent/60";
  }
}

function Avatar({ name, src, accent }: { name: string; src: string | null; accent: CastAccent }) {
  const ring = ringClass(accent);
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div className={`h-14 w-14 rounded-full overflow-hidden ring-2 ${ring} bg-muted/40 flex items-center justify-center shrink-0`}>
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-muted-foreground">{initials || "?"}</span>}
    </div>
  );
}

export function CastStrip({ formatLabel, members, onMemberClick }: { formatLabel?: string; members: CastMember[]; onMemberClick?: (key: string) => void }) {
  const scrollRef = (el: HTMLDivElement | null) => {
    if (!el) return;
    // Convert vertical wheel to horizontal scroll for easier discovery
    el.onwheel = (e) => {
      if (e.deltaY === 0) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
  };
  return (
    <Card className="p-4 mb-6 bg-card/50 overflow-hidden">
      {formatLabel && (
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{formatLabel}</Badge>
          <span className="text-xs text-muted-foreground">Elenco do programa · clique para editar</span>
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
      >
        {members.map((m) => {
          const Tag = onMemberClick ? "button" : "div";
          return (
            <Tag
              key={m.key}
              type={onMemberClick ? "button" : undefined}
              onClick={onMemberClick ? () => onMemberClick(m.key) : undefined}
              className={`flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/40 px-3 py-2 shrink-0 snap-start text-left transition ${onMemberClick ? "hover:border-primary/60 hover:bg-background/70 cursor-pointer" : ""}`}
            >
              <Avatar name={m.name} src={m.imageUrl} accent={m.accent} />
              <div className="min-w-0">
                <div className="font-display font-semibold text-sm leading-tight truncate max-w-[140px]">{m.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.roleLabel}</div>
              </div>
            </Tag>
          );
        })}
      </div>
    </Card>
  );
}
