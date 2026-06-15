import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Upload, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cloneVoiceEleven, cloneVoiceMinimax } from "@/lib/voice-clone.functions";
import { cloneVoiceReplicate } from "@/lib/voice-replicate.functions";
import type { VoiceProvider } from "@/lib/voice-catalog";

interface Props {
  defaultName?: string;
  onCloned: (result: { provider: VoiceProvider; voiceId: string; source: "upload-eleven" | "upload-minimax" | "upload-replicate" | "manual"; cloneName: string }) => void;
}

export function VoiceClonePanel({ defaultName, onCloned }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState(defaultName ?? "");
  const [busy, setBusy] = useState<null | "eleven" | "minimax" | "replicate">(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const [manualProvider, setManualProvider] = useState<"eleven" | "minimax" | "replicate">("replicate");
  const [manualId, setManualId] = useState("");

  const cloneEl = useServerFn(cloneVoiceEleven);
  const cloneMm = useServerFn(cloneVoiceMinimax);
  const cloneRp = useServerFn(cloneVoiceReplicate);

  const totalMb = files.reduce((s, f) => s + f.size, 0) / (1024 * 1024);

  async function run(provider: "eleven" | "minimax" | "replicate") {
    if (files.length === 0) {
      toast.error("Escolha pelo menos 1 arquivo de áudio.");
      return;
    }
    const cloneName = (name || defaultName || "Voz personalizada").trim();
    const fd = new FormData();
    fd.append("name", cloneName);
    for (const f of files) fd.append("files", f, f.name);
    setBusy(provider);
    setLastError(null);
    try {
      const fn = provider === "eleven" ? cloneEl : provider === "minimax" ? cloneMm : cloneRp;
      const res = await fn({ data: fd as unknown as never });
      const label = provider === "eleven" ? "ElevenLabs" : provider === "minimax" ? "MiniMax" : "Replicate";
      toast.success(`Voz clonada (${label})`);
      onCloned({
        provider: res.provider,
        voiceId: res.voiceId,
        source: provider === "eleven" ? "upload-eleven" : provider === "minimax" ? "upload-minimax" : "upload-replicate",
        cloneName,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao clonar";
      setLastError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  function applyManual() {
    const id = manualId.trim();
    if (id.length < 3) {
      toast.error("Cole um Voice ID válido.");
      return;
    }
    onCloned({
      provider: manualProvider,
      voiceId: id,
      source: "manual",
      cloneName: (name || defaultName || "Voz manual").trim(),
    });
    toast.success("Voice ID aplicado");
    setManualId("");
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Clonar voz a partir de áudio</h3>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Áudios da pessoa (mp3, wav, m4a) — fala clara, 30s a 10min</Label>
        <Input
          type="file"
          accept="audio/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6))}
        />
        {files.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {files.length} arquivo(s) · {totalMb.toFixed(1)} MB
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Rótulo</Label>
        <Input
          maxLength={80}
          placeholder="Ex: Dr. Enéas (voz real)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => run("replicate")}
          disabled={busy !== null || files.length === 0}
        >
          {busy === "replicate" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
          Clonar com Fish Audio (Replicate)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => run("eleven")}
          disabled={busy !== null || files.length === 0}
        >
          {busy === "eleven" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
          ElevenLabs
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => run("minimax")}
          disabled={busy !== null || files.length === 0}
        >
          {busy === "minimax" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
          MiniMax
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Fish Audio: zero-shot premium, 10–30s de fala limpa em PT-BR. Em caso de falha, tenta XTTS-v2 e Chatterbox automaticamente.
      </p>

      {lastError && (
        <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      <div className="border-t border-border/60 pt-3 space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ou cole um Voice ID existente</Label>
        <div className="flex gap-2">
          <Select value={manualProvider} onValueChange={(v) => setManualProvider(v as "eleven" | "minimax" | "replicate")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="replicate">Replicate</SelectItem>
              <SelectItem value="eleven">ElevenLabs</SelectItem>
              <SelectItem value="minimax">MiniMax</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="voice_id"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          />
          <Button type="button" size="sm" variant="secondary" onClick={applyManual}>
            <Check className="h-3.5 w-3.5 mr-1" /> Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}
