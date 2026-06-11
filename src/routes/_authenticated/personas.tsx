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
import { Sparkles, Trash2, Plus, Globe, Lock, Mic, User, Library } from "lucide-react";
import { VoicePicker, DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "@/components/VoicePicker";
import { VoiceClonePanel } from "@/components/VoiceClonePanel";
import { PersonaImagePanel } from "@/components/PersonaImagePanel";
import { PersonaVideoPanel } from "@/components/PersonaVideoPanel";
import { attachVoiceToPersona } from "@/lib/voice-clone.functions";
import { type VoiceProvider } from "@/lib/voice-catalog";
import { seedHistoricalPersonas } from "@/lib/persona-seed.functions";
import { PERSONA_CATEGORIES } from "@/lib/persona-seed-data";
import { PERSONA_ANCHOR_IMAGES } from "@/lib/persona-anchor-images";

export const Route = createFileRoute("/_authenticated/personas")({
  component: PersonasPage,
});

type FormState = {
  name: string;
  description: string;
  persona_prompt: string;
  is_public: boolean;
  voice_provider: VoiceProvider | null;
  voice_id: string | null;
  image_url: string | null;
  vignette_url: string | null;
  voice_settings: VoiceSettings;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  persona_prompt: "",
  is_public: false,
  voice_provider: null,
  voice_id: null,
  image_url: null,
  vignette_url: null,
  voice_settings: DEFAULT_VOICE_SETTINGS,
};

function PersonasPage() {
  const list = useServerFn(listPersonas);
  const create = useServerFn(createPersona);
  const update = useServerFn(updatePersona);
  const remove = useServerFn(deletePersona);
  const generate = useServerFn(generatePersonaWithAI);
  const attachVoice = useServerFn(attachVoiceToPersona);
  const seed = useServerFn(seedHistoricalPersonas);
  const [seeding, setSeeding] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: () => list(),
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [genName, setGenName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState<string>("");
  const [sources, setSources] = useState<Array<{ title: string; url: string }>>([]);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSources([]);
    setShowForm(true);
  }

  function closeForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSources([]);
    setShowForm(false);
  }

  async function handleGenerate() {
    if (genName.trim().length < 2) return;
    setGenerating(true);
    setSources([]);
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
        ...EMPTY_FORM,
        name: genName.trim(),
        description: out.description,
        persona_prompt: out.persona_prompt,
      });
      setSources(out.sources ?? []);
      setEditingId(null);
      setShowForm(true);
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
      closeForm();
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
      if (editingId === id) closeForm();
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
      voice_provider: (p.voice_provider as VoiceProvider | null) ?? null,
      voice_id: p.voice_id ?? null,
      image_url: p.image_url ?? null,
      vignette_url: (p as { vignette_url?: string | null }).vignette_url ?? null,
      voice_settings: (p.voice_settings as VoiceSettings | null) ?? DEFAULT_VOICE_SETTINGS,
    });
    setSources([]);
    setShowForm(true);
  }

  useEffect(() => {
    if (showForm) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [showForm, editingId]);

  return (
    <main className="container mx-auto px-4 py-10 max-w-5xl">
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">Personas</h1>
          <p className="text-muted-foreground">
            Crie skills de personalidades (Dr. Enéas, Leandro Karnal, Sócrates, um personagem…) e reutilize-as
            como debatedores.
          </p>
        </div>
        {!showForm && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="lg"
              disabled={seeding}
              onClick={async () => {
                if (!confirm("Popular catálogo com ~60 personas históricas públicas? Personas existentes com o mesmo nome serão atualizadas (a foto é preservada).")) return;
                setSeeding(true);
                try {
                  const out = await seed({ data: { imageUrls: PERSONA_ANCHOR_IMAGES } });
                  toast.success(`Catálogo pronto: ${out.created} criadas, ${out.updated} atualizadas.`);
                  qc.invalidateQueries({ queryKey: ["personas"] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha ao popular");
                } finally {
                  setSeeding(false);
                }
              }}
            >
              <Library className="h-4 w-4 mr-2" />
              {seeding ? "Populando…" : "Popular catálogo histórico"}
            </Button>
            <Button onClick={openNew} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Nova persona
            </Button>
          </div>
        )}
      </header>

      {showForm && (
        <>
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
                <Button type="button" variant="ghost" size="sm" onClick={closeForm}>
                  {editingId ? "Cancelar edição" : "Cancelar"}
                </Button>
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

              <PersonaImagePanel
                name={form.name}
                description={form.description}
                value={form.image_url}
                onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              />

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
              <div className="pt-2 border-t space-y-3">
                <VoicePicker
                  label="Voz padrão da persona"
                  provider={form.voice_provider}
                  voiceId={form.voice_id}
                  onChange={(p, v) => setForm({ ...form, voice_provider: p, voice_id: v })}
                  settings={form.voice_settings}
                  onSettingsChange={(vs) => setForm((f) => ({ ...f, voice_settings: vs }))}
                />

                <p className="text-[11px] text-muted-foreground">Usada automaticamente quando esta persona for escolhida num debate. Pode ser sobrescrita.</p>

                <VoiceClonePanel
                  defaultName={form.name || undefined}
                  onCloned={async ({ provider, voiceId, source, cloneName }) => {
                    setForm((f) => ({ ...f, voice_provider: provider, voice_id: voiceId }));
                    if (editingId) {
                      try {
                        await attachVoice({ data: { personaId: editingId, provider, voiceId, source, cloneName } });
                        qc.invalidateQueries({ queryKey: ["personas"] });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Falha ao salvar voz na persona");
                      }
                    }
                  }}
                />
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
        </>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Minhas personas e públicas</h2>
        {!showForm && personas.length > 0 && (
          <span className="text-xs text-muted-foreground">{personas.length} persona(s)</span>
        )}
      </div>

      {!showForm && personas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${categoryFilter === null ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
          >
            Todas
          </button>
          {PERSONA_CATEGORIES.map((c) => {
            const count = personas.filter((p) => p.category === c.id).length;
            if (count === 0) return null;
            const active = categoryFilter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(active ? null : c.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
              >
                {c.emoji} {c.label} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : personas.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-muted-foreground">Nenhuma persona ainda.</p>
          {!showForm && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> Criar primeira persona
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {personas
            .filter((p) => (categoryFilter ? p.category === categoryFilter : true))
            .map((p) => (
            <Card key={p.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-border bg-muted/40 flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{p.name}</h3>
                    {p.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={p.is_public ? "default" : "secondary"}>
                    {p.is_public ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                    {p.is_public ? "Pública" : "Privada"}
                  </Badge>
                  {p.voice_clone_source && (
                    <Badge variant="outline" className="text-[10px]" title={p.voice_clone_name ?? ""}>
                      <Mic className="h-3 w-3 mr-1" />
                      {p.voice_clone_source === "manual" ? "Voz manual" : p.voice_clone_source === "upload-eleven" ? "Voz ElevenLabs" : p.voice_clone_source === "upload-replicate" ? "Voz Replicate" : "Voz MiniMax"}
                    </Badge>
                  )}
                </div>
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
