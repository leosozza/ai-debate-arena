import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Star } from "lucide-react";
import { HologramAvatar } from "@/components/HologramAvatar";
import { VoicePicker } from "@/components/VoicePicker";
import { listCast, createCast, updateCast, deleteCast, type CastRole, type MediatorRow } from "@/lib/mediators.functions";
import type { VoiceProvider } from "@/lib/voice-catalog";

type Tone = "formal" | "descontraído" | "acadêmico";

interface FormState {
  slug: string;
  name: string;
  gender: "m" | "f";
  tagline: string;
  style: string;
  tone: Tone;
  voice_provider: VoiceProvider;
  voice_id: string;
  avatar_url: string | null;
  is_default: boolean;
  sort_order: number;
}

const EMPTY: FormState = {
  slug: "",
  name: "",
  gender: "m",
  tagline: "",
  style: "",
  tone: "formal",
  voice_provider: "eleven",
  voice_id: "",
  avatar_url: null,
  is_default: false,
  sort_order: 0,
};

function toForm(m: MediatorRow): FormState {
  return {
    slug: m.slug,
    name: m.name,
    gender: m.gender,
    tagline: m.tagline,
    style: m.style,
    tone: m.tone,
    voice_provider: m.voiceProvider,
    voice_id: m.voiceId,
    avatar_url: m.avatarUrl,
    is_default: m.isDefault,
    sort_order: m.sortOrder,
  };
}

export function CastManager({ role }: { role: CastRole }) {
  const list = useServerFn(listCast);
  const create = useServerFn(createCast);
  const update = useServerFn(updateCast);
  const remove = useServerFn(deleteCast);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cast", role],
    queryFn: () => list({ data: { role } }),
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const roleLabel = role === "mediator" ? "mediador" : "comentador";
  const roleLabelCap = role === "mediator" ? "Mediador" : "Comentador";

  function openNew() {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  }
  function openEdit(m: MediatorRow) {
    setEditingId(m.id);
    setForm(toForm(m));
    setShowForm(true);
  }
  function close() {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.voice_id) {
      toast.error("Escolha uma voz");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await update({ data: { id: editingId, ...form, role } });
        toast.success(`${roleLabelCap} atualizado`);
      } else {
        await create({ data: { ...form, role } });
        toast.success(`${roleLabelCap} criado`);
      }
      qc.invalidateQueries({ queryKey: ["cast", role] });
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`Excluir este ${roleLabel}?`)) return;
    try {
      await remove({ data: { id } });
      qc.invalidateQueries({ queryKey: ["cast", role] });
      if (editingId === id) close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">{role === "mediator" ? "Mediadores" : "Comentadores"}</h2>
          <p className="text-sm text-muted-foreground">
            {role === "mediator"
              ? "Apresentadores que conduzem o debate. O programa precisa de pelo menos 1 mediador."
              : "Comentaristas convidados que reagem aos debates. Aparecem nos comentários e análises."}
          </p>
        </div>
        {!showForm && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Novo {roleLabel}
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave}>
          <Card className="p-6 space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editingId ? `Editar ${roleLabel}` : `Novo ${roleLabel}`}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={close}>Cancelar</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Slug <span className="text-muted-foreground font-normal">(único, sem espaços)</span></Label>
                <Input required maxLength={60} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Gênero</Label>
                <div className="flex gap-2">
                  {(["m", "f"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setForm({ ...form, gender: g })}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${form.gender === g ? "border-primary bg-primary/10 ring-1 ring-primary/40 font-semibold" : "border-border/60 hover:border-border"}`}
                    >
                      {g === "m" ? "👨 Masculino" : "👩 Feminino"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tom</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v as Tone })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="descontraído">Descontraído</SelectItem>
                    <SelectItem value="acadêmico">Acadêmico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" min={0} max={9999} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tagline curta <span className="text-muted-foreground font-normal">(mostrada no card)</span></Label>
              <Input maxLength={200} placeholder="Ex: Âncora elegante · telejornal" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Estilo / instrução de personalidade</Label>
              <Textarea
                rows={6}
                maxLength={4000}
                className="font-mono text-xs"
                placeholder={role === "mediator"
                  ? "Como conduz o debate: tom, postura, vocabulário, ritmo, como abre/transita/fecha…"
                  : "Como comenta: ângulo (analítico, irônico, técnico…), vocabulário, foco preferido…"}
                value={form.style}
                onChange={(e) => setForm({ ...form, style: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Foto / avatar (URL)</Label>
              <Input maxLength={2048} placeholder="https://…" value={form.avatar_url ?? ""} onChange={(e) => setForm({ ...form, avatar_url: e.target.value || null })} />
            </div>

            <div className="pt-2 border-t">
              <VoicePicker
                label="Voz"
                provider={form.voice_provider}
                voiceId={form.voice_id}
                onChange={(p, v) => setForm({ ...form, voice_provider: p, voice_id: v ?? "" })}
                filterGender={form.gender}
              />
            </div>

            <div className="flex items-center gap-3 pt-2 border-t">
              <Switch id="def" checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
              <Label htmlFor="def" className="cursor-pointer">Marcar como padrão (sugerido automaticamente em novos debates)</Label>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {saving ? "Salvando…" : editingId ? "Salvar alterações" : `Criar ${roleLabel}`}
            </Button>
          </Card>
        </form>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-muted-foreground">Nenhum {roleLabel} cadastrado.</p>
          {!showForm && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Criar primeiro {roleLabel}</Button>}
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {rows.map((m) => (
            <Card key={m.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <HologramAvatar src={m.avatarUrl} name={m.name} tone={m.gender === "f" ? "pink" : "blue"} size={60} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{m.name}</h3>
                      {m.isDefault && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                    </div>
                    {m.tagline && <p className="text-sm text-muted-foreground line-clamp-2">{m.tagline}</p>}
                    <div className="flex gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px]">{m.gender === "f" ? "♀" : "♂"} {m.tone}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{m.voiceProvider}</Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(m)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
