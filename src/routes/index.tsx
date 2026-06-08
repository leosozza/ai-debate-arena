import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mic, Clapperboard, BookOpen, Play } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arena IA — Meu Estúdio de Debates" },
      { name: "description", content: "Ferramenta pessoal para criar debates entre IAs, gerar roteiros e gravar vídeos para o YouTube." },
      { property: "og:title", content: "Arena IA — Meu Estúdio de Debates" },
      { property: "og:description", content: "Meu estúdio pessoal de debates entre inteligências artificiais." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <Mic className="h-5 w-5 text-primary" />
            Arena IA
          </div>
          <Link to="/auth"><Button size="sm" variant="outline">Entrar</Button></Link>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <section className="py-20 md:py-28 text-center max-w-3xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Meu Estúdio de<br />Debates <span className="text-primary">IA</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            Escolho o tema, defino os personagens e deixo as IAs debaterem.
            Roteiro pronto, voz sintetizada e tela cheia para gravar.
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Link to="/auth"><Button size="lg" className="gap-2"><Play className="h-4 w-4" /> Começar</Button></Link>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 pb-24 max-w-5xl mx-auto">
          {[
            { icon: Clapperboard, title: "Novo Debate", desc: "Escolha o tema, configure os personagens e deixe a IA mediadora criar as regras." },
            { icon: BookOpen, title: "Biblioteca", desc: "Todos os debates salvos. Acesse roteiros, revise falas e exporte quando quiser." },
            { icon: Mic, title: "Modo Gravação", desc: "Tela cheia com voz do navegador. Grave com OBS e publique no YouTube." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl border border-border/60 bg-card space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
