import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createDebate, generateDebateTopic, generateOpposingDebaters, drawTopics, generateMatchupThemes } from "@/lib/debate.functions";
import { listPersonas } from "@/lib/persona.functions";
import { PersonaRoulette, type RoulettePersona } from "@/components/PersonaRoulette";
import { Roulette } from "@/components/Roulette";
import { AVAILABLE_MODELS } from "@/lib/ai-models";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Reveal } from "@/components/Reveal";
import { toast } from "sonner";
import { Sparkles, Users, Wand2, Swords, Dices } from "lucide-react";
import { VoicePicker } from "@/components/VoicePicker";
import { type VoiceProvider } from "@/lib/voice-catalog";
import { DEBATE_FORMATS, getFormat, type DebateFormatId } from "@/lib/debate-formats";
import { Badge } from "@/components/ui/badge";
import { ExtraParticipantsPanel, makeEmptyExtra, type ExtraParticipantDraft } from "@/components/ExtraParticipantsPanel";
import { personaGenderFrom, defaultVoiceForGender } from "@/lib/persona-gender";
import { listMediators, type MediatorRow } from "@/lib/mediators.functions";
import { themesForFormat } from "@/lib/arena-themes";
import { ArenaScene } from "@/components/ArenaScene";
import { AIDisclaimer } from "@/components/AIDisclaimer";

export const Route = createFileRoute("/_authenticated/new")({
  component: NewDebate,
});

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

// Categorias do catálogo de personas (rótulo + ordem de exibição).
const CAT_LABELS: Record<string, string> = {
  filosofia: "Filosofia",
  ciencia: "Ciência",
  inventores: "Inventores",
  religiao: "Religião & Espiritualidade",
  "politica-mundo": "Política (Mundo)",
  "politica-br": "Política (Brasil)",
  economia: "Economia",
  estrategia: "Estratégia & Guerra",
  esporte: "Esporte",
};
const CAT_ORDER = ["filosofia", "ciencia", "inventores", "religiao", "politica-mundo", "politica-br", "economia", "estrategia", "esporte"];

type PersonaLite = { id: string; name: string; category?: string | null };

/** Itens do select de persona, agrupados por categoria. */
function PersonaSelectItems({ personas }: { personas: PersonaLite[] }) {
  const groups = new Map<string, PersonaLite[]>();
  for (const p of personas) {
    const cat = p.category || "outros";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(p);
  }
  const cats = [
    ...CAT_ORDER.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter((c) => !CAT_ORDER.includes(c)),
  ];
  return (
    <>
      {cats.map((cat) => (
        <SelectGroup key={cat}>
          <SelectLabel>{CAT_LABELS[cat] ?? "Outros"}</SelectLabel>
          {groups.get(cat)!.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );
}

function NewDebate() {
  const router = useRouter();
  const create = useServerFn(createDebate);
  const listP = useServerFn(listPersonas);
  const listMed = useServerFn(listMediators);
  const { data: personas = [] } = useQuery({ queryKey: ["personas"], queryFn: () => listP() });
  const { data: mediators = [] } = useQuery({ queryKey: ["mediators"], queryFn: () => listMed(), staleTime: 5 * 60_000 });
  const genTopicFn = useServerFn(generateDebateTopic);
  const genSidesFn = useServerFn(generateOpposingDebaters);
  const drawTopicsFn = useServerFn(drawTopics);
  const matchupFn = useServerFn(generateMatchupThemes);
  const [loading, setLoading] = useState(false);
  const [genTopic, setGenTopic] = useState(false);
  const [genSides, setGenSides] = useState(false);
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [topicRouletteOpen, setTopicRouletteOpen] = useState(false);
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [topicOptionsLoading, setTopicOptionsLoading] = useState(false);
  const [form, setForm] = useState({
    topic: "",
    direction: "",
    format: "duel" as DebateFormatId,
    arenaTheme: "duel-cyber" as string,
    debaterAName: "Aurora",
    debaterAPersona: "Defensora apaixonada da tecnologia, otimista quanto ao futuro da IA.",
    debaterAModel: DEFAULT_MODEL,
    debaterAImageUrl: null as string | null,
    debaterBName: "Cético",
    debaterBPersona: "Crítico cauteloso, preocupado com impactos sociais e éticos.",
    debaterBModel: DEFAULT_MODEL,
    debaterBImageUrl: null as string | null,
    moderatorModel: DEFAULT_MODEL,
    moderatorTone: "formal" as "formal" | "descontraído" | "acadêmico",
    moderatorName: null as string | null,
    moderatorStyle: null as string | null,
    rounds: 3,
    blocksCount: 4,
    dynamicFlow: false,
    voiceProviderMod: "kokoro" as VoiceProvider,
    voiceIdMod: null as string | null,
    voiceProviderA: "kokoro" as VoiceProvider,
    voiceIdA: null as string | null,
    voiceProviderB: "kokoro" as VoiceProvider,
    voiceIdB: null as string | null,
  });
  const [extras, setExtras] = useState<ExtraParticipantDraft[]>([]);
  const [commentators, setCommentators] = useState<Array<{ name: string; persona: string; voiceProvider: VoiceProvider | null; voiceId: string | null }>>([]);
  function toggleCommentators(on: boolean) {
    setCommentators(on
      ? [
          { name: "Repórter 1", persona: "Comentarista esportivo de debates, analítico e direto.", voiceProvider: "kokoro", voiceId: "pm_alex" },
          { name: "Repórter 2", persona: "Comentarista perspicaz, foca em retórica e impacto no público.", voiceProvider: "kokoro", voiceId: "pf_dora" },
        ]
      : []);
  }
  function updateCommentator(i: number, patch: Partial<{ name: string; persona: string; voiceProvider: VoiceProvider | null; voiceId: string | null }>) {
    setCommentators((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  const currentFormat = getFormat(form.format)!;
  const [mediatorId, setMediatorId] = useState<string | null>(null);

  function pickMediator(m: MediatorRow) {
    setMediatorId(m.id);
    setForm((f) => ({
      ...f,
      moderatorName: m.name,
      moderatorStyle: m.style,
      moderatorTone: m.tone,
      voiceProviderMod: m.voiceProvider,
      voiceIdMod: m.voiceId,
    }));
  }

  function applyPersona(side: "A" | "B", personaId: string) {
    const p = personas.find((x) => x.id === personaId);
    if (!p) return;
    let vp = ((p.voice_provider === "kokoro" || p.voice_provider === "piper" || p.voice_provider === "eleven" || p.voice_provider === "minimax" || p.voice_provider === "replicate") ? p.voice_provider : "kokoro") as VoiceProvider;
    let vid = p.voice_id ?? null;
    // Sem voz real definida → sugere uma voz grátis do gênero da persona.
    if (!vid) {
      const g = personaGenderFrom(p);
      if (g) { const d = defaultVoiceForGender(g); vp = d.provider; vid = d.voiceId; }
    }
    const img = p.image_url ?? null;
    if (side === "A") {
      setForm((f) => ({ ...f, debaterAName: p.name, debaterAPersona: p.persona_prompt, voiceProviderA: vp, voiceIdA: vid, debaterAImageUrl: img }));
    } else {
      setForm((f) => ({ ...f, debaterBName: p.name, debaterBPersona: p.persona_prompt, voiceProviderB: vp, voiceIdB: vid, debaterBImageUrl: img }));
    }
  }


  async function surpriseTopic() {
    setGenTopic(true);
    try {
      const { topic } = await genTopicFn({ data: { hint: form.topic || undefined } });
      setForm((f) => ({ ...f, topic }));
      toast.success("Tema gerado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar tema");
    } finally {
      setGenTopic(false);
    }
  }

  async function generateSides() {
    if (form.topic.trim().length < 3) {
      toast.error("Escreva ou gere um tema primeiro.");
      return;
    }
    setGenSides(true);
    try {
      const r = await genSidesFn({ data: { topic: form.topic } });
      setForm((f) => ({
        ...f,
        debaterAName: r.a.name, debaterAPersona: r.a.persona,
        debaterBName: r.b.name, debaterBPersona: r.b.persona,
      }));
      toast.success("Debatedores opostos gerados!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar debatedores");
    } finally {
      setGenSides(false);
    }
  }

  async function openTopicRoulette() {
    setTopicRouletteOpen(true);
    setTopicOptions([]);
    setTopicOptionsLoading(true);
    try {
      const { options } = await drawTopicsFn();
      setTopicOptions(options);
    } catch {
      setTopicOptions([]);
    } finally {
      setTopicOptionsLoading(false);
    }
  }

  function applyRoulette(a: RoulettePersona, b: RoulettePersona, theme?: string) {
    setForm((f) => ({
      ...f,
      debaterAName: a.name, debaterAPersona: a.persona_prompt, debaterAImageUrl: a.image_url ?? null,
      debaterBName: b.name, debaterBPersona: b.persona_prompt, debaterBImageUrl: b.image_url ?? null,
      ...(theme ? { topic: theme } : {}),
    }));
    toast.success(theme ? `${a.name} × ${b.name} — tema: ${theme}` : `Sorteados: ${a.name} × ${b.name}`);
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await create({ data: { ...form, extras, commentators } });
      toast.success("Debate criado!");
      router.navigate({ to: "/debates/$id", params: { id: result.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  const modelSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {AVAILABLE_MODELS.map((m) => (
          <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <main className="container mx-auto px-4 py-10 max-w-3xl">
      <Reveal>
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Novo debate</h1>
        <p className="text-muted-foreground mb-4">O mediador (IA) escreve as regras a partir desta configuração.</p>
        <AIDisclaimer variant="inline" className="mb-6" />
      </Reveal>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <Label>Formato do programa</Label>
            {form.format !== "duel" && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                Beta — usando engine de duelo por enquanto
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {DEBATE_FORMATS.map((f) => {
              const active = form.format === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    const themes = themesForFormat(f.id);
                    setForm({ ...form, format: f.id, arenaTheme: themes[0]?.id ?? form.arenaTheme });
                    // Já cria a quantidade mínima de convidados do formato (além de A/B).
                    const need = Math.max(0, f.minDebaters - 2);
                    setExtras(Array.from({ length: need }, (_, idx) => makeEmptyExtra(2 + idx)));
                  }}
                  className={`group relative text-left rounded-lg border p-3 transition-all ${
                    active
                      ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                      : "border-border/60 hover:border-border bg-card/40"
                  }`}
                >
                  <div className="text-lg mb-1">{f.emoji}</div>
                  <div className="font-display font-bold text-sm leading-tight">{f.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{f.tagline}</div>
                </button>
              );
            })}
          </div>
          {form.format !== "duel" && (
            <p className="text-xs text-muted-foreground">
              {currentFormat.minDebaters}–{currentFormat.maxDebaters} participantes — os 2 primeiros são os lados A/B; adicione os demais no painel de convidados.
            </p>
          )}

          <div className="space-y-2 pt-2">
            <Label>Cenário da arena</Label>
            <div className="grid grid-cols-2 gap-3">
              {themesForFormat(form.format).map((t) => {
                const active = form.arenaTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm({ ...form, arenaTheme: t.id })}
                    className={`relative aspect-video overflow-hidden rounded-lg border transition ${active ? "border-primary ring-2 ring-primary/40" : "border-border/60 hover:border-border"}`}
                  >
                    <ArenaScene theme={t} />
                    <span className="absolute bottom-1 left-2 z-10 text-[11px] font-semibold text-white drop-shadow">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="topic">Tema do debate</Label>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={openTopicRoulette} className="gap-1.5">
                  <Dices className="h-3.5 w-3.5" /> Sortear tema
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={surpriseTopic} disabled={genTopic} className="gap-1.5 text-primary hover:text-primary">
                  <Wand2 className="h-3.5 w-3.5" /> {genTopic ? "Gerando…" : "Surpreenda-me"}
                </Button>
              </div>
            </div>
            <Textarea
              id="topic" required minLength={3} maxLength={500} rows={2}
              placeholder="Ex: A IA vai substituir empregos criativos?"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="direction">Direcionamento do debate <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea
              id="direction" maxLength={2000} rows={3}
              placeholder="Como o debate deve seguir? Ex: use linguagem simples e acessível; o objetivo é pregar a paz e o entendimento; evite tom agressivo; foque em soluções práticas…"
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Uma instrução que orienta o tom, a linguagem e o objetivo. Todos os participantes e o mediador seguem.
            </p>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Preencher debatedores:</span>
          <Button type="button" variant="outline" size="sm" onClick={generateSides} disabled={genSides} className="gap-1.5">
            <Swords className="h-3.5 w-3.5" /> {genSides ? "Gerando…" : "Gerar lados opostos (IA)"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRouletteOpen(true)} disabled={personas.length < 2} className="gap-1.5" title={personas.length < 2 ? "Precisa de 2+ personas salvas" : "Sortear entre personas salvas"}>
            <Dices className="h-3.5 w-3.5" /> Sortear personas
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 space-y-4 border-l-4 border-l-side-a">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-side-a" /> <span className="text-side-a">Debatedor A</span>
              </h3>
              <Link to="/personas" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> gerenciar
              </Link>
            </div>
            {personas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Carregar persona salva</Label>
                <Select value="" onValueChange={(v) => applyPersona("A", v)}>
                  <SelectTrigger><SelectValue placeholder="Escolher persona…" /></SelectTrigger>
                  <SelectContent>
                    <PersonaSelectItems personas={personas} />
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.debaterAName} onChange={(e) => setForm({ ...form, debaterAName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Personalidade e posição</Label>
              <Textarea rows={5} value={form.debaterAPersona} onChange={(e) => setForm({ ...form, debaterAPersona: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              {modelSelect(form.debaterAModel, (v) => setForm({ ...form, debaterAModel: v }))}
            </div>
          </Card>
          <Card className="p-6 space-y-4 border-l-4 border-l-side-b">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-side-b" /> <span className="text-side-b">Debatedor B</span>
              </h3>
              <Link to="/personas" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> gerenciar
              </Link>
            </div>
            {personas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Carregar persona salva</Label>
                <Select value="" onValueChange={(v) => applyPersona("B", v)}>
                  <SelectTrigger><SelectValue placeholder="Escolher persona…" /></SelectTrigger>
                  <SelectContent>
                    <PersonaSelectItems personas={personas} />
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.debaterBName} onChange={(e) => setForm({ ...form, debaterBName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Personalidade e posição</Label>
              <Textarea rows={5} value={form.debaterBPersona} onChange={(e) => setForm({ ...form, debaterBPersona: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              {modelSelect(form.debaterBModel, (v) => setForm({ ...form, debaterBModel: v }))}
            </div>
          </Card>
        </div>

        <ExtraParticipantsPanel
          format={currentFormat}
          extras={extras}
          setExtras={setExtras}
          personas={personas}
        />



        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Mediador do programa</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {mediators.map((m: MediatorRow) => {
                const active = mediatorId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickMediator(m)}
                    className={`text-left rounded-lg border p-2.5 transition ${active ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border/60 hover:border-border"}`}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <span>{m.gender === "f" ? "👩" : "👨"}</span> {m.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{m.tagline}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Define o estilo, o tom e a voz do apresentador. Você pode ajustar o tom e a voz abaixo.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Modelo do mediador</Label>
            {modelSelect(form.moderatorModel, (v) => setForm({ ...form, moderatorModel: v }))}
          </div>
          <div className="space-y-2">
            <Label>Tom do mediador</Label>
            <Select value={form.moderatorTone} onValueChange={(v) => setForm({ ...form, moderatorTone: v as typeof form.moderatorTone })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="descontraído">Descontraído</SelectItem>
                <SelectItem value="acadêmico">Acadêmico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Rodadas de réplica por bloco: {form.rounds}</Label>
            <Slider min={2} max={6} step={1} value={[form.rounds]} onValueChange={(v) => setForm({ ...form, rounds: v[0] })} />
          </div>
          <div className="space-y-2">
            <Label>Blocos (estilo programa de TV): {form.blocksCount}</Label>
            <Slider min={2} max={6} step={1} value={[form.blocksCount]} onValueChange={(v) => setForm({ ...form, blocksCount: v[0] })} />
            <p className="text-xs text-muted-foreground">
              ≈ {form.blocksCount} blocos × ({1 + 2 + form.rounds * 2} falas) ≈ {Math.round((form.blocksCount * (3 + form.rounds * 2) * 30) / 60)} min. O último bloco é o fechamento + veredito.
            </p>
          </div>
          <div className="flex items-start gap-3 pt-2 border-t">
            <Switch id="dyn" checked={form.dynamicFlow} onCheckedChange={(v) => setForm({ ...form, dynamicFlow: v })} />
            <div className="flex-1">
              <Label htmlFor="dyn" className="cursor-pointer">Fluxo dinâmico (mediador escolhe quem fala)</Label>
              <p className="text-xs text-muted-foreground">Mais natural: o mediador decide a cada turno quem rebate e o quê. Desligado = ordem fixa A/B.</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-display font-semibold mb-1">Vozes</h3>
            <p className="text-xs text-muted-foreground">As vozes podem vir das personas, mas você pode trocar aqui — vale só para este debate. As vozes são filtradas pelo gênero da persona/mediador para evitar trocas.</p>
          </div>
          {(() => {
            const med = mediators.find((m: MediatorRow) => m.id === mediatorId) ?? null;
            const genderA = personaGenderFrom({ name: form.debaterAName, gender: null });
            const genderB = personaGenderFrom({ name: form.debaterBName, gender: null });
            return (
              <>
                <VoicePicker label="Mediador" provider={form.voiceProviderMod} voiceId={form.voiceIdMod}
                  filterGender={med?.gender ?? null}
                  onChange={(p, v) => setForm({ ...form, voiceProviderMod: p, voiceIdMod: v })} />
                <VoicePicker label={form.debaterAName || "Debatedor A"} provider={form.voiceProviderA} voiceId={form.voiceIdA}
                  filterGender={genderA}
                  onChange={(p, v) => setForm({ ...form, voiceProviderA: p, voiceIdA: v })} />
                <VoicePicker label={form.debaterBName || "Debatedor B"} provider={form.voiceProviderB} voiceId={form.voiceIdB}
                  filterGender={genderB}
                  onChange={(p, v) => setForm({ ...form, voiceProviderB: p, voiceIdB: v })} />
              </>
            );
          })()}
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Switch id="comm" checked={commentators.length > 0} onCheckedChange={toggleCommentators} />
            <div className="flex-1">
              <Label htmlFor="comm" className="cursor-pointer">Comentaristas (pós-bloco)</Label>
              <p className="text-xs text-muted-foreground">
                Dois repórteres comentam ao fim de cada bloco — quem foi bem, pontos fortes e fracos — como num debate político.
                {form.dynamicFlow && <span className="text-amber-500"> Desligue o fluxo dinâmico para os comentaristas entrarem.</span>}
              </p>
            </div>
          </div>
          {commentators.map((c, i) => (
            <div key={i} className="rounded-md border border-border/60 p-3 space-y-3 bg-card/40">
              <div className="space-y-1.5">
                <Label>Nome do comentarista {i + 1}</Label>
                <Input value={c.name} onChange={(e) => updateCommentator(i, { name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Estilo / personalidade</Label>
                <Textarea rows={2} value={c.persona} onChange={(e) => updateCommentator(i, { persona: e.target.value })} />
              </div>
              <VoicePicker provider={c.voiceProvider} voiceId={c.voiceId} sampleText={`Olá, eu sou ${c.name || "o comentarista"}.`}
                onChange={(p, v) => updateCommentator(i, { voiceProvider: p, voiceId: v })} />
            </div>
          ))}
        </Card>


        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          <Sparkles className="h-4 w-4 mr-2" />
          {loading ? "Gerando regras…" : "Gerar regras e iniciar"}
        </Button>
      </form>

      <PersonaRoulette
        personas={personas as RoulettePersona[]}
        open={rouletteOpen}
        onOpenChange={setRouletteOpen}
        onPick={applyRoulette}
        onSuggestThemes={(a, b) =>
          matchupFn({ data: { aName: a.name, aPersona: a.persona_prompt, bName: b.name, bPersona: b.persona_prompt } }).then((r) => r.options)
        }
      />

      <Roulette
        open={topicRouletteOpen}
        onOpenChange={setTopicRouletteOpen}
        title="Sortear tema"
        description="Gira entre temas curados e gerados por IA. Caia num e use no debate."
        options={topicOptions}
        loading={topicOptionsLoading}
        confirmLabel="Usar tema"
        onPick={(t) => { setForm((f) => ({ ...f, topic: t })); toast.success("Tema sorteado!"); }}
      />
    </main>
  );
}
