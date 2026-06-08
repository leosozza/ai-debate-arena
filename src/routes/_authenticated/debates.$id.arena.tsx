import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { getDebate, generateSynopsis } from "@/lib/debate.functions";
import { Button } from "@/components/ui/button";
import { ArenaBackground } from "@/components/ArenaBackground";
import { voiceLabel, type VoiceProvider } from "@/lib/voice-catalog";
import { Play, X, Swords, Loader2, Mic } from "lucide-react";

export const Route = createFileRoute("/_authenticated/debates/$id/arena")({
  component: ArenaIntro,
});

function ArenaIntro() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(getDebate);
  const synFn = useServerFn(generateSynopsis);
  const { data } = useQuery({ queryKey: ["debate", id], queryFn: () => get({ data: { id } }) });
  const [synopsis, setSynopsis] = useState<string | null>(null);
  const [loadingSyn, setLoadingSyn] = useState(false);

  useEffect(() => {
    if (!data) return;
    const existing = data.debate.synopsis;
    if (existing) {
      setSynopsis(existing);
      return;
    }
    setLoadingSyn(true);
    synFn({ data: { debateId: id, force: false } })
      .then((r) => setSynopsis(r.synopsis))
      .catch(() => setSynopsis(null))
      .finally(() => setLoadingSyn(false));
  }, [data, id, synFn]);

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }
  const d = data.debate;

  return (
    <div className="fixed inset-0 overflow-hidden">
      <ArenaBackground />
      <button onClick={() => router.navigate({ to: "/debates/$id", params: { id } })} className="absolute top-6 right-6 z-10 text-muted-foreground hover:text-foreground">
        <X className="h-5 w-5" />
      </button>

      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 py-10 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-xs uppercase tracking-[0.4em] text-primary mb-3 flex items-center gap-2">
          <Swords className="h-3.5 w-3.5" /> Arena de Batalha
        </motion.div>

        <motion.h1 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.7 }}
          className="font-display text-4xl md:text-6xl lg:text-7xl font-extrabold text-center max-w-5xl text-balance mb-8 text-foreground">
          {d.topic}
        </motion.h1>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}
          className="max-w-2xl text-center mb-12 min-h-[3.5rem]">
          {loadingSyn ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando sinopse…
            </div>
          ) : synopsis ? (
            <p className="text-lg md:text-xl text-foreground/85 leading-relaxed italic">"{synopsis}"</p>
          ) : null}
        </motion.div>

        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center max-w-4xl w-full mb-12">
          <FighterCard
            side="a"
            name={d.debater_a_name}
            persona={d.debater_a_persona}
            provider={d.voice_provider_a as VoiceProvider | null}
            voiceId={d.voice_id_a}
          />
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
            className="font-display text-3xl md:text-5xl font-extrabold text-primary text-center">
            VS
          </motion.div>
          <FighterCard
            side="b"
            name={d.debater_b_name}
            persona={d.debater_b_persona}
            provider={d.voice_provider_b as VoiceProvider | null}
            voiceId={d.voice_id_b}
          />
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.5 }}>
          <Button size="lg" className="gap-2 px-10 py-6 text-base shadow-2xl shadow-primary/30"
            onClick={() => router.navigate({ to: "/debates/$id/present", params: { id } })}
            disabled={data.messages.length === 0}>
            <Play className="h-5 w-5" /> Iniciar apresentação
          </Button>
          {data.messages.length === 0 && (
            <p className="mt-3 text-xs text-center text-muted-foreground">Gere as falas no painel do debate primeiro.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function FighterCard({ side, name, persona, provider, voiceId }: {
  side: "a" | "b";
  name: string;
  persona: string;
  provider: VoiceProvider | null;
  voiceId: string | null;
}) {
  const isA = side === "a";
  const color = isA ? "border-side-a/50 text-side-a" : "border-side-b/50 text-side-b";
  const dot = isA ? "bg-side-a" : "bg-side-b";
  return (
    <motion.div
      initial={{ opacity: 0, x: isA ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.55, duration: 0.6 }}
      className={`rounded-2xl border-2 ${color} bg-card/40 backdrop-blur-md p-6 text-center`}
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot} animate-pulse`} />
        <h2 className={`font-display text-2xl md:text-3xl font-extrabold ${color}`}>{name}</h2>
      </div>
      <p className="text-sm text-foreground/75 line-clamp-3 mb-3">{persona}</p>
      <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background/50 px-2 py-1 rounded-full">
        <Mic className="h-3 w-3" /> {voiceLabel(provider, voiceId)}
      </div>
    </motion.div>
  );
}
