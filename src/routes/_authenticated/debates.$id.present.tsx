import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getDebate, ttsSpeak, type Verdict } from "@/lib/debate.functions";
import { ELEVEN_VOICES, DEFAULT_ELEVEN } from "@/lib/eleven-voices";
import { useEffect, useRef, useState } from "react";
import { VoiceWave } from "@/components/VoiceWave";
import { toast } from "sonner";
import { Play, Pause, SkipForward, SkipBack, X, Settings2, Swords, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/debates/$id/present")({
  component: PresentMode,
});

type Side = "moderator" | "a" | "b";

function PresentMode() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(getDebate);
  const { data } = useQuery({ queryKey: ["debate", id], queryFn: () => get({ data: { id } }) });

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceA, setVoiceA] = useState<string>("");
  const [voiceB, setVoiceB] = useState<string>("");
  const [voiceMod, setVoiceMod] = useState<string>("");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const tts = useServerFn(ttsSpeak);
  const [useEleven, setUseEleven] = useState(true);
  const [elevenA, setElevenA] = useState<string>(DEFAULT_ELEVEN.a);
  const [elevenB, setElevenB] = useState<string>(DEFAULT_ELEVEN.b);
  const [elevenMod, setElevenMod] = useState<string>(DEFAULT_ELEVEN.moderator);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());

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
    return () => { window.speechSynthesis.cancel(); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, []);

  const messages = data?.messages ?? [];
  const current = messages[index];
  const verdict = (data?.debate?.verdict as Verdict | null) ?? null;
  const slideCount = messages.length + (verdict ? 1 : 0);

  function stopAll() {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }

  function browserSpeak(text: string, voiceName: string, onEnd: () => void) {
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

  async function elevenSpeak(msgId: string, text: string, voiceId: string, onEnd: () => void) {
    const cacheKey = `${msgId}:${voiceId}`;
    let url = audioCache.current.get(cacheKey);
    if (!url) {
      const res = await tts({ data: { text: text.slice(0, 5000), voiceId } });
      url = `data:${res.mime};base64,${res.audio}`;
      audioCache.current.set(cacheKey, url);
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = onEnd;
    await audio.play();
  }

  useEffect(() => {
    if (!playing || !current) return;
    let cancelled = false;
    const advance = () => {
      if (cancelled) return;
      if (index + 1 < slideCount) setIndex((i) => i + 1);
      else setPlaying(false);
    };
    const browserVoice = current.role === "moderator" ? voiceMod : current.role === "a" ? voiceA : voiceB;
    if (useEleven) {
      const voiceId = current.role === "moderator" ? elevenMod : current.role === "a" ? elevenA : elevenB;
      elevenSpeak(current.id, current.content, voiceId, advance).catch(() => {
        if (cancelled) return;
        toast.error("ElevenLabs indisponível — usando voz do navegador.");
        browserSpeak(current.content, browserVoice, advance);
      });
    } else {
      browserSpeak(current.content, browserVoice, advance);
    }
    return () => { cancelled = true; stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, current?.id, useEleven]);

  function go(delta: number) {
    setPlaying(false);
    stopAll();
    setIndex((i) => Math.min(slideCount - 1, Math.max(0, i + delta)));
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando…</div>;
  }

  if (messages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4">
        <p className="text-muted-foreground">Nenhuma fala ainda.</p>
        <Button onClick={() => router.navigate({ to: "/debates/$id", params: { id } })}>Voltar</Button>
      </div>
    );
  }

  const isWinner = !!verdict && index === messages.length;
  const role = (current?.role ?? "moderator") as Side;
  const name = !current ? "" : role === "moderator" ? "Mediador" : role === "a" ? data.debate.debater_a_name : data.debate.debater_b_name;
  const theme = sideTheme(role);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[oklch(0.12_0.02_264)] text-foreground">
      {/* Reactive cinematic glow — tinted by the current speaker's side */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{ background: theme.glow }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_120%,transparent_40%,oklch(0.08_0.02_264_/_0.8))]" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Swords className="h-4 w-4 text-primary" />
          <span className="truncate max-w-[40vw]">{data.debate.topic}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowSettings((s) => !s)}>
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { stopAll(); router.navigate({ to: "/debates/$id", params: { id } }); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings drawer */}
      {showSettings && (
        <div className="absolute right-6 top-16 z-20 w-80 rounded-xl border border-border/60 glass p-4 space-y-3 shadow-2xl">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">Voz ElevenLabs</span>
            <input
              type="checkbox"
              checked={useEleven}
              onChange={(e) => { stopAll(); setPlaying(false); setUseEleven(e.target.checked); }}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {useEleven
              ? "Vozes de alta qualidade (consome créditos ElevenLabs). Cai para a voz do navegador se falhar."
              : "Voz nativa do navegador (grátis)."}
          </p>
          <div className="border-t border-border/50 pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vozes</p>
            {useEleven ? (
              <>
                <ElevenPicker label="Mediador" value={elevenMod} onChange={setElevenMod} />
                <ElevenPicker label={data.debate.debater_a_name} value={elevenA} onChange={setElevenA} />
                <ElevenPicker label={data.debate.debater_b_name} value={elevenB} onChange={setElevenB} />
              </>
            ) : (
              <>
                <VoicePicker label="Mediador" voices={voices} value={voiceMod} onChange={setVoiceMod} />
                <VoicePicker label={data.debate.debater_a_name} voices={voices} value={voiceA} onChange={setVoiceA} />
                <VoicePicker label={data.debate.debater_b_name} voices={voices} value={voiceB} onChange={setVoiceB} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Stage */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
        {isWinner && verdict ? (
          <WinnerStage verdict={verdict} aName={data.debate.debater_a_name} bName={data.debate.debater_b_name} />
        ) : (
          <div key={current?.id} className="w-full max-w-4xl text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`mb-3 text-xs md:text-sm font-semibold uppercase tracking-[0.3em] ${theme.text}`}>
              {current?.phase}
            </div>
            <div className="mb-4 inline-flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${theme.dot} ${playing ? "animate-pulse" : ""}`} />
              <h2 className={`font-display text-4xl md:text-6xl font-extrabold tracking-tight ${theme.text}`}>{name}</h2>
            </div>
            <div className="mb-8">
              <VoiceWave active={playing} colorClass={theme.dot} />
            </div>
            <p className="text-2xl md:text-[2rem] leading-relaxed md:leading-relaxed text-foreground/95 font-medium text-balance">
              {current?.content}
            </p>
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div className="relative z-10 px-6 pb-6">
        {/* Progress */}
        <div className="mx-auto mb-4 flex max-w-3xl items-center gap-1.5">
          {messages.map((m, i) => {
            const t = sideTheme((m.role ?? "moderator") as Side);
            return (
              <button
                key={m.id}
                onClick={() => go(i - index)}
                className={`h-1.5 flex-1 rounded-full transition-all ${i <= index ? t.bar : "bg-border"}`}
                title={`${i + 1}`}
              />
            );
          })}
          {verdict && (
            <button
              onClick={() => go(messages.length - index)}
              className={`h-1.5 w-8 rounded-full transition-all ${index >= messages.length ? "bg-primary" : "bg-border"}`}
              title="Veredito"
            />
          )}
        </div>

        <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 rounded-2xl border border-border/60 glass px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => go(-1)} disabled={index === 0}>
            <SkipBack className="h-5 w-5" />
          </Button>
          <Button size="lg" className="gap-2 px-8 shadow-lg shadow-primary/20" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            {playing ? "Pausar" : "Tocar"}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => go(1)} disabled={index >= slideCount - 1}>
            <SkipForward className="h-5 w-5" />
          </Button>
          <span className="ml-2 text-sm tabular-nums text-muted-foreground">{index + 1} / {slideCount}</span>
        </div>
      </div>
    </div>
  );
}

function sideTheme(role: Side) {
  if (role === "a") {
    return {
      text: "text-side-a",
      dot: "bg-side-a",
      bar: "bg-side-a",
      glow: "radial-gradient(80rem 50rem at 18% 0%, oklch(0.72 0.145 221 / 0.22), transparent 55%)",
    };
  }
  if (role === "b") {
    return {
      text: "text-side-b",
      dot: "bg-side-b",
      bar: "bg-side-b",
      glow: "radial-gradient(80rem 50rem at 82% 0%, oklch(0.77 0.16 64 / 0.2), transparent 55%)",
    };
  }
  return {
    text: "text-primary",
    dot: "bg-primary",
    bar: "bg-primary",
    glow: "radial-gradient(80rem 55rem at 50% -10%, oklch(0.62 0.205 277 / 0.2), transparent 55%)",
  };
}

function WinnerStage({ verdict, aName, bName }: { verdict: Verdict; aName: string; bName: string }) {
  const winA = verdict.winner === "a";
  const winB = verdict.winner === "b";
  const winnerName = verdict.winner === "empate" ? "Empate técnico" : winA ? aName : bName;
  const color = verdict.winner === "empate" ? "text-foreground" : winA ? "text-side-a" : "text-side-b";
  return (
    <div className="w-full max-w-3xl text-center animate-in fade-in zoom-in-95 duration-700">
      <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Trophy className="h-8 w-8" />
      </div>
      <div className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-2">Veredito</div>
      <h2 className={`font-display text-5xl md:text-7xl font-extrabold tracking-tight mb-6 ${color}`}>{winnerName}</h2>
      <div className="flex items-center justify-center gap-6 mb-3">
        <span className={`font-display text-4xl font-extrabold tabular-nums ${winA ? "text-side-a" : "text-muted-foreground"}`}>{verdict.scoreA}</span>
        <span className="text-muted-foreground">×</span>
        <span className={`font-display text-4xl font-extrabold tabular-nums ${winB ? "text-side-b" : "text-muted-foreground"}`}>{verdict.scoreB}</span>
      </div>
      <div className="flex justify-center gap-6 text-sm mb-6">
        <span className="text-side-a">{aName}</span>
        <span className="text-side-b">{bName}</span>
      </div>
      {verdict.summary && (
        <p className="text-xl md:text-2xl leading-relaxed text-foreground/90 max-w-2xl mx-auto text-balance">{verdict.summary}</p>
      )}
    </div>
  );
}

function ElevenPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground truncate max-w-[110px]">{label}</span>
      <select
        className="flex-1 min-w-0 rounded-md border border-border/60 bg-background/60 px-2 py-1 outline-none truncate"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {ELEVEN_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
    </label>
  );
}

function VoicePicker({ label, voices, value, onChange }: { label: string; voices: SpeechSynthesisVoice[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground truncate max-w-[90px]">{label}</span>
      <select
        className="flex-1 min-w-0 rounded-md border border-border/60 bg-background/60 px-2 py-1 outline-none truncate"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
      </select>
    </label>
  );
}
