import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { generateDebateExports } from "@/lib/exports.functions";
import { Download, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

type Kind = "script" | "srt" | "vtt" | "youtube" | "social";

const KIND_META: Record<Kind, { label: string; description: string; ext: string; mime: string }> = {
  script:   { label: "Roteiro completo (.md)",       description: "Markdown com timestamps por fala.",     ext: "md",  mime: "text/markdown" },
  srt:      { label: "Legendas (.srt)",              description: "Cues curtas — pronto pra YouTube/VLC.", ext: "srt", mime: "application/x-subrip" },
  vtt:      { label: "Legendas (.vtt)",              description: "WebVTT — pronto pra HTML5/web.",        ext: "vtt", mime: "text/vtt" },
  youtube:  { label: "Texto para YouTube",           description: "Título + descrição + capítulos + tags.",ext: "txt", mime: "text/plain" },
  social:   { label: "Texto TikTok / Instagram",     description: "Caption curta + hashtags.",             ext: "txt", mime: "text/plain" },
};

export function ExportPackDialog({ debateId, debateTopic }: { debateId: string; debateTopic: string }) {
  const gen = useServerFn(generateDebateExports);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<Kind, boolean>>({
    script: true, srt: true, vtt: false, youtube: true, social: true,
  });
  const [loading, setLoading] = useState(false);

  function toggle(k: Kind) { setSelected((s) => ({ ...s, [k]: !s[k] })); }

  async function handleGenerate() {
    const kinds = (Object.keys(selected) as Kind[]).filter((k) => selected[k]);
    if (!kinds.length) { toast.error("Selecione pelo menos um artefato."); return; }
    setLoading(true);
    try {
      const { artifacts } = await gen({ data: { debateId, kinds } });
      const slug = debateTopic.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "debate";
      for (const k of kinds) {
        const content = artifacts[k];
        if (!content) continue;
        const blob = new Blob([content], { type: KIND_META[k].mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slug}-${k}.${KIND_META[k].ext}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast.success(`${kinds.length} arquivo(s) baixado(s).`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar.");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Package className="h-4 w-4 mr-1" /> Exportar pacote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Exportar pacote</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {(Object.keys(KIND_META) as Kind[]).map((k) => (
            <label key={k} htmlFor={`exp-${k}`} className="flex items-start gap-3 rounded-md border border-border/60 p-3 cursor-pointer hover:bg-muted/30">
              <Checkbox id={`exp-${k}`} checked={selected[k]} onCheckedChange={() => toggle(k)} />
              <div className="flex-1 min-w-0">
                <Label htmlFor={`exp-${k}`} className="font-semibold cursor-pointer">{KIND_META[k].label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{KIND_META[k].description}</p>
              </div>
            </label>
          ))}
          <p className="text-[11px] text-muted-foreground leading-snug">
            Timestamps são estimados a partir do tamanho da fala (~0.42 s/palavra). Todos os arquivos incluem o aviso de simulação por IA.
          </p>
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Gerando…</> : <><Download className="h-4 w-4 mr-1.5" /> Gerar e baixar</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
