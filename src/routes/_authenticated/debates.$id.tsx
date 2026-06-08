import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDebate, generateNextTurn } from "@/lib/debate.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Play, SkipForward } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/debates/$id")({
  component: DebateDetail,
});

function DebateDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(getDebate);
  const next = useServerFn(generateNextTurn);
  const [generating, setGenerating] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["debate", id],
    queryFn: () => get({ data: { id } }),
  });

  async function handleNext() {
    setGenerating(true);
    try {
      const r = await next({ data: { debateId: id } });
      if (r.done) toast.info("Debate concluído.");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateAll() {
    setGenerating(true);
    try {
      // Loop until done
      for (let i = 0; i < 30; i++) {
        const r = await next({ data: { debateId: id } });
        await refetch();
        if (r.done) break;
      }
      toast.success("Debate concluído!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setGenerating(false);
    }
  }

  function exportMarkdown() {
    if (!data) return;
    const lines = [
      `# ${data.debate.topic}`,
      "",
      `**${data.debate.debater_a_name}** vs **${data.debate.debater_b_name}**`,
      "",
      "## Regras",
      data.debate.rules ?? "",
      "",
      "## Debate",
      "",
      ...data.messages.map((m) => {
        const name = m.role === "moderator" ? "Mediador" : m.role === "a" ? data.debate.debater_a_name : data.debate.debater_b_name;
        return `### ${name} — ${m.phase}\n\n${m.content}\n`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debate-${id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) return <main className="container mx-auto px-4 py-10">Carregando…</main>;

  const totalTurns = 3 + data.debate.rounds * 2 + 3;
  const progress = Math.min(data.messages.length, totalTurns);
  const done = progress >= totalTurns;

  return (
    <main className="container mx-auto px-4 py-10 max-w-4xl">
      <button onClick={() => router.navigate({ to: "/dashboard" })} className="text-sm text-muted-foreground hover:text-foreground mb-4">← Voltar</button>
      <h1 className="text-3xl font-bold mb-2">{data.debate.topic}</h1>
      <p className="text-muted-foreground mb-6">
        <span className="text-primary">{data.debate.debater_a_name}</span>
        <span className="mx-2">vs</span>
        <span className="text-destructive">{data.debate.debater_b_name}</span>
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={handleNext} disabled={generating || done} variant="outline" size="sm">
          <SkipForward className="h-4 w-4 mr-1" /> Próxima fala
        </Button>
        <Button onClick={handleGenerateAll} disabled={generating || done} size="sm">
          <Play className="h-4 w-4 mr-1" /> {generating ? "Gerando…" : "Gerar todas"}
        </Button>
        <Link to="/_authenticated/debates/$id/present" params={{ id }}>
          <Button variant="secondary" size="sm" disabled={data.messages.length === 0}>
            🎬 Modo apresentação
          </Button>
        </Link>
        <Button onClick={exportMarkdown} variant="ghost" size="sm" disabled={data.messages.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar .md
        </Button>
      </div>

      <div className="text-xs text-muted-foreground mb-4">
        Progresso: {progress}/{totalTurns} falas
      </div>

      {data.debate.rules && (
        <Card className="p-5 mb-6 bg-card/60">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-3">Regras do Mediador</h3>
          <pre className="whitespace-pre-wrap text-sm font-sans">{data.debate.rules}</pre>
        </Card>
      )}

      <div className="space-y-3">
        {data.messages.map((m) => {
          const color = m.role === "a" ? "border-l-primary" : m.role === "b" ? "border-l-destructive" : "border-l-muted-foreground";
          const name = m.role === "moderator" ? "Mediador" : m.role === "a" ? data.debate.debater_a_name : data.debate.debater_b_name;
          return (
            <Card key={m.id} className={`p-5 border-l-4 ${color}`}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-semibold">{name}</span>
                <span className="text-xs text-muted-foreground">{m.phase}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
            </Card>
          );
        })}
        {data.messages.length === 0 && (
          <Card className="p-8 text-center border-dashed">
            <p className="text-muted-foreground mb-4">O debate ainda não começou.</p>
            <Button onClick={handleGenerateAll} disabled={generating}>
              <Play className="h-4 w-4 mr-2" /> Iniciar debate
            </Button>
          </Card>
        )}
      </div>
    </main>
  );
}
