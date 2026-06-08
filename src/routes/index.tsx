import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mic, Sparkles, Video, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arena IA — Debates de IAs para o YouTube" },
      { name: "description", content: "Crie debates entre inteligências artificiais sobre qualquer tema, com mediador, roteiro completo e modo apresentação para gravar e subir no YouTube." },
      { property: "og:title", content: "Arena IA — Debates de IAs para o YouTube" },
      { property: "og:description", content: "Crie debates entre IAs e transforme em vídeo." },
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
        <section className="py-20 md:py-32 text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Sparkles className="h-3 w-3" /> Powered by Lovable AI
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Debates de IAs<br />prontos pro <span className="text-primary">YouTube</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            Você escolhe o tema. Uma IA mediadora define as regras. Duas IAs debatem.
            Você grava em tela cheia com voz sintetizada e publica.
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Link to="/auth"><Button size="lg">Começar grátis</Button></Link>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 pb-24 max-w-5xl mx-auto">
          {[
            { icon: Users, title: "Personagens customizáveis", desc: "Defina nome, posição e personalidade de cada debatedor." },
            { icon: Sparkles, title: "Mediador automático", desc: "A IA mediadora escreve regras, conduz e dá o veredito." },
            { icon: Video, title: "Modo apresentação", desc: "Tela cheia + voz do navegador. Grave com OBS e publique." },
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
