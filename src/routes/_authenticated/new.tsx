import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createDebate } from "@/lib/debate.functions";
import { AVAILABLE_MODELS } from "@/lib/ai-models";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Reveal } from "@/components/Reveal";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/new")({
  component: NewDebate,
});

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

function NewDebate() {
  const router = useRouter();
  const create = useServerFn(createDebate);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    topic: "",
    debaterAName: "Aurora",
    debaterAPersona: "Defensora apaixonada da tecnologia, otimista quanto ao futuro da IA.",
    debaterAModel: DEFAULT_MODEL,
    debaterBName: "Cético",
    debaterBPersona: "Crítico cauteloso, preocupado com impactos sociais e éticos.",
    debaterBModel: DEFAULT_MODEL,
    moderatorModel: DEFAULT_MODEL,
    moderatorTone: "formal" as "formal" | "descontraído" | "acadêmico",
    rounds: 3,
    dynamicFlow: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await create({ data: form });
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
        <p className="text-muted-foreground mb-8">O mediador (IA) escreve as regras a partir desta configuração.</p>
      </Reveal>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Tema do debate</Label>
            <Textarea
              id="topic" required minLength={3} maxLength={500} rows={2}
              placeholder="Ex: A IA vai substituir empregos criativos?"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 space-y-4 border-l-4 border-l-side-a">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-side-a" /> <span className="text-side-a">Debatedor A</span>
            </h3>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.debaterAName} onChange={(e) => setForm({ ...form, debaterAName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Personalidade e posição</Label>
              <Textarea rows={3} value={form.debaterAPersona} onChange={(e) => setForm({ ...form, debaterAPersona: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              {modelSelect(form.debaterAModel, (v) => setForm({ ...form, debaterAModel: v }))}
            </div>
          </Card>
          <Card className="p-6 space-y-4 border-l-4 border-l-side-b">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-side-b" /> <span className="text-side-b">Debatedor B</span>
            </h3>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.debaterBName} onChange={(e) => setForm({ ...form, debaterBName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Personalidade e posição</Label>
              <Textarea rows={3} value={form.debaterBPersona} onChange={(e) => setForm({ ...form, debaterBPersona: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              {modelSelect(form.debaterBModel, (v) => setForm({ ...form, debaterBModel: v }))}
            </div>
          </Card>
        </div>

        <Card className="p-6 space-y-4">
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
            <Label>Rodadas de réplica: {form.rounds}</Label>
            <Slider min={2} max={6} step={1} value={[form.rounds]} onValueChange={(v) => setForm({ ...form, rounds: v[0] })} />
          </div>
          <div className="flex items-start gap-3 pt-2 border-t">
            <Switch id="dyn" checked={form.dynamicFlow} onCheckedChange={(v) => setForm({ ...form, dynamicFlow: v })} />
            <div className="flex-1">
              <Label htmlFor="dyn" className="cursor-pointer">Fluxo dinâmico (mediador escolhe quem fala)</Label>
              <p className="text-xs text-muted-foreground">Mais natural: o mediador decide a cada turno quem rebate e o quê. Desligado = ordem fixa A/B.</p>
            </div>
          </div>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          <Sparkles className="h-4 w-4 mr-2" />
          {loading ? "Gerando regras…" : "Gerar regras e iniciar"}
        </Button>
      </form>
    </main>
  );
}
