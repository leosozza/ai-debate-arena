import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listDebates, deleteDebate } from "@/lib/debate.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/Reveal";
import { Plus, Trash2, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const list = useServerFn(listDebates);
  const del = useServerFn(deleteDebate);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["debates"], queryFn: () => list() });

  async function handleDelete(id: string) {
    if (!confirm("Apagar este debate?")) return;
    try {
      await del({ data: { id } });
      toast.success("Debate apagado");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  return (
    <main className="container mx-auto px-4 py-10">
      <Reveal className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Seus debates</h1>
          <p className="text-muted-foreground text-sm mt-1">Biblioteca de debates gerados.</p>
        </div>
        <Link to="/new"><Button><Plus className="h-4 w-4 mr-2" /> Novo debate</Button></Link>
      </Reveal>

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}

      {!isLoading && (!data || data.length === 0) && (
        <Card className="p-12 text-center border-dashed">
          <h2 className="font-semibold mb-2">Nenhum debate ainda</h2>
          <p className="text-sm text-muted-foreground mb-6">Crie o primeiro para começar.</p>
          <Link to="/new"><Button>Criar primeiro debate</Button></Link>
        </Card>
      )}

      <div className="grid gap-3">
        {data?.map((d) => (
          <Card key={d.id} className="p-4 flex items-center justify-between gap-4 hover:border-primary/50 transition">
            <button
              className="flex-1 text-left min-w-0"
              onClick={() => router.navigate({ to: "/debates/$id", params: { id: d.id } })}
            >
              <div className="font-display font-medium truncate">{d.topic}</div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="text-side-a">{d.debater_a_name}</span> vs <span className="text-side-b">{d.debater_b_name}</span>
                {" · "}
                {d.status === "completed"
                  ? <span className="text-primary">Concluído</span>
                  : "Em rascunho"}
              </div>
            </button>
            <Link to="/presentation/$id" params={{ id: d.id }}>
              <Button size="sm" variant="outline"><Play className="h-4 w-4" /></Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>
    </main>
  );
}
