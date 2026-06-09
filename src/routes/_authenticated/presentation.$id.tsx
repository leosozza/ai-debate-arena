import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getDebate, ttsSpeak, updateDebate, type Verdict } from "@/lib/debate.functions";
import { minimaxTts } from "@/lib/tts.functions";
import { replicateTts } from "@/lib/voice-replicate.functions";
import { useEffect, useRef, useState } from "react";
import { VoiceWave } from "@/components/VoiceWave";
import { BlockIntroCard } from "@/components/BlockIntroCard";
import { VoicePicker, DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "@/components/VoicePicker";
import { type VoiceProvider } from "@/lib/voice-catalog";
import { toast } from "sonner";
import { Play, Pause, SkipForward, SkipBack, ChevronsLeft, ChevronsRight, X, Settings2, Swords, Trophy, Loader2, Radio, Bot, Mic2 } from "lucide-react";


export const Route = createFileRoute("/_authenticated/presentation/$id")({
  component: PresentMode,
});

type Side = "moderator" | "a" | "b";

type VoiceSlot = { provider: VoiceProvider; voiceId: string | null; settings: VoiceSettings };

const DEFAULT_SLOT: VoiceSlot = { provider: "browser", voiceId: null, settings: DEFAULT_VOICE_SETTINGS };

function PresentMode() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(getDebate);
  const elTts = useServerFn(ttsSpeak);
  const mmTts = useServerFn(minimaxTts);
  const rpTts = useServerFn(replicateTts);
  const updDebate = useServerFn(updateDebate);
  const { data } = useQuery({ queryKey: ["debate", id], queryFn: () => get({ data: { id } }) });
  const [savingVoices, setSavingVoices] = useState(false);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  // Vinheta de bloco: bloco a apresentar agora (ou null se não há vinheta pendente)
  const [introBlock, setIntroBlock] = useState<number | null>(null);

  // Voz por participante (cada um pode usar um provider diferente).
  const [slotMod, setSlotMod] = useState<VoiceSlot>(DEFAULT_SLOT);
  const [slotA, setSlotA] = useState<VoiceSlot>(DEFAULT_SLOT);
  const [slotB, setSlotB] = useState<VoiceSlot>(DEFAULT_SLOT);

  // Vozes do navegador (carregadas dinamicamente)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());
  const playTokenRef = useRef(0);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    function load() {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
    }
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.cancel(); audioRef.current?.pause(); };
  }, []);

  // Hidrata vozes salvas no debate (uma vez quando carrega).
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !data?.debate) return;
    const d = data.debate;
    const apply = (provider: string | null | undefined, voiceId: string | null | undefined): VoiceSlot | null => {
      if (!provider) return null;
      const p = provider as VoiceProvider;
      if (p !== "browser" && p !== "eleven" && p !== "minimax" && p !== "replicate") return null;
      return { provider: p, voiceId: voiceId ?? null, settings: DEFAULT_VOICE_SETTINGS };
    };
    const m = apply(d.voice_provider_mod, d.voice_id_mod); if (m) setSlotMod(m);
    const a = apply(d.voice_provider_a, d.voice_id_a); if (a) setSlotA(a);
    const b = apply(d.voice_provider_b, d.voice_id_b); if (b) setSlotB(b);
    hydratedRef.current = true;
  }, [data]);


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
    // Invalida qualquer reprodução em curso — eventos atrasados não vão mais avançar.
    playTokenRef.current += 1;
    clearKeepAlive();
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* ignore */ }
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }

  function slotFor(role: Side): VoiceSlot {
    return role === "moderator" ? slotMod : role === "a" ? slotA : slotB;
  }

  function browserSpeak(text: string, role: Side, token: number, onEnd: () => void) {
    const slot = slotFor(role);
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    const u = new SpeechSynthesisUtterance(text);
    const v = slot.voiceId ? voices.find((x) => x.name === slot.voiceId) : voices.find((x) => x.lang?.toLowerCase().startsWith("pt"));
    if (v) u.voice = v;
    u.lang = v?.lang ?? "pt-BR";
    u.rate = Math.max(0.1, Math.min(10, slot.settings.speed));
    u.pitch = Math.max(0, Math.min(2, 1 + slot.settings.pitch / 12));
    u.volume = Math.max(0, Math.min(1, slot.settings.volume));
    u.onend = () => {
      clearKeepAlive();
      if (token === playTokenRef.current) setTimeout(onEnd, 0);
    };
    u.onerror = () => { clearKeepAlive(); };
    clearKeepAlive();
    keepAliveRef.current = setInterval(() => {
      if (!window.speechSynthesis.speaking) { clearKeepAlive(); return; }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10000);
    window.speechSynthesis.speak(u);
  }

  async function fetchAudioUrl(slot: VoiceSlot, msgId: string, text: string): Promise<string> {
    const voiceId = slot.voiceId ?? "";
    if (!voiceId) throw new Error("Voz não selecionada.");
    const cacheKey = `${slot.provider}:${msgId}:${voiceId}:${slot.settings.speed}:${slot.settings.pitch}:${slot.settings.volume}`;
    const cached = audioCache.current.get(cacheKey);
    if (cached) return cached;
    let url: string;
    if (slot.provider === "eleven") {
      const res = await elTts({ data: { text: text.slice(0, 5000), voiceId } });
      url = `data:${res.mime};base64,${res.audio}`;
    } else if (slot.provider === "minimax") {
      const res = await mmTts({ data: {
        text: text.slice(0, 5000), voiceId, model: "speech-02-hd",
        speed: slot.settings.speed,
        pitch: Math.round(slot.settings.pitch),
        vol: Math.max(0.1, Math.min(10, slot.settings.volume)),
      } });
      url = `data:${res.mime};base64,${res.audioBase64}`;
    } else {
      const res = await rpTts({ data: { text: text.slice(0, 5000), voiceId } });
      url = `data:${res.mime};base64,${res.audioBase64}`;
    }
    audioCache.current.set(cacheKey, url);
    return url;
  }

  async function speak(msgId: string, text: string, role: Side, onEnd: () => void) {
    playTokenRef.current += 1;
    const token = playTokenRef.current;
    const slot = slotFor(role);
    if (slot.provider === "browser") {
      browserSpeak(text, role, token, onEnd);
      return;
    }
    try {
      setLoading(true);
      const url = await fetchAudioUrl(slot, msgId, text);
      if (token !== playTokenRef.current) return;
      const audio = new Audio(url);
      audioRef.current = audio;
      // Para providers que não aceitam settings server-side, aplica no player.
      if (slot.provider === "replicate" || slot.provider === "eleven") {
        audio.playbackRate = Math.max(0.5, Math.min(2, slot.settings.speed));
        audio.volume = Math.max(0, Math.min(1, slot.settings.volume));
      }
      audio.onended = () => { if (token === playTokenRef.current) onEnd(); };
      await audio.play();
    } catch {
      if (token !== playTokenRef.current) return;
      const label = slot.provider === "eleven" ? "ElevenLabs" : slot.provider === "minimax" ? "MiniMax" : "Replicate";
      toast.error(`${label} indisponível — usando voz do navegador.`);
      browserSpeak(text, role, token, onEnd);
    } finally {
      setLoading(false);
    }
  }

  // Cartela do bloco só aparece DEPOIS que o usuário começa (não bloqueia o botão Tocar).
  const lastBlockShownRef = useRef<number>(-1);
  const subtopicsList = (data?.debate?.block_subtopics as Array<{ title: string; focus: string }> | null) ?? [];
  const blocksTotal = data?.debate?.blocks_count ?? subtopicsList.length ?? 1;
  useEffect(() => {
    if (!playing || !current) return;
    const b = current.block_index ?? 0;
    if (blocksTotal > 1 && subtopicsList[b] && lastBlockShownRef.current !== b) {
      lastBlockShownRef.current = b;
      stopAll();
      setIntroBlock(b);
    }
  }, [playing, current?.id, blocksTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing || !current || introBlock !== null) return;
    const advance = () => {
      if (index + 1 < slideCount) setIndex((i) => i + 1);
      else setPlaying(false);
    };
    speak(current.id, current.content, (current.role ?? "moderator") as Side, advance);
    return () => { stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, current?.id, introBlock, slotMod, slotA, slotB]);


  function handlePlayToggle() {
    if (!playing) hasStartedRef.current = true;
    setPlaying((p) => !p);
  }

  function goToBlock(delta: -1 | 1) {
    if (!messages.length) return;
    const currentBlock = current?.block_index ?? 0;
    const target = Math.max(0, Math.min(blocksTotal - 1, currentBlock + delta));
    if (target === currentBlock) return;
    const firstIdx = messages.findIndex((m) => (m.block_index ?? 0) === target);
    if (firstIdx === -1) return;
    stopAll();
    lastBlockShownRef.current = -1; // permite a cartela aparecer de novo
    setIndex(firstIdx);
  }

  function go(delta: number) {
    stopAll();
    setIndex((i) => Math.min(slideCount - 1, Math.max(0, i + delta)));
  }

  async function saveVoicesToDebate() {
    setSavingVoices(true);
    try {
      await updDebate({ data: {
        id,
        voiceProviderMod: slotMod.provider, voiceIdMod: slotMod.voiceId,
        voiceProviderA: slotA.provider, voiceIdA: slotA.voiceId,
        voiceProviderB: slotB.provider, voiceIdB: slotB.voiceId,
      } });
      toast.success("Vozes salvas neste debate");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar vozes");
    } finally {
      setSavingVoices(false);
    }
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
  const theme = sideTheme(role);
  const currentBlockIdx = current?.block_index ?? 0;
  const currentSubtopic = subtopicsList[currentBlockIdx];
  const moderatorSpeaking = !isWinner && role === "moderator";
  const speakerContent = current?.content ?? "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[oklch(0.12_0.02_264)] text-foreground">
      {introBlock !== null && subtopicsList[introBlock] && (
        <BlockIntroCard
          blockIndex={introBlock}
          total={blocksTotal}
          title={subtopicsList[introBlock].title}
          focus={subtopicsList[introBlock].focus}
          onDone={() => setIntroBlock(null)}
        />
      )}
      <div className="pointer-events-none absolute inset-0 transition-all duration-700" style={{ background: theme.glow }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_120%,transparent_40%,oklch(0.08_0.02_264_/_0.8))]" />

      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground min-w-0">
          <Swords className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate max-w-[30vw]">{data.debate.topic}</span>
          {blocksTotal > 1 && currentSubtopic && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-xs uppercase tracking-wider text-primary font-semibold shrink-0">
                Bloco {currentBlockIdx + 1}/{blocksTotal}
              </span>
              <span className="truncate text-foreground/80">{currentSubtopic.title}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setShowSettings((s) => !s)}>
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { stopAll(); router.navigate({ to: "/debates/$id", params: { id } }); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>


      {showSettings && (
        <div className="absolute right-6 top-16 z-20 w-96 max-h-[80vh] overflow-y-auto rounded-xl border border-border/60 glass p-4 space-y-4 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vozes por participante</p>
          <VoicePicker
            label="Mediador"
            provider={slotMod.provider}
            voiceId={slotMod.voiceId}
            onChange={(provider, voiceId) => setSlotMod((s) => ({ ...s, provider, voiceId }))}
            settings={slotMod.settings}
            onSettingsChange={(settings) => setSlotMod((s) => ({ ...s, settings }))}
          />
          <VoicePicker
            label={data.debate.debater_a_name}
            provider={slotA.provider}
            voiceId={slotA.voiceId}
            onChange={(provider, voiceId) => setSlotA((s) => ({ ...s, provider, voiceId }))}
            settings={slotA.settings}
            onSettingsChange={(settings) => setSlotA((s) => ({ ...s, settings }))}
          />
          <VoicePicker
            label={data.debate.debater_b_name}
            provider={slotB.provider}
            voiceId={slotB.voiceId}
            onChange={(provider, voiceId) => setSlotB((s) => ({ ...s, provider, voiceId }))}
            settings={slotB.settings}
            onSettingsChange={(settings) => setSlotB((s) => ({ ...s, settings }))}
          />

          <div className="border-t border-border/50 pt-3 space-y-2">
            <Button
              onClick={saveVoicesToDebate}
              disabled={savingVoices}
              className="w-full"
              size="sm"
            >
              {savingVoices ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              💾 Salvar essas vozes no debate
            </Button>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Persiste a escolha — aplicada nas próximas reproduções e gravada para todos.
            </p>
          </div>
        </div>
      )}

      <div className="relative z-10 flex-1 min-h-0 px-4 pb-2 md:px-8">
        {isWinner && verdict ? (
          <div className="flex h-full items-center justify-center">
            <WinnerStage verdict={verdict} aName={data.debate.debater_a_name} bName={data.debate.debater_b_name} />
          </div>
        ) : (
          <div key={current?.id} className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 animate-in fade-in duration-500">
            <section className={`relative mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border px-4 py-3 md:px-6 md:py-4 ${moderatorSpeaking ? "border-primary/60 bg-primary/10 shadow-[0_0_60px_oklch(0.62_0.205_277_/_0.20)]" : "border-border/70 glass"}`}>
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" aria-hidden />
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${moderatorSpeaking ? "border-primary/50 bg-primary text-primary-foreground" : "border-border/70 bg-secondary text-muted-foreground"}`}>
                    <Mic2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                      <Radio className="h-3.5 w-3.5 text-primary" />
                      Mediador
                    </div>
                    <h2 className="font-display text-xl font-extrabold text-foreground md:text-3xl">Estúdio Central</h2>
                  </div>
                </div>
                <div className="hidden w-40 shrink-0 md:block">
                  <VoiceWave active={moderatorSpeaking && playing && !loading} colorClass="bg-primary" bars={24} />
                </div>
              </div>
              <p className={`mt-3 text-base leading-relaxed md:text-xl ${moderatorSpeaking ? "text-foreground" : "text-muted-foreground"}`}>
                {moderatorSpeaking ? speakerContent : currentSubtopic?.focus ?? data.debate.topic}
              </p>
            </section>

            <section className="relative grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
              <StageDebaterPanel
                side="a"
                name={data.debate.debater_a_name}
                phase={current?.phase ?? ""}
                content={role === "a" ? speakerContent : ""}
                active={role === "a"}
                speaking={role === "a" && playing && !loading}
                loading={role === "a" && loading}
              />
              <div className="hidden items-center justify-center md:flex">
                <div className="relative flex h-full w-20 items-center justify-center">
                  <div className="absolute inset-y-10 w-px bg-gradient-to-b from-transparent via-border to-transparent" aria-hidden />
                  <div className="z-10 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-xs font-extrabold text-muted-foreground shadow-2xl">
                    VS
                  </div>
                </div>
              </div>
              <StageDebaterPanel
                side="b"
                name={data.debate.debater_b_name}
                phase={current?.phase ?? ""}
                content={role === "b" ? speakerContent : ""}
                active={role === "b"}
                speaking={role === "b" && playing && !loading}
                loading={role === "b" && loading}
              />
            </section>
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

        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/60 glass px-3 py-3 md:gap-3 md:px-4">
          {blocksTotal > 1 && (
            <Button size="icon" variant="ghost" onClick={() => goToBlock(-1)} disabled={(current?.block_index ?? 0) === 0} title="Bloco anterior">
              <ChevronsLeft className="h-5 w-5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => go(-1)} disabled={index === 0} title="Fala anterior">
            <SkipBack className="h-5 w-5" />
          </Button>
          <Button size="lg" className="gap-2 px-6 shadow-lg shadow-primary/20 md:px-8" onClick={handlePlayToggle}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            {playing ? "Pausar" : "Tocar"}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => go(1)} disabled={index >= slideCount - 1} title="Próxima fala">
            <SkipForward className="h-5 w-5" />
          </Button>
          {blocksTotal > 1 && (
            <Button size="icon" variant="ghost" onClick={() => goToBlock(1)} disabled={(current?.block_index ?? 0) >= blocksTotal - 1} title="Próximo bloco">
              <ChevronsRight className="h-5 w-5" />
            </Button>
          )}
          <span className="ml-1 text-xs tabular-nums text-muted-foreground md:ml-2 md:text-sm">{index + 1} / {slideCount}</span>
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

function StageDebaterPanel({
  side,
  name,
  phase,
  content,
  active,
  speaking,
  loading,
}: {
  side: "a" | "b";
  name: string;
  phase: string;
  content: string;
  active: boolean;
  speaking: boolean;
  loading: boolean;
}) {
  const theme = sideTheme(side);
  const align = side === "a" ? "md:text-left" : "md:text-right";
  const avatarPosition = side === "a" ? "md:items-start" : "md:items-end";
  const activeBorder = side === "a" ? "border-side-a/70" : "border-side-b/70";

  return (
    <article
      className={`relative flex min-h-[18rem] overflow-hidden rounded-2xl border p-4 transition-all duration-500 md:min-h-0 md:p-6 ${
        active
          ? `${activeBorder} bg-card/80 shadow-2xl`
          : "border-border/60 bg-card/35 opacity-75"
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 ${active ? "opacity-100" : "opacity-35"}`} style={{ background: theme.glow }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/70 to-transparent" aria-hidden />
      <div className={`relative z-10 flex h-full w-full flex-col justify-between gap-4 text-center ${align} ${avatarPosition}`}>
        <div className={`flex w-full flex-col items-center gap-3 ${avatarPosition}`}>
          <div className={`relative flex h-24 w-24 items-center justify-center rounded-full border-2 md:h-32 md:w-32 ${active ? `${theme.text} border-current bg-background/70` : "border-border text-muted-foreground bg-secondary/50"}`}>
            {active && <span className={`absolute inset-[-8px] rounded-full border ${theme.text} opacity-30 animate-ping`} />}
            <Bot className="h-12 w-12 md:h-16 md:w-16" />
          </div>
          <div className="min-w-0">
            <div className={`mb-1 text-xs font-semibold uppercase tracking-[0.28em] ${active ? theme.text : "text-muted-foreground"}`}>
              IA {side.toUpperCase()}
            </div>
            <h3 className={`font-display text-2xl font-extrabold md:text-4xl ${active ? theme.text : "text-foreground"}`}>{name}</h3>
          </div>
        </div>

        <div className="w-full">
          <div className="mb-3 flex min-h-16 items-center justify-center">
            <VoiceWave active={speaking} colorClass={theme.dot} bars={28} />
          </div>
          {loading && active && (
            <div className="mb-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Preparando voz
            </div>
          )}
          <div className={`mb-2 text-xs font-semibold uppercase tracking-[0.24em] ${active ? theme.text : "text-muted-foreground"}`}>
            {active ? phase : "Aguardando"}
          </div>
          <p className={`mx-auto max-w-xl text-base leading-relaxed md:text-xl ${active ? "text-foreground" : "text-muted-foreground"}`}>
            {active ? content : ""}
          </p>
        </div>
      </div>
    </article>
  );
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

function PreviewBtn({ state, onClick }: { state: "idle" | "loading" | "playing"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background"
      aria-label={state === "playing" ? "Parar amostra" : "Ouvir amostra"}
      title={state === "playing" ? "Parar" : "Ouvir amostra"}
    >
      {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === "playing" ? <Square className="h-3 w-3" /> : <Volume2 className="h-3.5 w-3.5" />}
    </button>
  );
}

function BrowserVoicePicker({ label, voices, value, onChange, onPreview, preview }: { label: string; voices: SpeechSynthesisVoice[]; value: string; onChange: (v: string) => void; onPreview: (id: string) => void; preview: "idle" | "loading" | "playing" }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground truncate w-[90px]">{label}</span>
      <select
        className="flex-1 min-w-0 rounded-md border border-border/60 bg-background/60 px-2 py-1 outline-none truncate"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
      </select>
      <PreviewBtn state={preview} onClick={() => onPreview(value)} />
    </div>
  );
}

function CatalogPicker({ label, options, value, onChange, onPreview, preview }: { label: string; options: ReadonlyArray<{ id: string; label: string }>; value: string; onChange: (v: string) => void; onPreview: (id: string) => void; preview: "idle" | "loading" | "playing" }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground truncate w-[90px]">{label}</span>
      <select
        className="flex-1 min-w-0 rounded-md border border-border/60 bg-background/60 px-2 py-1 outline-none truncate"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
      <PreviewBtn state={preview} onClick={() => onPreview(value)} />
    </div>
  );
}
