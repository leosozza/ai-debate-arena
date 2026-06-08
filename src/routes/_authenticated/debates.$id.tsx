import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDebate, generateVerdict, drawSubtemas, injectSubtema, type Verdict } from "@/lib/debate.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Roulette } from "@/components/Roulette";
import { Download, Play, SkipForward, Square, Gavel, Trophy, Dices } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/debates/$id")({
  component: DebateDetail,
});

function DebateDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(getDebate);
  const genVerdict = useServerFn(generateVerdict);
  const drawSubtemasFn = useServerFn(drawSubtemas);
  const injectSubtemaFn = useServerFn(injectSubtema);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [subtemaOpen, setSubtemaOpen] = useState(false);
  const [subtemaOptions, setSubtemaOptions] = useState<string[]>([]);
  const [subtemaLoading, setSubtemaLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingMeta, setStreamingMeta] = useState<{ role: string; phase: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stopAllRef = useRef(false);

  const { data, refetch } = useQuery({
    queryKey: ["debate", id],
    queryFn: () => get({ data: { id } }),
  });

  async function streamOne(): Promise<{ done: boolean; final: boolean }> {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Sessão expirada.");

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreamingText("");
    setStreamingMeta(null);

    const res = await fetch("/api/debate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ debateId: id }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new Error(`Falha (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result = { done: false, final: false };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        const lines = evt.split("\n");
        let name = "message";
        let dataLine = "";
        for (const l of lines) {
          if (l.startsWith("event:")) name = l.slice(6).trim();
          else if (l.startsWith("data:")) dataLine += l.slice(5).trim();
        }
        if (!dataLine) continue;
        try {
          const payload = JSON.parse(dataLine);
          if (name === "meta") setStreamingMeta(payload);
          else if (name === "delta") setStreamingText((p) => p + (payload.t ?? ""));
          else if (name === "done") {
            result = { done: !payload.message, final: !!payload.final };
          } else if (name === "error") {
            throw new Error(payload.error ?? "Erro no stream");
          }
        } catch (e) {
          if (name === "error") throw e;
        }
      }
    }

    setStreamingText("");
    setStreamingMeta(null);
    await refetch();
    return result;
  }

  async function handleNext() {
    setGenerating(true);
    try {
      const r = await streamOne();
      if (r.final) toast.info("Debate concluído.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  async function handleGenerateAll() {
    setGenerating(true);
    stopAllRef.current = false;
    try {
      for (let i = 0; i < 30; i++) {
        if (stopAllRef.current) break;
        const r = await streamOne();
        if (r.final) {
          toast.success("Debate concluído!");
          break;
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    stopAllRef.current = true;
    abortRef.current?.abort();
  }

  async function handleVerdict() {
    setVerdictLoading(true);
    try {
      await genVerdict({ data: { debateId: id } });
      toast.success("Veredito e placar gerados!");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar veredito");
    } finally {
      setVerdictLoading(false);
    }
  }

  async function openSubtemaRoulette() {
    setSubtemaOpen(true);
    setSubtemaOptions([]);
    setSubtemaLoading(true);
    try {
      const { options } = await drawSubtemasFn({ data: { topic: data?.debate.topic } });
      setSubtemaOptions(options);
    } catch {
      setSubtemaOptions([]);
    } finally {
      setSubtemaLoading(false);
    }
  }

  async function applySubtema(subtema: string) {
    try {
      await injectSubtemaFn({ data: { debateId: id, subtema } });
      toast.success("Reviravolta injetada! Gere as próximas falas.");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao injetar subtema");
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
  const done = data.debate.status === "completed" || progress >= totalTurns;
  const verdict = (data.debate.verdict as Verdict | null) ?? null;

  const streamingName = streamingMeta
    ? streamingMeta.role === "moderator"
      ? "Mediador"
      : streamingMeta.role === "a"
        ? data.debate.debater_a_name
        : data.debate.debater_b_name
    : null;
  const streamingColor = streamingMeta?.role === "a" ? "border-l-side-a" : streamingMeta?.role === "b" ? "border-l-side-b" : "border-l-muted-foreground";

  return (
    <main className="container mx-auto px-4 py-10 max-w-4xl">
      <button onClick={() => router.navigate({ to: "/dashboard" })} className="text-sm text-muted-foreground hover:text-foreground mb-4">← Voltar</button>
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">{data.debate.topic}</h1>
      <p className="text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
        <span className="font-medium text-side-a">{data.debate.debater_a_name}</span>
        <span className="text-xs uppercase tracking-wide">vs</span>
        <span className="font-medium text-side-b">{data.debate.debater_b_name}</span>
        {data.debate.dynamic_flow && <span className="ml-1 text-xs px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary">fluxo dinâmico</span>}
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={handleNext} disabled={generating || done} variant="outline" size="sm">
          <SkipForward className="h-4 w-4 mr-1" /> Próxima fala
        </Button>
        <Button onClick={handleGenerateAll} disabled={generating || done} size="sm">
          <Play className="h-4 w-4 mr-1" /> {generating ? "Gerando…" : "Gerar todas"}
        </Button>
        {generating && (
          <Button onClick={handleStop} variant="destructive" size="sm">
            <Square className="h-4 w-4 mr-1" /> Parar
          </Button>
        )}
        <Link to="/debates/$id/present" params={{ id }}>
          <Button variant="secondary" size="sm" disabled={data.messages.length === 0}>
            🎬 Modo apresentação
          </Button>
        </Link>
        <Button onClick={openSubtemaRoulette} variant="outline" size="sm" disabled={data.messages.length === 0}>
          <Dices className="h-4 w-4 mr-1" /> Sortear subtema
        </Button>
        <Button onClick={handleVerdict} variant="outline" size="sm" disabled={verdictLoading || data.messages.length === 0}>
          <Gavel className="h-4 w-4 mr-1" /> {verdictLoading ? "Julgando…" : verdict ? "Rejulgar" : "Veredito + placar"}
        </Button>
        <Button onClick={exportMarkdown} variant="ghost" size="sm" disabled={data.messages.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar .md
        </Button>
      </div>

      <div className="text-xs text-muted-foreground mb-4">Progresso: {progress}/{totalTurns} falas</div>

      {verdict && <Scoreboard verdict={verdict} aName={data.debate.debater_a_name} bName={data.debate.debater_b_name} />}

      {data.debate.rules && (
        <Card className="p-5 mb-6 bg-card/60">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-3">Regras do Mediador</h3>
          <pre className="whitespace-pre-wrap text-sm font-sans">{data.debate.rules}</pre>
        </Card>
      )}

      <div className="space-y-3">
        {data.messages.map((m) => {
          const color = m.role === "a" ? "border-l-side-a" : m.role === "b" ? "border-l-side-b" : "border-l-primary";
          const nameColor = m.role === "a" ? "text-side-a" : m.role === "b" ? "text-side-b" : "text-primary";
          const name = m.role === "moderator" ? "Mediador" : m.role === "a" ? data.debate.debater_a_name : data.debate.debater_b_name;
          return (
            <Card key={m.id} className={`p-5 border-l-4 ${color} bg-card/60 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`font-display font-semibold ${nameColor}`}>{name}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{m.phase}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{m.content}</p>
            </Card>
          );
        })}

        {streamingMeta && (
          <Card className={`p-5 border-l-4 ${streamingColor} animate-pulse`}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-semibold">{streamingName}</span>
              <span className="text-xs text-muted-foreground">{streamingMeta.phase}</span>
              <span className="text-xs text-primary ml-2">● digitando…</span>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{streamingText}<span className="animate-pulse">▍</span></p>
          </Card>
        )}

        {data.messages.length === 0 && !streamingMeta && (
          <Card className="p-8 text-center border-dashed">
            <p className="text-muted-foreground mb-4">O debate ainda não começou.</p>
            <Button onClick={handleGenerateAll} disabled={generating}>
              <Play className="h-4 w-4 mr-2" /> Iniciar debate
            </Button>
          </Card>
        )}
      </div>

      <Roulette
        open={subtemaOpen}
        onOpenChange={setSubtemaOpen}
        title="Sortear subtema"
        description="Gira entre ângulos curados e gerados por IA. O sorteado vira uma reviravolta que os debatedores incorporam nas próximas falas."
        options={subtemaOptions}
        loading={subtemaLoading}
        confirmLabel="Injetar reviravolta"
        onPick={applySubtema}
      />
    </main>
  );
}

function Scoreboard({ verdict, aName, bName }: { verdict: Verdict; aName: string; bName: string }) {
  const winA = verdict.winner === "a";
  const winB = verdict.winner === "b";
  const winnerName = verdict.winner === "empate" ? "Empate" : winA ? aName : bName;
  const winnerColor = verdict.winner === "empate" ? "text-foreground" : winA ? "text-side-a" : "text-side-b";
  const total = verdict.scoreA + verdict.scoreB || 1;
  return (
    <Card className="p-6 mb-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/30 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-3 mb-5">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Trophy className="h-5 w-5" />
        </span>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Veredito do juiz</div>
          <div className={`font-display text-2xl font-bold ${winnerColor}`}>
            {verdict.winner === "empate" ? "Empate técnico" : `Vencedor: ${winnerName}`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <span className={`font-display text-3xl font-extrabold tabular-nums ${winA ? "text-side-a" : "text-muted-foreground"}`}>{verdict.scoreA}</span>
        <div className="flex-1 h-2 rounded-full bg-border overflow-hidden flex">
          <div className="h-full bg-side-a" style={{ width: `${(verdict.scoreA / total) * 100}%` }} />
          <div className="h-full bg-side-b" style={{ width: `${(verdict.scoreB / total) * 100}%` }} />
        </div>
        <span className={`font-display text-3xl font-extrabold tabular-nums ${winB ? "text-side-b" : "text-muted-foreground"}`}>{verdict.scoreB}</span>
      </div>
      <div className="flex justify-between text-xs mb-5">
        <span className="text-side-a font-medium">{aName}</span>
        <span className="text-side-b font-medium">{bName}</span>
      </div>

      {verdict.criteria.length > 0 && (
        <div className="space-y-2 mb-5">
          {verdict.criteria.map((c) => (
            <div key={c.name} className="grid grid-cols-[2rem_1fr_7rem_1fr_2rem] items-center gap-2 text-xs">
              <span className="tabular-nums text-right text-side-a font-medium">{c.a}</span>
              <div className="h-1.5 rounded-full bg-border overflow-hidden flex justify-end">
                <div className="h-full bg-side-a" style={{ width: `${c.a * 10}%` }} />
              </div>
              <span className="text-center text-muted-foreground truncate">{c.name}</span>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div className="h-full bg-side-b" style={{ width: `${c.b * 10}%` }} />
              </div>
              <span className="tabular-nums text-side-b font-medium">{c.b}</span>
            </div>
          ))}
        </div>
      )}

      {verdict.summary && <p className="text-sm text-foreground/90 leading-relaxed mb-3">{verdict.summary}</p>}
      {verdict.mvp_quote && (
        <blockquote className="border-l-2 border-primary/50 pl-3 text-sm italic text-muted-foreground">“{verdict.mvp_quote}”</blockquote>
      )}
    </Card>
  );
}
