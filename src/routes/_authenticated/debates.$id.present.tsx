import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDebate } from "@/lib/debate.functions";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipForward, SkipBack, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/debates/$id/present")({
  component: PresentMode,
});

function PresentMode() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(getDebate);
  const { data } = useQuery({ queryKey: ["debate", id], queryFn: () => get({ data: { id } }) });

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceA, setVoiceA] = useState<string>("");
  const [voiceB, setVoiceB] = useState<string>("");
  const [voiceMod, setVoiceMod] = useState<string>("");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    function load() {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
      const pt = v.filter((x) => x.lang.startsWith("pt"));
      const pool = pt.length > 0 ? pt : v;
      if (pool.length > 0) {
        setVoiceMod((p) => p || pool[0].name);
        setVoiceA((p) => p || pool[1 % pool.length].name);
        setVoiceB((p) => p || pool[2 % pool.length].name);
      }
    }
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  const messages = data?.messages ?? [];
  const current = messages[index];

  function speak(text: string, voiceName: string, onEnd: () => void) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find((x) => x.name === voiceName);
    if (v) u.voice = v;
    u.lang = v?.lang ?? "pt-BR";
    u.rate = 1.0;
    u.onend = onEnd;
    utterRef.current = u;
    window.speechSynthesis.speak(u);
  }

  useEffect(() => {
    if (!playing || !current) return;
    const voice = current.role === "moderator" ? voiceMod : current.role === "a" ? voiceA : voiceB;
    speak(current.content, voice, () => {
      if (index + 1 < messages.length) setIndex((i) => i + 1);
      else setPlaying(false);
    });
    return () => { window.speechSynthesis.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, current?.id]);

  if (!data) return <div className="min-h-screen flex items-center justify-center bg-background">Carregando…</div>;

  if (messages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4">
        <p>Nenhuma fala ainda.</p>
        <Button onClick={() => router.navigate({ to: "/_authenticated/debates/$id", params: { id } })}>Voltar</Button>
      </div>
    );
  }

  const name = !current ? "" : current.role === "moderator" ? "Mediador" : current.role === "a" ? data.debate.debater_a_name : data.debate.debater_b_name;
  const accent = current?.role === "a" ? "text-primary" : current?.role === "b" ? "text-destructive" : "text-foreground";

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => { window.speechSynthesis.cancel(); router.navigate({ to: "/_authenticated/debates/$id", params: { id } }); }}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 text-xs">
        <VoicePicker label="Mediador" voices={voices} value={voiceMod} onChange={setVoiceMod} />
        <VoicePicker label={data.debate.debater_a_name} voices={voices} value={voiceA} onChange={setVoiceA} />
        <VoicePicker label={data.debate.debater_b_name} voices={voices} value={voiceB} onChange={setVoiceB} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-5xl mx-auto w-full">
        <div className="text-sm uppercase tracking-widest text-muted-foreground mb-2">{current?.phase}</div>
        <h2 className={`text-4xl md:text-6xl font-bold mb-8 ${accent}`}>{name}</h2>
        <p className="text-xl md:text-2xl text-center leading-relaxed max-w-3xl">
          {current?.content}
        </p>
      </div>

      <div className="border-t border-border/60 p-4 flex items-center justify-center gap-3 bg-card/40">
        <Button size="icon" variant="ghost" onClick={() => { setPlaying(false); window.speechSynthesis.cancel(); setIndex(Math.max(0, index - 1)); }}>
          <SkipBack className="h-5 w-5" />
        </Button>
        <Button size="lg" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
          {playing ? "Pausar" : "Tocar"}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => { setPlaying(false); window.speechSynthesis.cancel(); setIndex(Math.min(messages.length - 1, index + 1)); }}>
          <SkipForward className="h-5 w-5" />
        </Button>
        <span className="text-xs text-muted-foreground ml-4">{index + 1} / {messages.length}</span>
      </div>
    </div>
  );
}

function VoicePicker({ label, voices, value, onChange }: { label: string; voices: SpeechSynthesisVoice[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1 bg-card/80 border border-border/60 rounded px-2 py-1">
      <span className="text-muted-foreground">{label}:</span>
      <select className="bg-transparent outline-none max-w-[140px] truncate" value={value} onChange={(e) => onChange(e.target.value)}>
        {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
      </select>
    </label>
  );
}
