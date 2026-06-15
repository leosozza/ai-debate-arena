import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Film, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listDebateExports, deleteDebateExport } from "@/lib/debate-exports.functions";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
}

export function DebateExportsList({ debateId }: { debateId: string }) {
  const list = useServerFn(listDebateExports);
  const del = useServerFn(deleteDebateExport);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["debate-exports", debateId],
    queryFn: () => list({ data: { debateId } }),
  });

  if (isLoading) {
    return (
      <Card className="p-4 mb-6 bg-card/60 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando vídeos salvos…
      </Card>
    );
  }
  if (!data || data.length === 0) return null;

  async function handleDelete(id: string) {
    if (!window.confirm("Apagar este vídeo salvo? Não dá pra desfazer.")) return;
    try {
      await del({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["debate-exports", debateId] });
      toast.success("Vídeo apagado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao apagar");
    }
  }

  return (
    <Card className="p-5 mb-6 bg-card/60">
      <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-3 flex items-center gap-2">
        <Film className="h-4 w-4" /> Vídeos exportados
      </h3>
      <ul className="space-y-2">
        {data.map((e) => {
          const label = e.kind === "full"
            ? "Debate completo"
            : `Bloco ${(e.block_index ?? 0) + 1}${e.block_title ? ` — ${e.block_title}` : ""}`;
          return (
            <li key={e.id} className="flex items-center gap-3 text-sm border border-border/40 rounded-md px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{label}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(e.created_at)} · {fmtBytes(e.size_bytes)}
                  {e.duration_seconds ? ` · ${Math.round(e.duration_seconds)}s` : ""}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!e.download_url}
                onClick={() => {
                  if (!e.download_url) return;
                  const a = document.createElement("a");
                  a.href = e.download_url;
                  a.download = `debate-${debateId.slice(0, 8)}-${e.kind === "full" ? "full" : `bloco-${(e.block_index ?? 0) + 1}`}.mp4`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                <Download className="h-4 w-4 mr-1" /> Baixar
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(e.id)} title="Apagar">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
