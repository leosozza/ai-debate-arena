import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getDebate, updateDebate } from "@/lib/debate.functions";
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
import { type VoiceProvider } from "@/lib/voice-catalog";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/debates/$id/edit")({
  component: EditDebate,
});

function EditDebate() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(getDebate);
  const update = useServerFn(updateDebate);
  const { data } = useQuery({ queryKey: ["debate", id], queryFn: () => get({ data: { id } }) });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    topic: "",
    debaterAName: "",
    debaterAPersona: "",
    debaterAModel: "google/gemini-3-flash-preview",
    debaterBName: "",
    debaterBPersona: "",
    debaterBModel: "google/gemini-3-flash-preview",
    moderatorModel: "google/gemini-3-flash-preview",
    moderatorTone: "formal" as "formal" | "descontraído" | "acadêmico",
    rounds: 3,
    blocksCount: 4,
    dynamicFlow: false,
    voiceProviderMod: "browser" as VoiceProvider,
    voiceIdMod: null as string | null,
    voiceProviderA: "browser" as VoiceProvider,
    voiceIdA: null as string | null,
    voiceProviderB: "browser" as VoiceProvider,
    voiceIdB: null as string | null,
  });

  useEffect(() => {
    if (!data) return;
    const d = data.debate;
    setForm({
      topic: d.topic,
      debaterAName: d.debater_a_name,
      debaterAPersona: d.debater_a_persona,
      debaterAModel: d.debater_a_model,
      debaterBName: d.debater_b_name,
      debaterBPersona: d.debater_b_persona,
      debaterBModel: d.debater_b_model,
      moderatorModel: d.moderator_model,
      moderatorTone: d.moderator_tone as "formal" | "descontraído" | "acadêmico",
      rounds: d.rounds,
      dynamicFlow: d.dynamic_flow,
      voiceProviderMod: ((d.voice_provider_mod as VoiceProvider | null) ?? "browser"),
      voiceIdMod: d.voice_id_mod ?? null,
      voiceProviderA: ((d.voice_provider_a as VoiceProvider | null) ?? "browser"),
      voiceIdA: d.voice_id_a ?? null,
      voiceProviderB: ((d.voice_provider_b as VoiceProvider | null) ?? "browser"),
      voiceIdB: d.voice_id_b ?? null,
    });
  }, [data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await update({ data: { id, ...form } });
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
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 space-y-4 border-l-4 border-l-side-a">
            <h3 className="font-display font-semibold text-side-a">Debatedor A</h3>
            <div className="space-y-2"><Label>Nome</Label><Input value={form.debaterAName} onChange={(e) => setForm({ ...form, debaterAName: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Persona</Label><Textarea rows={5} value={form.debaterAPersona} onChange={(e) => setForm({ ...form, debaterAPersona: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Modelo</Label>{modelSelect(form.debaterAModel, (v) => setForm({ ...form, debaterAModel: v }))}</div>
          </Card>
          <Card className="p-6 space-y-4 border-l-4 border-l-side-b">
            <h3 className="font-display font-semibold text-side-b">Debatedor B</h3>
            <div className="space-y-2"><Label>Nome</Label><Input value={form.debaterBName} onChange={(e) => setForm({ ...form, debaterBName: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Persona</Label><Textarea rows={5} value={form.debaterBPersona} onChange={(e) => setForm({ ...form, debaterBPersona: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Modelo</Label>{modelSelect(form.debaterBModel, (v) => setForm({ ...form, debaterBModel: v }))}</div>
          </Card>
        </div>

        <Card className="p-6 space-y-4">
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
          <div className="space-y-2"><Label>Rodadas: {form.rounds}</Label><Slider min={2} max={6} step={1} value={[form.rounds]} onValueChange={(v) => setForm({ ...form, rounds: v[0] })} /></div>
          <div className="flex items-center gap-3 pt-2 border-t">
            <Switch id="dyn" checked={form.dynamicFlow} onCheckedChange={(v) => setForm({ ...form, dynamicFlow: v })} />
            <Label htmlFor="dyn">Fluxo dinâmico</Label>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-display font-semibold">Vozes</h3>
          <VoicePicker label="Mediador" provider={form.voiceProviderMod} voiceId={form.voiceIdMod} onChange={(p, v) => setForm({ ...form, voiceProviderMod: p, voiceIdMod: v })} />
          <VoicePicker label={form.debaterAName} provider={form.voiceProviderA} voiceId={form.voiceIdA} onChange={(p, v) => setForm({ ...form, voiceProviderA: p, voiceIdA: v })} />
          <VoicePicker label={form.debaterBName} provider={form.voiceProviderB} voiceId={form.voiceIdB} onChange={(p, v) => setForm({ ...form, voiceProviderB: p, voiceIdB: v })} />
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </form>
    </main>
  );
}
