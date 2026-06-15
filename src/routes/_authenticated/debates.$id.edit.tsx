import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getDebate, updateDebate } from "@/lib/debate.functions";
import { listPersonas } from "@/lib/persona.functions";
import { listMediators, type MediatorRow } from "@/lib/mediators.functions";
import { AVAILABLE_MODELS } from "@/lib/ai-models";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { VoicePicker } from "@/components/VoicePicker";
import { PersonaSelectItems } from "@/components/PersonaSelectItems";
import { type VoiceProvider, normalizeProvider } from "@/lib/voice-catalog";
import { personaGenderFrom, defaultVoiceForGender } from "@/lib/persona-gender";
import { toast } from "sonner";
import { Save, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/debates/$id/edit")({
  component: EditDebate,
});

type Commentator = { name: string; persona: string; voiceProvider: VoiceProvider | null; voiceId: string | null };

function EditDebate() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(getDebate);
  const update = useServerFn(updateDebate);
  const qc = useQueryClient();
  const listP = useServerFn(listPersonas);
  const listMed = useServerFn(listMediators);
  const { data } = useQuery({ queryKey: ["debate", id], queryFn: () => get({ data: { id } }) });
  const { data: personas = [] } = useQuery({ queryKey: ["personas"], queryFn: () => listP() });
  const { data: mediators = [] } = useQuery({ queryKey: ["mediators"], queryFn: () => listMed(), staleTime: 5 * 60_000 });
  const [saving, setSaving] = useState(false);
  const [mediatorId, setMediatorId] = useState<string | null>(null);
  const [commentators, setCommentators] = useState<Commentator[]>([]);
  const [form, setForm] = useState({
    topic: "",
    direction: "",
    debaterAName: "",
    debaterAPersona: "",
    debaterAModel: "google/gemini-3-flash-preview",
    debaterAImageUrl: null as string | null,
    debaterBName: "",
    debaterBPersona: "",
    debaterBModel: "google/gemini-3-flash-preview",
    debaterBImageUrl: null as string | null,
    moderatorModel: "google/gemini-3-flash-preview",
    moderatorTone: "formal" as "formal" | "descontraído" | "acadêmico",
    moderatorName: null as string | null,
    moderatorStyle: null as string | null,
    rounds: 3,
    blocksCount: 4,
    dynamicFlow: false,
    voiceProviderMod: "eleven" as VoiceProvider,
    voiceIdMod: "21m00Tcm4TlvDq8ikWAM" as string | null,
    voiceProviderA: "eleven" as VoiceProvider,
    voiceIdA: "pNInz6obpgDQGcFmaJgB" as string | null,
    voiceProviderB: "eleven" as VoiceProvider,
    voiceIdB: "ErXwobaYiN019PkySvjV" as string | null,
  });

  useEffect(() => {
    if (!data) return;
    const d = data.debate as typeof data.debate & {
      direction?: string | null;
      moderator_name?: string | null;
      moderator_style?: string | null;
      debater_a_image_url?: string | null;
      debater_b_image_url?: string | null;
      commentators?: unknown;
    };
    setForm({
      topic: d.topic,
      direction: d.direction ?? "",
      debaterAName: d.debater_a_name,
      debaterAPersona: d.debater_a_persona,
      debaterAModel: d.debater_a_model,
      debaterAImageUrl: d.debater_a_image_url ?? null,
      debaterBName: d.debater_b_name,
      debaterBPersona: d.debater_b_persona,
      debaterBModel: d.debater_b_model,
      debaterBImageUrl: d.debater_b_image_url ?? null,
      moderatorModel: d.moderator_model,
      moderatorTone: d.moderator_tone as "formal" | "descontraído" | "acadêmico",
      moderatorName: d.moderator_name ?? null,
      moderatorStyle: d.moderator_style ?? null,
      rounds: d.rounds,
      blocksCount: d.blocks_count ?? 4,
      dynamicFlow: d.dynamic_flow,
      voiceProviderMod: normalizeProvider(d.voice_provider_mod),
      voiceIdMod: d.voice_id_mod ?? null,
      voiceProviderA: normalizeProvider(d.voice_provider_a),
      voiceIdA: d.voice_id_a ?? null,
      voiceProviderB: normalizeProvider(d.voice_provider_b),
      voiceIdB: d.voice_id_b ?? null,
    });
    if (Array.isArray(d.commentators)) {
      const cs = (d.commentators as Array<{ name?: string; persona?: string; voiceProvider?: string | null; voiceId?: string | null }>).map((c) => ({
        name: c.name ?? "",
        persona: c.persona ?? "",
        voiceProvider: (c.voiceProvider ? normalizeProvider(c.voiceProvider) : null) as VoiceProvider | null,
        voiceId: c.voiceId ?? null,
      }));
      setCommentators(cs.slice(0, 2));
    } else {
      setCommentators([]);
    }
    // Try to match current moderator to one of the saved mediators by name.
    if (d.moderator_name) {
      const found = mediators.find((m) => m.name === d.moderator_name);
      if (found) setMediatorId(found.id);
    }
  }, [data, mediators]);

  function applyPersona(side: "A" | "B", personaId: string) {
    const p = personas.find((x) => x.id === personaId);
    if (!p) return;
    let vp = ((p.voice_provider === "kokoro" || p.voice_provider === "piper" || p.voice_provider === "eleven" || p.voice_provider === "minimax" || p.voice_provider === "replicate") ? p.voice_provider : "eleven") as VoiceProvider;
    let vid = p.voice_id ?? null;
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

  function toggleCommentators(on: boolean) {
    setCommentators(on
      ? [
          { name: "Repórter 1", persona: "Comentarista esportivo de debates, analítico e direto.", voiceProvider: "eleven", voiceId: "pNInz6obpgDQGcFmaJgB" },
          { name: "Repórter 2", persona: "Comentarista perspicaz, foca em retórica e impacto no público.", voiceProvider: "eleven", voiceId: "EXAVITQu4vr4xnSDxMaL" },
        ]
      : []);
  }
  function updateCommentator(i: number, patch: Partial<Commentator>) {
    setCommentators((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await update({ data: { id, ...form, commentators } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["debate", id] }),
        qc.invalidateQueries({ queryKey: ["debates"] }),
      ]);
      toast.success("Debate atualizado");
      router.navigate({ to: "/debates/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const modelSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {AVAILABLE_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  if (!data) return <main className="container mx-auto px-4 py-10">Carregando…</main>;

  const med = mediators.find((m) => m.id === mediatorId) ?? null;
  const genderA = personaGenderFrom({ name: form.debaterAName, gender: null });
  const genderB = personaGenderFrom({ name: form.debaterBName, gender: null });

  return (
    <main className="container mx-auto px-4 py-10 max-w-3xl">
      <button onClick={() => router.navigate({ to: "/debates/$id", params: { id } })} className="text-sm text-muted-foreground hover:text-foreground mb-4">← Voltar</button>
      <h1 className="font-display text-3xl font-bold mb-2">Editar debate</h1>
      <p className="text-muted-foreground mb-6 text-sm">Falas já geradas não são afetadas. Vozes valem para a próxima reprodução.</p>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Tema</Label>
            <Textarea rows={2} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Direcionamento do debate <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea rows={3} maxLength={2000} placeholder="Como o debate deve seguir? Ex: linguagem simples, foco em soluções práticas…" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} />
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 space-y-4 border-l-4 border-l-side-a">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-side-a">Debatedor A</h3>
              <Link to="/personas" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> gerenciar
              </Link>
            </div>
            {personas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Carregar persona salva</Label>
                <Select value="" onValueChange={(v) => applyPersona("A", v)}>
                  <SelectTrigger><SelectValue placeholder="Escolher persona…" /></SelectTrigger>
                  <SelectContent><PersonaSelectItems personas={personas} /></SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>Nome</Label><Input value={form.debaterAName} onChange={(e) => setForm({ ...form, debaterAName: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Persona</Label><Textarea rows={5} value={form.debaterAPersona} onChange={(e) => setForm({ ...form, debaterAPersona: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Modelo</Label>{modelSelect(form.debaterAModel, (v) => setForm({ ...form, debaterAModel: v }))}</div>
          </Card>
          <Card className="p-6 space-y-4 border-l-4 border-l-side-b">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-side-b">Debatedor B</h3>
              <Link to="/personas" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> gerenciar
              </Link>
            </div>
            {personas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Carregar persona salva</Label>
                <Select value="" onValueChange={(v) => applyPersona("B", v)}>
                  <SelectTrigger><SelectValue placeholder="Escolher persona…" /></SelectTrigger>
                  <SelectContent><PersonaSelectItems personas={personas} /></SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>Nome</Label><Input value={form.debaterBName} onChange={(e) => setForm({ ...form, debaterBName: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Persona</Label><Textarea rows={5} value={form.debaterBPersona} onChange={(e) => setForm({ ...form, debaterBPersona: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Modelo</Label>{modelSelect(form.debaterBModel, (v) => setForm({ ...form, debaterBModel: v }))}</div>
          </Card>
        </div>

        <Card className="p-6 space-y-4">
          {mediators.length > 0 && (
            <div className="space-y-2">
              <Label>Mediador do programa</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {mediators.map((m) => {
                  const active = mediatorId === m.id;
                  return (
                    <button key={m.id} type="button" onClick={() => pickMediator(m)}
                      className={`text-left rounded-lg border p-2.5 transition ${active ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border/60 hover:border-border"}`}>
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <span>{m.gender === "f" ? "👩" : "👨"}</span> {m.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{m.tagline}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Define o estilo, o tom e a voz do apresentador.</p>
            </div>
          )}
          <div className="space-y-2"><Label>Modelo do mediador</Label>{modelSelect(form.moderatorModel, (v) => setForm({ ...form, moderatorModel: v }))}</div>
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
          <div className="space-y-2"><Label>Rodadas por bloco: {form.rounds}</Label><Slider min={2} max={6} step={1} value={[form.rounds]} onValueChange={(v) => setForm({ ...form, rounds: v[0] })} /></div>
          <div className="space-y-2">
            <Label>Blocos: {form.blocksCount}</Label>
            <Slider min={2} max={6} step={1} value={[form.blocksCount]} onValueChange={(v) => setForm({ ...form, blocksCount: v[0] })} />
            <p className="text-xs text-muted-foreground">Mudar rodadas ou blocos só é possível antes da primeira fala ser gerada.</p>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t">
            <Switch id="dyn" checked={form.dynamicFlow} onCheckedChange={(v) => setForm({ ...form, dynamicFlow: v })} />
            <Label htmlFor="dyn">Fluxo dinâmico</Label>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-display font-semibold">Vozes</h3>
          <VoicePicker label="Mediador" provider={form.voiceProviderMod} voiceId={form.voiceIdMod} filterGender={med?.gender ?? null} onChange={(p, v) => setForm({ ...form, voiceProviderMod: p, voiceIdMod: v })} />
          <VoicePicker label={form.debaterAName || "Debatedor A"} provider={form.voiceProviderA} voiceId={form.voiceIdA} filterGender={genderA} onChange={(p, v) => setForm({ ...form, voiceProviderA: p, voiceIdA: v })} />
          <VoicePicker label={form.debaterBName || "Debatedor B"} provider={form.voiceProviderB} voiceId={form.voiceIdB} filterGender={genderB} onChange={(p, v) => setForm({ ...form, voiceProviderB: p, voiceIdB: v })} />
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Switch id="comm" checked={commentators.length > 0} onCheckedChange={toggleCommentators} />
            <div className="flex-1">
              <Label htmlFor="comm" className="cursor-pointer">Comentaristas (pós-bloco)</Label>
              <p className="text-xs text-muted-foreground">Dois repórteres comentam ao fim de cada bloco — quem foi bem, pontos fortes e fracos.</p>
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
              <VoicePicker provider={c.voiceProvider} voiceId={c.voiceId} sampleText={`Olá, eu sou ${c.name || "o comentarista"}.`} onChange={(p, v) => updateCommentator(i, { voiceProvider: p, voiceId: v })} />
            </div>
          ))}
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </form>
    </main>
  );
}
