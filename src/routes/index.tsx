import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Mic, Clapperboard, BookOpen, Play, Sparkles, Swords, ArrowRight, Menu, X } from "lucide-react";

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

const NAV_LINKS = [
  { label: "recursos", href: "#recursos" },
];

function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function startWithTheme(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen text-foreground">
      <Navbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <main className="container mx-auto px-4">
        {/* Hero */}
        <section className="pt-36 pb-24 md:pt-44 md:pb-28 text-center max-w-3xl mx-auto">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Meu estúdio pessoal de debates entre IAs
            </div>
          </Reveal>

          <motion.h1
            className="font-display text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.04] mt-7"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            Dois <span className="text-side-a">cérebros</span>.<br />
            Um <span className="text-side-b">tema</span>.{" "}
            Um <span className="bg-gradient-to-r from-primary via-side-a to-primary bg-clip-text text-transparent">vídeo</span>.
          </motion.h1>

          <Reveal delay={0.12}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mt-6">
              Escolho o tema, defino os personagens e deixo as IAs debaterem. O mediador cria
              as regras, o roteiro sai pronto e a tela cheia me deixa gravar direto para o YouTube.
            </p>
          </Reveal>

          {/* Theme input pill (adapted from the reference's search pill) */}
          <Reveal delay={0.2}>
            <form
              onSubmit={startWithTheme}
              className="mt-9 mx-auto flex max-w-xl items-center gap-2 rounded-full border border-border/60 bg-card/60 p-2 pl-5 shadow-xl shadow-black/20 backdrop-blur"
            >
              <Swords className="h-4 w-4 shrink-0 text-primary" />
              <input
                className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Qual o tema do próximo debate?"
                aria-label="Tema do debate"
              />
              <Button type="submit" size="sm" className="rounded-full gap-1.5 shrink-0 shadow-lg shadow-primary/20">
                Começar <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </Reveal>

          {/* Duel motif */}
          <Reveal delay={0.3}>
            <div className="flex items-center justify-center gap-4 pt-10 text-sm">
              <DuelPill side="a" label="Debatedor A" />
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground">
                <Swords className="h-4 w-4" />
              </span>
              <DuelPill side="b" label="Debatedor B" />
            </div>
          </Reveal>
        </section>

        {/* Cards */}
        <section id="recursos" className="grid md:grid-cols-3 gap-5 pb-28 max-w-5xl mx-auto scroll-mt-24">
          {[
            { icon: Clapperboard, title: "Novo Debate", desc: "Escolho o tema, configuro os personagens e a IA mediadora cria as regras." },
            { icon: BookOpen, title: "Biblioteca", desc: "Todos os debates salvos. Acesso roteiros, reviso falas e exporto quando quiser." },
            { icon: Mic, title: "Modo Gravação", desc: "Tela cheia com voz do navegador. Gravo com OBS e publico no YouTube." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
              className="group p-6 rounded-2xl border border-border/60 bg-card/60 space-y-3 backdrop-blur transition hover:border-primary/40 hover:bg-card"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/20">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-semibold text-lg">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-center text-xs text-muted-foreground">
          Arena IA — estúdio pessoal · feito para o meu canal
        </div>
      </footer>
    </div>
  );
}

function DuelPill({ side, label }: { side: "a" | "b"; label: string }) {
  const cls = side === "a"
    ? "border-side-a/30 bg-side-a/10 text-side-a"
    : "border-side-b/30 bg-side-b/10 text-side-b";
  const dot = side === "a" ? "bg-side-a" : "bg-side-b";
  return (
    <div className={`flex items-center gap-2 rounded-full border px-4 py-2 ${cls}`}>
      <span className={`h-2 w-2 rounded-full ${dot} animate-pulse`} /> {label}
    </div>
  );
}

function Navbar({ menuOpen, setMenuOpen }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 w-full z-50 border-b border-border/40 glass"
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display font-bold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Mic className="h-4 w-4" />
          </span>
          Arena IA
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="lowercase transition hover:text-foreground">{l.label}</a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link to="/auth"><Button size="sm" variant="ghost">Entrar</Button></Link>
          <Link to="/auth"><Button size="sm" className="gap-1.5">Começar <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>

        <button
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-foreground"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden overflow-hidden border-t border-border/40"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="text-sm text-muted-foreground lowercase">{l.label}</a>
              ))}
              <Link to="/auth" onClick={() => setMenuOpen(false)}>
                <Button size="sm" className="w-full gap-1.5">Começar <ArrowRight className="h-4 w-4" /></Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
