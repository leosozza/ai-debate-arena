// Catálogo de temas (cenários de fundo) da arena. 2 por formato (18 no total).
// Cada tema = um arquétipo de cena + uma paleta. O <ArenaScene> desenha.
import type { DebateFormatId } from "./debate-formats";

export type SceneArchetype = "split" | "table" | "podiums" | "columns" | "cosmic";

export interface ArenaPalette {
  base: string; // fundo
  a: string; // brilho/lado A
  b: string; // brilho/lado B
  accent: string; // detalhe (piso/linhas)
}

export interface ArenaTheme {
  id: string;
  name: string;
  formats: DebateFormatId[]; // formatos para os quais o tema aparece
  scene: SceneArchetype;
  palette: ArenaPalette;
}

// Paletas reutilizáveis (oklch).
const P = {
  duelCyber: { base: "oklch(0.16 0.03 264)", a: "oklch(0.72 0.16 232)", b: "oklch(0.80 0.15 82)", accent: "oklch(0.62 0.2 277)" },
  ring: { base: "oklch(0.15 0.04 20)", a: "oklch(0.62 0.21 25)", b: "oklch(0.7 0.16 250)", accent: "oklch(0.7 0.18 60)" },
  studio: { base: "oklch(0.17 0.02 264)", a: "oklch(0.7 0.16 200)", b: "oklch(0.74 0.15 320)", accent: "oklch(0.7 0.16 280)" },
  tavola: { base: "oklch(0.18 0.04 60)", a: "oklch(0.72 0.14 70)", b: "oklch(0.6 0.12 40)", accent: "oklch(0.66 0.14 75)" },
  senate: { base: "oklch(0.16 0.02 264)", a: "oklch(0.62 0.2 25)", b: "oklch(0.62 0.18 250)", accent: "oklch(0.7 0.05 90)" },
  podium: { base: "oklch(0.15 0.02 264)", a: "oklch(0.7 0.17 235)", b: "oklch(0.78 0.15 80)", accent: "oklch(0.72 0.06 250)" },
  court: { base: "oklch(0.16 0.02 280)", a: "oklch(0.7 0.05 90)", b: "oklch(0.6 0.12 280)", accent: "oklch(0.74 0.12 85)" },
  noir: { base: "oklch(0.12 0.01 264)", a: "oklch(0.6 0.18 25)", b: "oklch(0.55 0.04 264)", accent: "oklch(0.7 0.1 60)" },
  talkshow: { base: "oklch(0.18 0.03 40)", a: "oklch(0.74 0.14 60)", b: "oklch(0.7 0.13 30)", accent: "oklch(0.72 0.14 70)" },
  sleek: { base: "oklch(0.16 0.02 264)", a: "oklch(0.72 0.15 220)", b: "oklch(0.7 0.14 300)", accent: "oklch(0.66 0.18 277)" },
  timewarp: { base: "oklch(0.15 0.03 264)", a: "oklch(0.66 0.16 50)", b: "oklch(0.74 0.16 210)", accent: "oklch(0.7 0.18 277)" },
  cosmic: { base: "oklch(0.13 0.04 280)", a: "oklch(0.7 0.18 300)", b: "oklch(0.72 0.16 200)", accent: "oklch(0.75 0.18 320)" },
  temple: { base: "oklch(0.17 0.03 70)", a: "oklch(0.74 0.13 75)", b: "oklch(0.66 0.12 50)", accent: "oklch(0.72 0.12 80)" },
  zen: { base: "oklch(0.18 0.02 160)", a: "oklch(0.72 0.1 160)", b: "oklch(0.7 0.09 190)", accent: "oklch(0.74 0.1 150)" },
  teams: { base: "oklch(0.15 0.03 264)", a: "oklch(0.66 0.19 25)", b: "oklch(0.7 0.16 250)", accent: "oklch(0.7 0.15 277)" },
  war: { base: "oklch(0.16 0.03 120)", a: "oklch(0.64 0.16 130)", b: "oklch(0.62 0.16 40)", accent: "oklch(0.72 0.14 100)" },
  lab: { base: "oklch(0.16 0.02 230)", a: "oklch(0.72 0.15 200)", b: "oklch(0.72 0.14 160)", accent: "oklch(0.7 0.16 210)" },
} as const;

export const ARENA_THEMES: ArenaTheme[] = [
  // duel
  { id: "duel-cyber", name: "Arena Cyber", formats: ["duel"], scene: "split", palette: P.duelCyber },
  { id: "duel-ring", name: "Ringue", formats: ["duel"], scene: "split", palette: P.ring },
  // roundtable
  { id: "round-studio", name: "Estúdio de TV", formats: ["roundtable"], scene: "table", palette: P.studio },
  { id: "round-tavola", name: "Távola", formats: ["roundtable"], scene: "table", palette: P.tavola },
  // presidential
  { id: "pres-podiums", name: "Púlpitos", formats: ["presidential"], scene: "podiums", palette: P.podium },
  { id: "pres-senate", name: "Plenário", formats: ["presidential"], scene: "podiums", palette: P.senate },
  // tribunal
  { id: "trib-court", name: "Tribunal", formats: ["tribunal"], scene: "columns", palette: P.court },
  { id: "trib-noir", name: "Tribunal Noir", formats: ["tribunal"], scene: "columns", palette: P.noir },
  // interview
  { id: "intv-talkshow", name: "Talk Show", formats: ["interview"], scene: "split", palette: P.talkshow },
  { id: "intv-sleek", name: "Set Minimal", formats: ["interview"], scene: "split", palette: P.sleek },
  // era_clash
  { id: "era-timewarp", name: "Fenda Temporal", formats: ["era_clash"], scene: "split", palette: P.timewarp },
  { id: "era-cosmic", name: "Confronto Cósmico", formats: ["era_clash"], scene: "cosmic", palette: P.cosmic },
  // sages_council
  { id: "sages-temple", name: "Templo do Conselho", formats: ["sages_council"], scene: "table", palette: P.temple },
  { id: "sages-zen", name: "Jardim Zen", formats: ["sages_council"], scene: "table", palette: P.zen },
  // ideas_war
  { id: "war-teams", name: "Zonas de Time", formats: ["ideas_war"], scene: "split", palette: P.teams },
  { id: "war-field", name: "Campo de Batalha", formats: ["ideas_war"], scene: "podiums", palette: P.war },
  // century_problem
  { id: "cent-lab", name: "Sala de Crise", formats: ["century_problem"], scene: "table", palette: P.lab },
  { id: "cent-cosmic", name: "Mesa Cósmica", formats: ["century_problem"], scene: "cosmic", palette: P.cosmic },
];

export function themesForFormat(format: DebateFormatId): ArenaTheme[] {
  const list = ARENA_THEMES.filter((t) => t.formats.includes(format));
  return list.length ? list : ARENA_THEMES.filter((t) => t.formats.includes("duel"));
}

export function getArenaTheme(id: string | null | undefined): ArenaTheme | null {
  return ARENA_THEMES.find((t) => t.id === id) ?? null;
}
