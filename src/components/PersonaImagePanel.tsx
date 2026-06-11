import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageIcon, Sparkles, Upload, Wand2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  generatePersonaImage,
  uploadPersonaImage,
  enhancePersonaImage,
} from "@/lib/persona-image.functions";
import { generatePersonaImageReplicate } from "@/lib/persona-image-replicate.functions";

type Provider = "gemini" | "flux-schnell" | "flux-1.1-pro";

interface Props {
  name: string;
  description?: string;
  value: string | null;
  onChange: (url: string | null) => void;
}

export function PersonaImagePanel({ name, description, value, onChange }: Props) {
  const gen = useServerFn(generatePersonaImage);
  const genFlux = useServerFn(generatePersonaImageReplicate);
  const up = useServerFn(uploadPersonaImage);
  const enh = useServerFn(enhancePersonaImage);
  const [busy, setBusy] = useState<null | "gen" | "up" | "enh">(null);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [enhancePrompt, setEnhancePrompt] = useState("");
  const lastFileRef = useRef<File | null>(null);

  async function handleGenerate() {
    if (name.trim().length < 1) {
      toast.error("Defina o nome da persona primeiro.");
      return;
    }
    setBusy("gen");
    try {
      if (provider === "gemini") {
        const out = await gen({ data: { name: name.trim(), description } });
        onChange(out.imageUrl);
        toast.success(
          out.referencesUsed > 0
            ? `Imagem gerada com ${out.referencesUsed} referência(s) reais da web`
            : "Imagem gerada (sem referências reais encontradas — avatar fictício)",
        );
      } else {
        const model = provider === "flux-schnell" ? "schnell" : "1.1-pro";
        const out = await genFlux({ data: { name: name.trim(), description, model } });
        onChange(out.imageUrl);
        toast.success(`Imagem gerada via ${out.model}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(file: File) {
    lastFileRef.current = file;
    setBusy("up");
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const out = await up({ data: fd as unknown as never });
      onChange(out.imageUrl);
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(null);
    }
  }

  async function handleEnhance() {
    const file = lastFileRef.current;
    if (!file) {
      toast.error("Faça upload de uma imagem primeiro para melhorar.");
      return;
    }
    setBusy("enh");
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      if (enhancePrompt.trim()) fd.append("prompt", enhancePrompt.trim());
      const out = await enh({ data: fd as unknown as never });
      onChange(out.imageUrl);
      toast.success("Imagem melhorada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Imagem / avatar da persona</h3>
      </div>

      <div className="flex gap-4 items-start">
        <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-border bg-muted/40 flex items-center justify-center">
          {value ? (
            <>
              <img src={value} alt={name || "avatar"} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(null)}
                className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 hover:bg-background"
                aria-label="Remover imagem"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleGenerate}
            disabled={busy !== null}
          >
            {busy === "gen" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Gerar com IA
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => document.getElementById("persona-image-upload")?.click()}
            disabled={busy !== null}
          >
            {busy === "up" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            Enviar imagem
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleEnhance}
            disabled={busy !== null || !lastFileRef.current}
            title={lastFileRef.current ? "Melhorar última imagem enviada" : "Envie uma imagem primeiro"}
          >
            {busy === "enh" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
            Melhorar com IA
          </Button>
          <input
            id="persona-image-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      {lastFileRef.current && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Instrução opcional para "Melhorar com IA"</Label>
          <Input
            placeholder="Ex: estilo pintura a óleo, fundo escuro, expressão séria"
            value={enhancePrompt}
            onChange={(e) => setEnhancePrompt(e.target.value)}
            maxLength={300}
          />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Gere um avatar fotorrealista a partir do nome, envie uma foto, ou melhore a foto enviada com IA.
      </p>
    </div>
  );
}
