import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPersonas,
  createPersona,
  deletePersona,
  generatePersonaWithAI,
  updatePersona,
} from "@/lib/persona.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Trash2, Plus, Globe, Lock } from "lucide-react";
import { VoicePicker } from "@/components/VoicePicker";
import { type VoiceProvider } from "@/lib/voice-catalog";

export const Route = createFileRoute("/_authenticated/personas")({
  component: PersonasPage,
});

function PersonasPage() {
  const list = useServerFn(listPersonas);
  const create = useServerFn(createPersona);
  const update = useServerFn(updatePersona);
  const remove = useServerFn(deletePersona);
  const generate = useServerFn(generatePersonaWithAI);
  const qc = useQueryClient();

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: () => list(),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    persona_prompt: "",
    is_public: false,
  });
  const [genName, setGenName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState<string>("");
  const [sources, setSources] = useState<Array<{ title: string; url: string }>>([]);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", description: "", persona_prompt: "", is_public: false });
    setSources([]);
  }

  async function handleGenerate() {
    if (genName.trim().length < 2) return;
    setGenerating(true);
    setSources([]);
    // Estágios estimados — a serverFn roda inteira; isso dá feedback visual.
    const stages = [
      "🔎 Gerando queries de busca…",
      "📚 Buscando fontes na web (Firecrawl)…",
      "🧠 Analisando fontes e montando dossiê…",
      "✍️ Encarnando a persona…",
    ];
    setGenStage(stages[0]);
    let idx = 0;
    const tick = setInterval(() => {
      idx = Math.min(idx + 1, stages.length - 1);
      setGenStage(stages[idx]);
    }, 6000);
    try {
      const out = await generate({ data: { name: genName.trim() } });
      setForm({
        name: genName.trim(),
        description: out.description,
        persona_prompt: out.persona_prompt,
        is_public: false,
      });
      setSources(out.sources ?? []);
      setEditingId(null);
      toast.success(
        out.sources?.length
          ? `Persona gerada com ${out.sources.length} fonte(s) — revise e salve.`
          : "Persona gerada (sem fontes web) — revise e salve.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar");
    } finally {
      clearInterval(tick);
      setGenStage("");
      setGenerating(false);
    }
  }


  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await update({ data: { id: editingId, ...form } });
        toast.success("Persona atualizada");
      } else {
        await create({ data: form });
        toast.success("Persona salva");
      }
      resetForm();
      qc.invalidateQueries({ queryKey: ["personas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta persona?")) return;
    try {
      await remove({ data: { id } });
      qc.invalidateQueries({ queryKey: ["personas"] });
      if (editingId === id) resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  function loadIntoForm(p: typeof personas[number]) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      persona_prompt: p.persona_prompt,
      is_public: p.is_public,
    });
  }

  useEffect(() => {
    if (editingId) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [editingId]);

  return (
    <main className="container mx-auto px-4 py-10 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Personas</h1>
        <p className="text-muted-foreground">
          Crie skills de personalidades (Dr. Enéas, Leandro Karnal, Sócrates, um personagem…) e reutilize-as
          como debatedores.
        </p>
      </header>

      <Card className="p-6 mb-6 bg-gradient-to-br from-primary/5 to-transparent">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Gerar com IA a partir do nome
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: Dr. Enéas Carneiro"
            value={genName}
            onChange={(e) => setGenName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          <Button onClick={handleGenerate} disabled={generating || genName.trim().length < 2}>
            {generating ? "Gerando…" : "Gerar"}
          </Button>
        </div>
        {generating && genStage && (
          <p className="text-sm text-muted-foreground mt-3 animate-pulse">{genStage}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          O orquestrador busca fontes na web com Firecrawl, monta um dossiê e gera a persona com citações.
        </p>
        {sources.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Fontes consultadas ({sources.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s, i) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70 truncate max-w-[260px]"
                  title={s.title}
                >
                  [{i + 1}] {s.title || new URL(s.url).hostname}
                </a>
              ))}
            </div>
          </div>
        )}
      </Card>

      <form onSubmit={handleSave}>
        <Card className="p-6 space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Editar persona" : "Nova persona"}</h2>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancelar edição
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              required
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição curta</Label>
            <Input
              maxLength={300}
              placeholder="Ex: Médico e político brasileiro, nacionalista"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Persona prompt (como a IA deve encarnar)</Label>
            <Textarea
              required
              rows={18}
              maxLength={12000}
              className="font-mono text-xs"
              value={form.persona_prompt}
              onChange={(e) => setForm({ ...form, persona_prompt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">{form.persona_prompt.length}/12000 — quanto mais específico (bordões, posições, estilo), mais fiel a encarnação.</p>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t">
            <Switch
              id="pub"
              checked={form.is_public}
              onCheckedChange={(v) => setForm({ ...form, is_public: v })}
            />
            <Label htmlFor="pub" className="cursor-pointer">
              Tornar pública (visível para outros usuários)
            </Label>
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Salvar persona"}
          </Button>
        </Card>
      </form>

      <h2 className="font-semibold mb-3">Minhas personas e públicas</h2>
      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : personas.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma persona ainda.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {personas.map((p) => (
            <Card key={p.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                </div>
                <Badge variant={p.is_public ? "default" : "secondary"} className="shrink-0">
                  {p.is_public ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                  {p.is_public ? "Pública" : "Privada"}
                </Badge>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => loadIntoForm(p)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
