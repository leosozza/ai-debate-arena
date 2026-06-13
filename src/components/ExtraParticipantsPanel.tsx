import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users } from "lucide-react";
import type { DebateFormat, ParticipantRole } from "@/lib/debate-formats";
import type { VoiceProvider } from "@/lib/voice-catalog";
import { PersonaSelectItems } from "@/components/PersonaSelectItems";
import { VoicePicker } from "@/components/VoicePicker";
import { personaGenderFrom, defaultVoiceForGender } from "@/lib/persona-gender";

export type ExtraParticipantDraft = {
  slot: number;
  role: ParticipantRole;
  displayName: string;
  personaId: string | null;
  personaPrompt: string;
  imageUrl: string | null;
  voiceProvider: VoiceProvider | null;
  voiceId: string | null;
  model: string | null;
  team: string | null;
};

type PersonaLite = {
  id: string;
  name: string;
  category?: string | null;
  persona_prompt: string;
  image_url: string | null;
  voice_provider: string | null;
  voice_id: string | null;
  gender?: string | null;
};

export function makeEmptyExtra(slot: number, role: ParticipantRole = "debater"): ExtraParticipantDraft {
  return {
    slot,
    role,
    displayName: "",
    personaId: null,
    personaPrompt: "",
    imageUrl: null,
    voiceProvider: null,
    voiceId: null,
    model: null,
    team: null,
  };
}

type Props = {
  format: DebateFormat;
  extras: ExtraParticipantDraft[];
  setExtras: (next: ExtraParticipantDraft[]) => void;
  personas: PersonaLite[];
};

const ROLE_OPTIONS: Array<{ value: ParticipantRole; label: string }> = [
  { value: "debater", label: "Debatedor / Convidado" },
  { value: "judge", label: "Jurado" },
  { value: "prosecutor", label: "Promotor" },
  { value: "defender", label: "Defensor" },
  { value: "interviewer", label: "Entrevistador" },
  { value: "interviewee", label: "Entrevistado / Réu" },
  { value: "team_a", label: "Time A" },
  { value: "team_b", label: "Time B" },
];

export function ExtraParticipantsPanel({ format, extras, setExtras, personas }: Props) {
  if (format.id === "duel") return null;

  const maxExtras = Math.max(0, format.maxDebaters - 2);
  const canAdd = extras.length < maxExtras;

  function addExtra() {
    const nextSlot = 2 + extras.length;
    setExtras([...extras, makeEmptyExtra(nextSlot)]);
  }

  function update(i: number, patch: Partial<ExtraParticipantDraft>) {
    setExtras(extras.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function remove(i: number) {
    setExtras(extras.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, slot: 2 + idx })));
  }

  function applyPersona(i: number, personaId: string) {
    const p = personas.find((x) => x.id === personaId);
    if (!p) return;
    let vp = (p.voice_provider as VoiceProvider | null) ?? null;
    let vid = p.voice_id ?? null;
    if (!vp || vp === "browser" || !vid) {
      const g = personaGenderFrom(p);
      if (g) { const d = defaultVoiceForGender(g); vp = d.provider; vid = d.voiceId; }
    }
    update(i, {
      personaId: p.id,
      displayName: p.name,
      personaPrompt: p.persona_prompt,
      imageUrl: p.image_url,
      voiceProvider: vp,
      voiceId: vid,
    });
  }

  return (
    <Card className="p-6 space-y-4 border-l-4 border-l-accent">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Convidados extras
          </h3>
          <p className="text-xs text-muted-foreground">
            Slots adicionais além dos dois lados principais. Faixa do formato: {format.minDebaters}–{format.maxDebaters} convidados.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {extras.length}/{maxExtras} extras
        </Badge>
      </div>

      {extras.map((e, i) => (
        <div key={i} className="rounded-md border border-border/60 p-3 space-y-3 bg-card/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Slot {e.slot}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {personas.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Carregar persona salva</Label>
              <Select value={e.personaId ?? ""} onValueChange={(v) => applyPersona(i, v)}>
                <SelectTrigger><SelectValue placeholder="Escolher persona…" /></SelectTrigger>
                <SelectContent>
                  <PersonaSelectItems personas={personas} />
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={e.displayName} onChange={(ev) => update(i, { displayName: ev.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={e.role} onValueChange={(v) => update(i, { role: v as ParticipantRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Personalidade e posição</Label>
            <Textarea rows={3} value={e.personaPrompt} onChange={(ev) => update(i, { personaPrompt: ev.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Voz deste convidado</Label>
            <VoicePicker
              provider={e.voiceProvider}
              voiceId={e.voiceId}
              onChange={(prov, vid) => update(i, { voiceProvider: prov, voiceId: vid })}
              sampleText={`Olá, eu sou ${e.displayName || "um convidado"}.`}
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addExtra}
        disabled={!canAdd}
        className="w-full gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        {canAdd ? "Adicionar convidado" : "Limite do formato atingido"}
      </Button>

    </Card>
  );
}
