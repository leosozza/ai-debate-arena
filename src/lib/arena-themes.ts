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
  duelNeon: { base: "oklch(0.13 0.03 300)", a: "oklch(0.74 0.2 320)", b: "oklch(0.72 0.18 200)", accent: "oklch(0.78 0.18 280)" },
  duelLava: { base: "oklch(0.15 0.04 30)", a: "oklch(0.7 0.2 40)", b: "oklch(0.55 0.15 20)", accent: "oklch(0.78 0.18 60)" },
  duelArctic: { base: "oklch(0.18 0.02 230)", a: "oklch(0.78 0.12 220)", b: "oklch(0.74 0.1 200)", accent: "oklch(0.82 0.1 240)" },
  studio: { base: "oklch(0.17 0.02 264)", a: "oklch(0.7 0.16 200)", b: "oklch(0.74 0.15 320)", accent: "oklch(0.7 0.16 280)" },
  tavola: { base: "oklch(0.18 0.04 60)", a: "oklch(0.72 0.14 70)", b: "oklch(0.6 0.12 40)", accent: "oklch(0.66 0.14 75)" },
  roundCozy: { base: "oklch(0.2 0.03 50)", a: "oklch(0.74 0.12 55)", b: "oklch(0.68 0.1 40)", accent: "oklch(0.76 0.12 70)" },
  roundGlass: { base: "oklch(0.18 0.02 250)", a: "oklch(0.76 0.1 220)", b: "oklch(0.74 0.1 260)", accent: "oklch(0.8 0.1 240)" },
  roundForum: { base: "oklch(0.17 0.03 80)", a: "oklch(0.72 0.14 80)", b: "oklch(0.7 0.12 60)", accent: "oklch(0.76 0.12 90)" },
  senate: { base: "oklch(0.16 0.02 264)", a: "oklch(0.62 0.2 25)", b: "oklch(0.62 0.18 250)", accent: "oklch(0.7 0.05 90)" },
  podium: { base: "oklch(0.15 0.02 264)", a: "oklch(0.7 0.17 235)", b: "oklch(0.78 0.15 80)", accent: "oklch(0.72 0.06 250)" },
  presFlags: { base: "oklch(0.14 0.04 260)", a: "oklch(0.68 0.2 25)", b: "oklch(0.7 0.18 230)", accent: "oklch(0.8 0.12 90)" },
  presNews: { base: "oklch(0.18 0.02 264)", a: "oklch(0.72 0.15 230)", b: "oklch(0.74 0.14 270)", accent: "oklch(0.78 0.13 250)" },
  presPrime: { base: "oklch(0.13 0.03 280)", a: "oklch(0.72 0.18 300)", b: "oklch(0.7 0.16 220)", accent: "oklch(0.78 0.16 280)" },
  court: { base: "oklch(0.16 0.02 280)", a: "oklch(0.7 0.05 90)", b: "oklch(0.6 0.12 280)", accent: "oklch(0.74 0.12 85)" },
  noir: { base: "oklch(0.12 0.01 264)", a: "oklch(0.6 0.18 25)", b: "oklch(0.55 0.04 264)", accent: "oklch(0.7 0.1 60)" },
  tribMarble: { base: "oklch(0.2 0.01 80)", a: "oklch(0.78 0.06 85)", b: "oklch(0.7 0.08 70)", accent: "oklch(0.82 0.08 90)" },
  tribGothic: { base: "oklch(0.1 0.02 280)", a: "oklch(0.6 0.18 320)", b: "oklch(0.5 0.1 280)", accent: "oklch(0.68 0.16 300)" },
  tribClassic: { base: "oklch(0.18 0.03 50)", a: "oklch(0.72 0.12 55)", b: "oklch(0.66 0.1 40)", accent: "oklch(0.78 0.12 70)" },
  talkshow: { base: "oklch(0.18 0.03 40)", a: "oklch(0.74 0.14 60)", b: "oklch(0.7 0.13 30)", accent: "oklch(0.72 0.14 70)" },
  sleek: { base: "oklch(0.16 0.02 264)", a: "oklch(0.72 0.15 220)", b: "oklch(0.7 0.14 300)", accent: "oklch(0.66 0.18 277)" },
  intvLounge: { base: "oklch(0.18 0.03 30)", a: "oklch(0.72 0.14 40)", b: "oklch(0.68 0.12 20)", accent: "oklch(0.76 0.14 60)" },
  intvLibrary: { base: "oklch(0.18 0.03 60)", a: "oklch(0.7 0.1 60)", b: "oklch(0.66 0.1 50)", accent: "oklch(0.74 0.1 70)" },
  intvNight: { base: "oklch(0.12 0.03 280)", a: "oklch(0.7 0.16 300)", b: "oklch(0.68 0.14 260)", accent: "oklch(0.78 0.16 280)" },
  timewarp: { base: "oklch(0.15 0.03 264)", a: "oklch(0.66 0.16 50)", b: "oklch(0.74 0.16 210)", accent: "oklch(0.7 0.18 277)" },
  cosmic: { base: "oklch(0.13 0.04 280)", a: "oklch(0.7 0.18 300)", b: "oklch(0.72 0.16 200)", accent: "oklch(0.75 0.18 320)" },
  eraVortex: { base: "oklch(0.14 0.04 260)", a: "oklch(0.7 0.16 30)", b: "oklch(0.72 0.16 220)", accent: "oklch(0.78 0.18 300)" },
  eraRuins: { base: "oklch(0.18 0.03 60)", a: "oklch(0.72 0.12 70)", b: "oklch(0.66 0.1 50)", accent: "oklch(0.76 0.14 80)" },
  eraFuture: { base: "oklch(0.13 0.03 240)", a: "oklch(0.74 0.14 220)", b: "oklch(0.72 0.16 280)", accent: "oklch(0.8 0.14 250)" },
  temple: { base: "oklch(0.17 0.03 70)", a: "oklch(0.74 0.13 75)", b: "oklch(0.66 0.12 50)", accent: "oklch(0.72 0.12 80)" },
  zen: { base: "oklch(0.18 0.02 160)", a: "oklch(0.72 0.1 160)", b: "oklch(0.7 0.09 190)", accent: "oklch(0.74 0.1 150)" },
  sagesAgora: { base: "oklch(0.19 0.03 80)", a: "oklch(0.74 0.12 80)", b: "oklch(0.7 0.1 60)", accent: "oklch(0.78 0.1 90)" },
  sagesNight: { base: "oklch(0.14 0.04 260)", a: "oklch(0.72 0.14 260)", b: "oklch(0.7 0.12 240)", accent: "oklch(0.78 0.14 280)" },
  sagesGarden: { base: "oklch(0.2 0.04 140)", a: "oklch(0.74 0.12 140)", b: "oklch(0.7 0.1 160)", accent: "oklch(0.78 0.12 130)" },
  teams: { base: "oklch(0.15 0.03 264)", a: "oklch(0.66 0.19 25)", b: "oklch(0.7 0.16 250)", accent: "oklch(0.7 0.15 277)" },
  war: { base: "oklch(0.16 0.03 120)", a: "oklch(0.64 0.16 130)", b: "oklch(0.62 0.16 40)", accent: "oklch(0.72 0.14 100)" },
  warStadium: { base: "oklch(0.15 0.03 250)", a: "oklch(0.7 0.18 25)", b: "oklch(0.72 0.16 240)", accent: "oklch(0.8 0.14 60)" },
  warArena: { base: "oklch(0.14 0.04 20)", a: "oklch(0.66 0.2 30)", b: "oklch(0.66 0.18 250)", accent: "oklch(0.76 0.16 60)" },
  warCircuit: { base: "oklch(0.16 0.03 200)", a: "oklch(0.72 0.18 200)", b: "oklch(0.72 0.16 320)", accent: "oklch(0.78 0.16 240)" },
  lab: { base: "oklch(0.16 0.02 230)", a: "oklch(0.72 0.15 200)", b: "oklch(0.72 0.14 160)", accent: "oklch(0.7 0.16 210)" },
  centRoom: { base: "oklch(0.17 0.02 264)", a: "oklch(0.74 0.12 230)", b: "oklch(0.7 0.1 260)", accent: "oklch(0.78 0.14 240)" },
  centTime: { base: "oklch(0.15 0.04 280)", a: "oklch(0.72 0.16 280)", b: "oklch(0.7 0.14 220)", accent: "oklch(0.78 0.16 300)" },
} as const;

export const ARENA_THEMES: ArenaTheme[] = [
  // duel (5)
  { id: "duel-cyber", name: "Arena Cyber", formats: ["duel"], scene: "split", palette: P.duelCyber },
  { id: "duel-ring", name: "Ringue", formats: ["duel"], scene: "split", palette: P.ring },
  { id: "duel-neon", name: "Neon Tokyo", formats: ["duel"], scene: "split", palette: P.duelNeon },
  { id: "duel-lava", name: "Vulcão", formats: ["duel"], scene: "split", palette: P.duelLava },
  { id: "duel-arctic", name: "Polo Ártico", formats: ["duel"], scene: "split", palette: P.duelArctic },
  // roundtable (5)
  { id: "round-studio", name: "Estúdio de TV", formats: ["roundtable"], scene: "table", palette: P.studio },
  { id: "round-tavola", name: "Távola", formats: ["roundtable"], scene: "table", palette: P.tavola },
  { id: "round-cozy", name: "Sala Aconchegante", formats: ["roundtable"], scene: "table", palette: P.roundCozy },
  { id: "round-glass", name: "Mesa de Vidro", formats: ["roundtable"], scene: "table", palette: P.roundGlass },
  { id: "round-forum", name: "Fórum Aberto", formats: ["roundtable"], scene: "table", palette: P.roundForum },
  // presidential (5)
  { id: "pres-podiums", name: "Púlpitos", formats: ["presidential"], scene: "podiums", palette: P.podium },
  { id: "pres-senate", name: "Plenário", formats: ["presidential"], scene: "podiums", palette: P.senate },
  { id: "pres-flags", name: "Bandeiras", formats: ["presidential"], scene: "podiums", palette: P.presFlags },
  { id: "pres-news", name: "Estúdio Jornalismo", formats: ["presidential"], scene: "podiums", palette: P.presNews },
  { id: "pres-prime", name: "Horário Nobre", formats: ["presidential"], scene: "podiums", palette: P.presPrime },
  // tribunal (5)
  { id: "trib-court", name: "Tribunal", formats: ["tribunal"], scene: "columns", palette: P.court },
  { id: "trib-noir", name: "Tribunal Noir", formats: ["tribunal"], scene: "columns", palette: P.noir },
  { id: "trib-marble", name: "Mármore Antigo", formats: ["tribunal"], scene: "columns", palette: P.tribMarble },
  { id: "trib-gothic", name: "Gótico", formats: ["tribunal"], scene: "columns", palette: P.tribGothic },
  { id: "trib-classic", name: "Câmara Clássica", formats: ["tribunal"], scene: "columns", palette: P.tribClassic },
  // interview (5)
  { id: "intv-talkshow", name: "Talk Show", formats: ["interview"], scene: "split", palette: P.talkshow },
  { id: "intv-sleek", name: "Set Minimal", formats: ["interview"], scene: "split", palette: P.sleek },
  { id: "intv-lounge", name: "Lounge", formats: ["interview"], scene: "split", palette: P.intvLounge },
  { id: "intv-library", name: "Biblioteca", formats: ["interview"], scene: "split", palette: P.intvLibrary },
  { id: "intv-night", name: "Late Night", formats: ["interview"], scene: "split", palette: P.intvNight },
  // era_clash (5)
  { id: "era-timewarp", name: "Fenda Temporal", formats: ["era_clash"], scene: "split", palette: P.timewarp },
  { id: "era-cosmic", name: "Confronto Cósmico", formats: ["era_clash"], scene: "cosmic", palette: P.cosmic },
  { id: "era-vortex", name: "Vórtex", formats: ["era_clash"], scene: "cosmic", palette: P.eraVortex },
  { id: "era-ruins", name: "Ruínas vs Cidade", formats: ["era_clash"], scene: "split", palette: P.eraRuins },
  { id: "era-future", name: "Futuro Próximo", formats: ["era_clash"], scene: "split", palette: P.eraFuture },
  // sages_council (5)
  { id: "sages-temple", name: "Templo do Conselho", formats: ["sages_council"], scene: "table", palette: P.temple },
  { id: "sages-zen", name: "Jardim Zen", formats: ["sages_council"], scene: "table", palette: P.zen },
  { id: "sages-agora", name: "Ágora", formats: ["sages_council"], scene: "table", palette: P.sagesAgora },
  { id: "sages-night", name: "Conselho Noturno", formats: ["sages_council"], scene: "table", palette: P.sagesNight },
  { id: "sages-garden", name: "Jardim dos Filósofos", formats: ["sages_council"], scene: "table", palette: P.sagesGarden },
  // ideas_war (5)
  { id: "war-teams", name: "Zonas de Time", formats: ["ideas_war"], scene: "split", palette: P.teams },
  { id: "war-field", name: "Campo de Batalha", formats: ["ideas_war"], scene: "podiums", palette: P.war },
  { id: "war-stadium", name: "Estádio", formats: ["ideas_war"], scene: "podiums", palette: P.warStadium },
  { id: "war-arena", name: "Coliseu", formats: ["ideas_war"], scene: "split", palette: P.warArena },
  { id: "war-circuit", name: "Circuito", formats: ["ideas_war"], scene: "split", palette: P.warCircuit },
  // century_problem (5)
  { id: "cent-lab", name: "Sala de Crise", formats: ["century_problem"], scene: "table", palette: P.lab },
  { id: "cent-cosmic", name: "Mesa Cósmica", formats: ["century_problem"], scene: "cosmic", palette: P.cosmic },
  { id: "cent-room", name: "Sala de Guerra", formats: ["century_problem"], scene: "table", palette: P.centRoom },
  { id: "cent-time", name: "Sala Temporal", formats: ["century_problem"], scene: "cosmic", palette: P.centTime },
  { id: "cent-temple", name: "Conclave", formats: ["century_problem"], scene: "table", palette: P.temple },
];

export function themesForFormat(format: DebateFormatId): ArenaTheme[] {
  const list = ARENA_THEMES.filter((t) => t.formats.includes(format));
  return list.length ? list : ARENA_THEMES.filter((t) => t.formats.includes("duel"));
}

export function getArenaTheme(id: string | null | undefined): ArenaTheme | null {
  return ARENA_THEMES.find((t) => t.id === id) ?? null;
}
