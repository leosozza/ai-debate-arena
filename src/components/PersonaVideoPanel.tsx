import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Video, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generatePersonaVignette } from "@/lib/persona-video.functions";

interface Props {
  personaId: string | null; // null while creating
  hasImage: boolean;
  vignetteUrl: string | null;
  onGenerated: (url: string, model: string) => void;
}

export function PersonaVideoPanel({ personaId, hasImage, vignetteUrl, onGenerated }: Props) {
  const gen = useServerFn(generatePersonaVignette);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [withAudio, setWithAudio] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    if (!personaId) {
      toast.error("Salve a persona antes de gerar a vinheta.");
      return;
    }
    if (!hasImage) {
      toast.error("A persona precisa ter uma imagem primeiro.");
      return;
    }
    setBusy(true);
    try {
      const out = await gen({ data: { personaId, aspectRatio, withAudio } });
      onGenerated(out.vignetteUrl, out.model);
      toast.success(`Vinheta gerada via ${out.model}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !personaId || !hasImage;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Vinheta de vídeo da persona</h3>
      </div>

      {vignetteUrl ? (
        <video
          src={vignetteUrl}
          controls
          className="w-full max-w-sm rounded-md border border-border bg-black"
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhuma vinheta gerada ainda. A imagem da persona será animada (~8s) e armazenada com segurança.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Proporção</Label>
          <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as "9:16" | "16:9")}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9:16">9:16 (vertical / Reels)</SelectItem>
              <SelectItem value="16:9">16:9 (horizontal)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Switch id="va" checked={withAudio} onCheckedChange={setWithAudio} />
          <Label htmlFor="va" className="text-xs cursor-pointer">
            Com áudio ambiente (Veo 3)
          </Label>
        </div>
      </div>

      <Button type="button" size="sm" onClick={handleGenerate} disabled={disabled}>
        {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
        {busy ? "Gerando vinheta… (pode levar até 3 min)" : vignetteUrl ? "Gerar nova vinheta" : "Gerar vinheta"}
      </Button>

      {!personaId && (
        <p className="text-[11px] text-muted-foreground">
          Salve a persona pela primeira vez para liberar a geração da vinheta.
        </p>
      )}
      {personaId && !hasImage && (
        <p className="text-[11px] text-amber-500">
          Gere ou envie a imagem da persona primeiro.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Tenta <strong>Veo 3 Fast</strong> (com áudio). Se falhar, faz fallback automático para <strong>Wan 2.2 i2v</strong> (sem áudio, mais rápido).
      </p>
    </div>
  );
}
