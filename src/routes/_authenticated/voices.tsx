import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  listVoicePresets,
  createVoicePresetFromUpload,
  deleteVoicePreset,
} from "@/lib/voice-presets.functions";
import { replicateTts } from "@/lib/voice-replicate.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Trash2, Upload, Mic } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/voices")({
  component: VoicesPage,
  head: () => ({ meta: [{ title: "Vozes personalizadas · Arena de Debates" }] }),
});

function VoicesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listVoicePresets);
  const create = useServerFn(createVoicePresetFromUpload);
  const remove = useServerFn(deleteVoicePreset);
  const tts = useServerFn(replicateTts);

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["voice-presets"],
    queryFn: () => list(),
  });

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isRealPerson, setIsRealPerson] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Selecione um arquivo de áudio (10–60s).");
    if (!name.trim()) return toast.error("Dê um nome ao preset.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("is_real_person", String(isRealPerson));
      fd.append("notes", notes.trim());
      fd.append("file", file);
      await create({ data: fd });
      toast.success("Preset criado!");
      setName(""); setNotes(""); setIsRealPerson(false);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["voice-presets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar preset");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Apagar este preset?")) return;
    try {
      await remove({ data: { id } });
      qc.invalidateQueries({ queryKey: ["voice-presets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao apagar");
    }
  }

  async function onPlay(id: string, voiceUrl: string, presetName: string) {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    try {
      const res = await tts({
        data: {
          text: `Olá, eu sou ${presetName}. Esta é uma demonstração de voz clonada por inteligência artificial.`,
          voiceId: voiceUrl,
        },
      });
      const audio = new Audio(`data:${res.mime};base64,${res.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      await audio.play();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao tocar");
      setPlayingId(null);
    }
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Mic className="h-7 w-7" /> Vozes personalizadas
        </h1>
        <p className="text-sm text-muted-foreground">
          Faça upload de uma amostra de áudio (10–60s, fala clara, MP3/WAV) e o sistema clona a voz via Replicate XTTS-v2.
          Use depois em qualquer persona escolhendo provedor <strong>Replicate</strong>.
        </p>
      </header>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do preset</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Silvio Santos, Locutor grave, Avó carinhosa…"
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Amostra de áudio (10–60s, máx. 12MB)</Label>
            <Input ref={fileRef} type="file" accept="audio/*" required />
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Origem da amostra, contexto de uso…"
              maxLength={500}
              rows={2}
            />
          </div>
          <div className="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
            <Switch checked={isRealPerson} onCheckedChange={setIsRealPerson} id="rp" />
            <div className="space-y-1">
              <Label htmlFor="rp" className="cursor-pointer">É a voz de uma pessoa real (figura pública)?</Label>
              <p className="text-xs text-muted-foreground">
                Marca esta opção se for clone de uma pessoa real (ex.: político, celebridade). O sistema adiciona automaticamente
                o rótulo <strong>"Voz simulada por IA"</strong> em todo o app. Use apenas em contexto satírico/educativo
                claramente identificado — clonar voz de pessoas reais sem autorização pode violar LGPD e direitos de personalidade.
              </p>
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Criar preset
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Meus presets ({presets.length})</h2>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {!isLoading && presets.length === 0 && (
          <p className="text-sm text-muted-foreground">Ainda nenhum preset. Crie o primeiro acima.</p>
        )}
        {presets.map((p) => (
          <Card key={p.id} className="p-4 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{p.name}</span>
                {p.is_real_person && <Badge variant="outline" className="text-yellow-700 border-yellow-500/50">🎭 Voz simulada por IA</Badge>}
              </div>
              {p.notes && <p className="text-xs text-muted-foreground line-clamp-1">{p.notes}</p>}
              <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="outline" onClick={() => onPlay(p.id, p.voice_url, p.name)} disabled={playingId !== null && playingId !== p.id}>
                {playingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" onClick={() => onDelete(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
