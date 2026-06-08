import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getDebate, ttsSpeak, type Verdict } from "@/lib/debate.functions";
import { minimaxTts, MINIMAX_VOICES } from "@/lib/tts.functions";
import { ELEVEN_VOICES, DEFAULT_ELEVEN } from "@/lib/eleven-voices";
import { useEffect, useRef, useState } from "react";
import { VoiceWave } from "@/components/VoiceWave";
import { toast } from "sonner";
import { Play, Pause, SkipForward, SkipBack, X, Settings2, Swords, Trophy, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/debates/$id/present")({
  component: PresentMode,
});

type Side = "moderator" | "a" | "b";
type Provider = "browser" | "eleven" | "minimax";

function PresentMode() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(getDebate);
  const elTts = useServerFn(ttsSpeak);
  const mmTts = useServerFn(minimaxTts);
  const { data } = useQuery({ queryKey: ["debate", id], queryFn: () => get({ data: { id } }) });

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  // Navegador é o padrão (sempre funciona, sem depender de chave/crédito).
  // A escolha fica salva; troque para ElevenLabs/MiniMax no painel ⚙️.
  const [provider, setProvider] = useState<Provider>("browser");

  // Browser voices
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceA, setVoiceA] = useState<string>("");
  const [voiceB, setVoiceB] = useState<string>("");
  const [voiceMod, setVoiceMod] = useState<string>("");

  // ElevenLabs voices
  const [elA, setElA] = useState<string>(DEFAULT_ELEVEN.a);
  const [elB, setElB] = useState<string>(DEFAULT_ELEVEN.b);
  const [elMod, setElMod] = useState<string>(DEFAULT_ELEVEN.moderator);

  // MiniMax voices
  const [mmA, setMmA] = useState<string>(MINIMAX_VOICES[0].id);
  const [mmB, setMmB] = useState<string>(MINIMAX_VOICES[3].id);
  const [mmMod, setMmMod] = useState<string>(MINIMAX_VOICES[7].id);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());
  const cancelledRef = useRef(false);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const saved = localStorage.getItem("arena-tts-provider");
    if (saved === "browser" || saved === "eleven" || saved === "minimax") setProvider(saved);
    return () => { window.speechSynthesis.cancel(); audioRef.current?.pause(); };
  }, []);

  const messages = data?.messages ?? [];
  const current = messages[index];
  const verdict = (data?.debate?.verdict as Verdict | null) ?? null;
  const slideCount = messages.length + (verdict ? 1 : 0);

  function clearKeepAlive() {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }

  function stopAll() {
    cancelledRef.current = true;
    clearKeepAlive();
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }

  function browserSpeak(text: string, role: Side, onEnd: () => void) {
    const voiceName = role === "moderator" ? voiceMod : role === "a" ? voiceA : voiceB;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find((x) => x.name === voiceName);
    if (v) u.voice = v;
    u.lang = v?.lang ?? "pt-BR";
    u.rate = 1.0;
    // Chrome corta falas longas (~15s); resume periódico mantém viva.
    clearKeepAlive();
    keepAliveRef.current = setInterval(() => {
      if (!window.speechSynthesis.speaking) { clearKeepAlive(); return; }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10000);
    u.onend = () => { clearKeepAlive(); if (!cancelledRef.current) onEnd(); };
    u.onerror = () => { clearKeepAlive(); };
    window.speechSynthesis.speak(u);
  }

  async function fetchAudioUrl(prov: "eleven" | "minimax", msgId: string, text: string, role: Side): Promise<string> {
    const voiceId =
      prov === "eleven"
        ? (role === "moderator" ? elMod : role === "a" ? elA : elB)
        : (role === "moderator" ? mmMod : role === "a" ? mmA : mmB);
    const cacheKey = `${prov}:${msgId}:${voiceId}`;
    const cached = audioCache.current.get(cacheKey);
    if (cached) return cached;
    let url: string;
    if (prov === "eleven") {
      const res = await elTts({ data: { text: text.slice(0, 5000), voiceId } });
      url = `data:${res.mime};base64,${res.audio}`;
    } else {
      const res = await mmTts({ data: { text: text.slice(0, 5000), voiceId, model: "speech-02-hd", speed: 1 } });
      url = `data:${res.mime};base64,${res.audioBase64}`;
    }
    audioCache.current.set(cacheKey, url);
    return url;
  }

  async function speak(msgId: string, text: string, role: Side, onEnd: () => void) {
    cancelledRef.current = false;
    if (provider === "browser") {
      browserSpeak(text, role, onEnd);
      return;
    }
    try {
      setLoading(true);
      const url = await fetchAudioUrl(provider, msgId, text, role);
      if (cancelledRef.current) return;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { if (!cancelledRef.current) onEnd(); };
      await audio.play();
    } catch {
      if (cancelledRef.current) return;
      toast.error(`${provider === "eleven" ? "ElevenLabs" : "MiniMax"} indisponível — usando voz do navegador.`);
      browserSpeak(text, role, onEnd);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!playing || !current) return;
    const advance = () => {
      if (cancelledRef.current) return;
      if (index + 1 < slideCount) setIndex((i) => i + 1);
      else setPlaying(false);
    };
    speak(current.id, current.content, (current.role ?? "moderator") as Side, advance);
    return () => { stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, current?.id, provider]);

  function go(delta: number) {
    setPlaying(false);
    stopAll();
    setIndex((i) => Math.min(slideCount - 1, Math.max(0, i + delta)));
  }

  function switchProvider(p: Provider) {
    stopAll();
    setPlaying(false);
    setProvider(p);
    try { localStorage.setItem("arena-tts-provider", p); } catch { /* ignore */ }
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
      <div className="pointer-events-none absolute inset-0 transition-all duration-700" style={{ background: theme.glow }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_120%,transparent_40%,oklch(0.08_0.02_264_/_0.8))]" />

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

      {showSettings && (
        <div className="absolute right-6 top-16 z-20 w-80 rounded-xl border border-border/60 glass p-4 space-y-3 shadow-2xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Provedor de voz</p>
            <div className="flex gap-1 rounded-md border border-border/60 bg-background/40 p-0.5">
              {([["browser", "Navegador"], ["eleven", "ElevenLabs"], ["minimax", "MiniMax"]] as const).map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => switchProvider(p)}
                  className={`flex-1 rounded px-2 py-1 text-xs transition ${provider === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50 pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vozes</p>
            {provider === "browser" && (
              <>
                <BrowserVoicePicker label="Mediador" voices={voices} value={voiceMod} onChange={setVoiceMod} />
                <BrowserVoicePicker label={data.debate.debater_a_name} voices={voices} value={voiceA} onChange={setVoiceA} />
                <BrowserVoicePicker label={data.debate.debater_b_name} voices={voices} value={voiceB} onChange={setVoiceB} />
              </>
            )}
            {provider === "eleven" && (
              <>
                <CatalogPicker label="Mediador" options={ELEVEN_VOICES} value={elMod} onChange={setElMod} />
                <CatalogPicker label={data.debate.debater_a_name} options={ELEVEN_VOICES} value={elA} onChange={setElA} />
                <CatalogPicker label={data.debate.debater_b_name} options={ELEVEN_VOICES} value={elB} onChange={setElB} />
                <p className="text-[10px] text-muted-foreground leading-snug">ElevenLabs sintetiza no servidor; cada fala consome créditos da sua chave.</p>
              </>
            )}
            {provider === "minimax" && (
              <>
                <CatalogPicker label="Mediador" options={MINIMAX_VOICES} value={mmMod} onChange={setMmMod} />
                <CatalogPicker label={data.debate.debater_a_name} options={MINIMAX_VOICES} value={mmA} onChange={setMmA} />
                <CatalogPicker label={data.debate.debater_b_name} options={MINIMAX_VOICES} value={mmB} onChange={setMmB} />
                <p className="text-[10px] text-muted-foreground leading-snug">MiniMax sintetiza no servidor; cada fala consome créditos da sua chave.</p>
              </>
            )}
          </div>
        </div>
      )}

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
              {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
            <div className="mb-8">
              <VoiceWave active={playing && !loading} colorClass={theme.dot} />
            </div>
            <p className="text-2xl md:text-[2rem] leading-relaxed md:leading-relaxed text-foreground/95 font-medium text-balance">
              {current?.content}
            </p>
          </div>
        )}
      </div>

      <div className="relative z-10 px-6 pb-6">
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

function BrowserVoicePicker({ label, voices, value, onChange }: { label: string; voices: SpeechSynthesisVoice[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground truncate max-w-[110px]">{label}</span>
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

function CatalogPicker({ label, options, value, onChange }: { label: string; options: ReadonlyArray<{ id: string; label: string }>; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground truncate max-w-[110px]">{label}</span>
      <select
        className="flex-1 min-w-0 rounded-md border border-border/60 bg-background/60 px-2 py-1 outline-none truncate"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
    </label>
  );
}
