import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getDebate, ttsSpeak, updateDebate, type Verdict } from "@/lib/debate.functions";
import { listParticipants } from "@/lib/debate-participants.functions";
import { listPersonas } from "@/lib/persona.functions";
import { minimaxTts } from "@/lib/tts.functions";
import { replicateTts } from "@/lib/voice-replicate.functions";
import { ensurePersonaVignette } from "@/lib/persona-video.functions";
import { useEffect, useRef, useState } from "react";
import { VoiceWave } from "@/components/VoiceWave";
import { BlockIntroCard } from "@/components/BlockIntroCard";
// DebaterIntroCard substituído por OpeningSequence.
import { ClosingCard } from "@/components/ClosingCard";
import { AIDisclaimer, AI_DISCLAIMER_TEXT } from "@/components/AIDisclaimer";
// OpeningSequence removido: apresentação dos convidados agora é narrada pelo mediador no palco.
import { OpeningVignette } from "@/components/OpeningVignette";
import { PreparationScreen } from "@/components/PreparationScreen";
import { Teleprompter } from "@/components/Teleprompter";
import { VoicePicker, DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "@/components/VoicePicker";
import { type VoiceProvider } from "@/lib/voice-catalog";
import { stripMarkdownForTts } from "@/lib/text-utils";
import { toast } from "sonner";
import { Play, Pause, SkipForward, SkipBack, ChevronsLeft, ChevronsRight, X, Settings2, Swords, Loader2, Radio, Bot, Mic2, Download, Film, AlertTriangle, RotateCcw } from "lucide-react";


export const Route = createFileRoute("/_authenticated/presentation/$id")({
  component: PresentMode,
});

type Side = "moderator" | "a" | "b" | string;

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
  const ensureVig = useServerFn(ensurePersonaVignette);
  const { data } = useQuery({ queryKey: ["debate", id], queryFn: () => get({ data: { id } }) });
  const lp = useServerFn(listPersonas);
  const { data: personas } = useQuery({ queryKey: ["personas"], queryFn: () => lp() });
  const listExtrasFn = useServerFn(listParticipants);
  const { data: extras = [] } = useQuery({ queryKey: ["debate-participants", id], queryFn: () => listExtrasFn({ data: { debateId: id } }) });
  const [savingVoices, setSavingVoices] = useState(false);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  // Duração do áudio atual (para teleprompter)
  const [currentAudioMs, setCurrentAudioMs] = useState<number | null>(null);
  // Aviso quando a voz clonada cai para o navegador
  const [voiceFallback, setVoiceFallback] = useState<{ msgId: string; reason: string } | null>(null);
  // Phase machine: disclaimer (CTA) → preparing (gen voices+vignettes) → vignette (cinematic+music) → live (mediador narra aviso+intro)
  type Phase = "disclaimer" | "preparing" | "vignette" | "live";
  const [phase, setPhase] = useState<Phase>("disclaimer");
  const [prepVoices, setPrepVoices] = useState({ done: 0, total: 0, status: "idle" as "idle" | "running" | "done" | "error" });
  const [prepVigA, setPrepVigA] = useState({ status: "idle" as "idle" | "running" | "done" | "error", message: "" });
  const [prepVigB, setPrepVigB] = useState({ status: "idle" as "idle" | "running" | "done" | "error", message: "" });
  const [vignetteA, setVignetteA] = useState<string | null>(null);
  const [vignetteB, setVignetteB] = useState<string | null>(null);
  // Vinheta de bloco: bloco a apresentar agora (ou null se não há vinheta pendente)
  const [introBlock, setIntroBlock] = useState<number | null>(null);

  // Voz por participante (cada um pode usar um provider diferente).
  const [slotMod, setSlotMod] = useState<VoiceSlot>(DEFAULT_SLOT);
  const [slotA, setSlotA] = useState<VoiceSlot>(DEFAULT_SLOT);
  const [slotB, setSlotB] = useState<VoiceSlot>(DEFAULT_SLOT);

  // Vozes do navegador (carregadas dinamicamente)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Singleton audio element — created once on first user gesture so subsequent
  // play() calls don't lose the autoplay permission on mobile Safari.
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
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const findPersona = (name: string | null | undefined) => {
      const n = norm(name);
      if (!n || !personas) return null;
      return personas.find((p) => norm(p.name) === n) ?? null;
    };
    const apply = (
      provider: string | null | undefined,
      voiceId: string | null | undefined,
      personaName?: string | null,
    ): VoiceSlot | null => {
      // Persona é a fonte de verdade quando tem voz definida (especialmente clonada).
      const persona = findPersona(personaName);
      const pp = persona?.voice_provider as VoiceProvider | null | undefined;
      const pid = persona?.voice_id ?? null;
      if (pp && (pp === "browser" || pp === "eleven" || pp === "minimax" || pp === "replicate")) {
        return { provider: pp, voiceId: pid, settings: DEFAULT_VOICE_SETTINGS };
      }
      if (!provider) return null;
      const p = provider as VoiceProvider;
      if (p !== "browser" && p !== "eleven" && p !== "minimax" && p !== "replicate") return null;
      return { provider: p, voiceId: voiceId ?? null, settings: DEFAULT_VOICE_SETTINGS };
    };
    const m = apply(d.voice_provider_mod, d.voice_id_mod); if (m) setSlotMod(m);
    const a = apply(d.voice_provider_a, d.voice_id_a, d.debater_a_name); if (a) setSlotA(a);
    const b = apply(d.voice_provider_b, d.voice_id_b, d.debater_b_name); if (b) setSlotB(b);
    if (personas) hydratedRef.current = true;
  }, [data, personas]);


  // Inject 2 virtual moderator openings (AI disclaimer + guests intro) before the scripted debate.
  const debateInfo = data?.debate;
  const rawMessages = data?.messages ?? [];
  const virtualOpening = debateInfo
    ? [
        {
          id: "__opening_disclaimer__",
          role: "moderator" as const,
          phase: "abertura",
          block_index: 0,
          content: AI_DISCLAIMER_TEXT,
        },
        {
          id: "__opening_guests__",
          role: "moderator" as const,
          phase: "abertura",
          block_index: 0,
          content:
            `Boa noite, e bem-vindos à Legends Arena. Hoje na arena, o tema é: ${debateInfo.topic}. ` +
            `À minha direita, ${debateInfo.debater_a_name}. ` +
            `À minha esquerda, ${debateInfo.debater_b_name}. ` +
            `Que vença o melhor argumento.`,
        },
      ]
    : [];
  const messages = [...virtualOpening, ...rawMessages];
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
      // NÃO destruir o elemento — manter a permissão de autoplay no mobile.
    }
  }

  function ensureAudioEl(): HTMLAudioElement {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      audioRef.current = a;
    }
    return audioRef.current;
  }

  function slotFor(role: Side): VoiceSlot {
    if (role === "moderator") return slotMod;
    if (role === "a") return slotA;
    if (role === "b") return slotB;
    if (typeof role === "string" && role.startsWith("ex")) {
      const slot = Number(role.slice(2));
      const e = extras.find((x) => x.slot === slot);
      if (e) return { provider: ((e.voice_provider as VoiceProvider | null) ?? "browser"), voiceId: e.voice_id ?? null, settings: DEFAULT_VOICE_SETTINGS };
    }
    return slotB;
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
    // Estima duração para teleprompter
    const estMs = Math.round((Math.max(20, text.length) / 14) * 1000 / Math.max(0.5, u.rate));
    setCurrentAudioMs(estMs);
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
    const clean = stripMarkdownForTts(text).slice(0, 5000);
    const cacheKey = `${slot.provider}:${msgId}:${voiceId}:${slot.settings.speed}:${slot.settings.pitch}:${slot.settings.volume}`;
    const cached = audioCache.current.get(cacheKey);
    if (cached) return cached;
    let url: string;
    if (slot.provider === "eleven") {
      const res = await elTts({ data: { text: clean, voiceId } });
      url = `data:${res.mime};base64,${res.audio}`;
    } else if (slot.provider === "minimax") {
      const res = await mmTts({ data: {
        text: clean, voiceId, model: "speech-02-hd",
        speed: slot.settings.speed,
        pitch: Math.round(slot.settings.pitch),
        vol: Math.max(0.1, Math.min(10, slot.settings.volume)),
      } });
      url = `data:${res.mime};base64,${res.audioBase64}`;
    } else {
      const res = await rpTts({ data: { text: clean, voiceId } });
      url = `data:${res.mime};base64,${res.audioBase64}`;
    }
    audioCache.current.set(cacheKey, url);
    return url;
  }

  async function speak(msgId: string, text: string, role: Side, onEnd: () => void) {
    playTokenRef.current += 1;
    const token = playTokenRef.current;
    const slot = slotFor(role);
    const clean = stripMarkdownForTts(text);
    setVoiceFallback((f) => (f?.msgId === msgId ? null : f));
    if (slot.provider === "browser" || !slot.voiceId) {
      // Avisa quando um debatedor (A/B) cai para voz do navegador por falta de voiceId —
      // sintoma típico do "a voz do convidado não tocou".
      if (role !== "moderator" && slot.provider !== "browser" && !slot.voiceId) {
        const who = role === "a" ? "Convidado A" : role === "b" ? "Convidado B" : "Participante";
        toast.warning(`${who} sem voz configurada — usando voz do navegador. Ajuste em Configurações.`, { duration: 5000 });
        setVoiceFallback({ msgId, reason: "Nenhuma voz selecionada para este participante." });
      }
      browserSpeak(clean, role, token, onEnd);
      return;
    }
    try {
      setLoading(true);
      const url = await fetchAudioUrl(slot, msgId, clean);
      if (token !== playTokenRef.current) return;
      const audio = ensureAudioEl();
      audio.onended = null;
      audio.onloadedmetadata = () => {
        if (token !== playTokenRef.current) return;
        if (isFinite(audio.duration) && audio.duration > 0) {
          setCurrentAudioMs(Math.round(audio.duration * 1000));
        }
      };
      audio.src = url;
      // Para providers que não aceitam settings server-side, aplica no player.
      if (slot.provider === "replicate" || slot.provider === "eleven") {
        audio.playbackRate = Math.max(0.5, Math.min(2, slot.settings.speed));
        audio.volume = Math.max(0, Math.min(1, slot.settings.volume));
      } else {
        audio.playbackRate = 1;
        audio.volume = 1;
      }
      audio.onended = () => { if (token === playTokenRef.current) onEnd(); };
      await audio.play();
      // Prefetch das próximas 2 falas em background (não bloqueia).
      void prefetchUpcoming(2);
    } catch (err) {
      if (token !== playTokenRef.current) return;
      const label = slot.provider === "eleven" ? "ElevenLabs" : slot.provider === "minimax" ? "MiniMax" : "Replicate";
      const reason = err instanceof Error ? err.message : "erro desconhecido";
      toast.error(`${label} falhou: ${reason.slice(0, 120)} — usando voz do navegador.`, { duration: 6000 });
      setVoiceFallback({ msgId, reason });
      browserSpeak(clean, role, token, onEnd);
    } finally {
      setLoading(false);
    }
  }

  /** Retenta a fala atual (útil quando a voz clonada falhou). */
  function retryCurrent() {
    if (!current) return;
    // Invalida cache desta mensagem para forçar nova chamada.
    const slot = slotFor((current.role ?? "moderator") as Side);
    const cacheKeyPrefix = `${slot.provider}:${current.id}:`;
    for (const k of Array.from(audioCache.current.keys())) {
      if (k.startsWith(cacheKeyPrefix)) audioCache.current.delete(k);
    }
    setVoiceFallback(null);
    stopAll();
    // Re-dispara o efeito de speak
    setPlaying(false);
    setTimeout(() => setPlaying(true), 50);
  }

  async function prefetchUpcoming(count: number) {
    for (let k = 1; k <= count; k++) {
      const m = messages[index + k];
      if (!m) return;
      const slot = slotFor((m.role ?? "moderator") as Side);
      if (slot.provider === "browser" || !slot.voiceId) continue;
      try { await fetchAudioUrl(slot, m.id, m.content); } catch { /* silencioso */ }
    }
  }

  const [pregenProgress, setPregenProgress] = useState<{ done: number; total: number } | null>(null);
  async function pregenerateAll() {
    const todo = messages
      .map((m) => ({ m, slot: slotFor((m.role ?? "moderator") as Side) }))
      .filter(({ slot }) => slot.provider !== "browser" && slot.voiceId);
    if (todo.length === 0) {
      toast.info("Nada para pré-gerar (todas as vozes são do navegador).");
      return;
    }
    setPregenProgress({ done: 0, total: todo.length });
    let done = 0;
    const concurrency = 3;
    let cursor = 0;
    async function worker() {
      while (cursor < todo.length) {
        const i = cursor++;
        const { m, slot } = todo[i];
        try { await fetchAudioUrl(slot, m.id, m.content); } catch { /* ignora falha individual */ }
        done++;
        setPregenProgress({ done, total: todo.length });
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    setPregenProgress(null);
    toast.success(`Vozes pré-geradas (${done}/${todo.length}). Reprodução agora é instantânea.`);
  }

  const [exportProgress, setExportProgress] = useState<{ label: string; pct: number } | null>(null);
  async function exportVideo() {
    if (!data) return;
    const browserSlots = messages.filter((m) => {
      const s = slotFor((m.role ?? "moderator") as Side);
      return s.provider === "browser" || !s.voiceId;
    });
    if (browserSlots.length > 0) {
      toast.error("Defina uma voz não-navegador para todos os participantes antes de exportar.");
      return;
    }
    setExportProgress({ label: "Preparando vozes", pct: 0 });
    try {
      // 1) Gera todas as vozes (com progresso)
      const todo = messages.map((m) => ({ m, slot: slotFor((m.role ?? "moderator") as Side) }));
      let voiceDone = 0;
      const concurrency = 3;
      let cursor = 0;
      const audioByMsg = new Map<string, string>();
      async function worker() {
        while (cursor < todo.length) {
          const i = cursor++;
          const { m, slot } = todo[i];
          try {
            const url = await fetchAudioUrl(slot, m.id, m.content);
            audioByMsg.set(m.id, url);
          } catch {
            // skip — vai falhar no export se faltar
          }
          voiceDone++;
          setExportProgress({
            label: `Gerando vozes ${voiceDone}/${todo.length}`,
            pct: (voiceDone / todo.length) * 0.35,
          });
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker));

      const missing = messages.filter((m) => !audioByMsg.get(m.id));
      if (missing.length > 0) {
        toast.error(`Falha ao gerar ${missing.length} áudio(s). Tente novamente.`);
        setExportProgress(null);
        return;
      }

      // 2) Importa o exporter (lazy) e gera o MP4
      const { exportDebateMp4 } = await import("@/lib/video-export");
      const findP = (name: string | null | undefined) =>
        personas?.find((p) => (p.name ?? "").trim().toLowerCase() === (name ?? "").trim().toLowerCase()) ?? null;
      const pA = findP(data.debate.debater_a_name);
      const pB = findP(data.debate.debater_b_name);
      const blob = await exportDebateMp4({
        topic: data.debate.topic,
        aName: data.debate.debater_a_name,
        bName: data.debate.debater_b_name,
        aImageUrl: data.debate.debater_a_image_url ?? pA?.image_url ?? null,
        bImageUrl: data.debate.debater_b_image_url ?? pB?.image_url ?? null,
        aDescription: pA?.description ?? null,
        bDescription: pB?.description ?? null,
        messages: messages.map((m) => ({
          id: m.id,
          role: ((m.role === "a" || m.role === "b") ? m.role : "moderator") as "moderator" | "a" | "b",
          phase: m.phase ?? "",
          content: m.content,
          audioUrl: audioByMsg.get(m.id)!,
        })),
        onProgress: (label, pct) =>
          setExportProgress({ label, pct: 0.35 + pct * 0.65 }),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `debate-${id.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Vídeo MP4 exportado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar vídeo");
    } finally {
      setExportProgress(null);
    }
  }


  // Cartela do bloco só aparece DEPOIS que o usuário começa (não bloqueia o botão Tocar).
  const lastBlockShownRef = useRef<number>(-1);
  const subtopicsList = (data?.debate?.block_subtopics as Array<{ title: string; focus: string }> | null) ?? [];
  const blocksTotal = data?.debate?.blocks_count ?? subtopicsList.length ?? 1;
  useEffect(() => {
    if (!playing || !current) return;
    const b = current.block_index ?? 0;
    // O bloco 0 é coberto pelo card de apresentação dos convidados (DebaterIntroCard),
    // então não exibimos o BlockIntroCard tradicional nesse caso.
    if (b > 0 && blocksTotal > 1 && subtopicsList[b] && lastBlockShownRef.current !== b) {
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
    if (!playing) {
      hasStartedRef.current = true;
      // Cria o elemento de áudio AQUI dentro do gesto do clique → preserva
      // permissão de autoplay no iOS Safari mesmo após awaits longos.
      ensureAudioEl();
    }
    setPlaying((p) => !p);
  }

  // Preparação: gera vozes (paralelo, concurrency=3) + vinhetas (paralelo).
  const prepStartedRef = useRef(false);
  useEffect(() => {
    if (phase !== "preparing" || prepStartedRef.current || !data || !personas) return;
    prepStartedRef.current = true;
    // Garante elemento de áudio criado por gesto (clique no disclaimer já contou).
    ensureAudioEl();

    // 1) Vozes
    (async () => {
      const todo = messages
        .map((m) => ({ m, slot: slotFor((m.role ?? "moderator") as Side) }))
        .filter(({ slot }) => slot.provider !== "browser" && slot.voiceId);
      if (todo.length === 0) {
        setPrepVoices({ done: 0, total: 0, status: "done" });
        return;
      }
      setPrepVoices({ done: 0, total: todo.length, status: "running" });
      let done = 0;
      let cursor = 0;
      const concurrency = 3;
      const worker = async () => {
        while (cursor < todo.length) {
          const i = cursor++;
          const { m, slot } = todo[i];
          try { await fetchAudioUrl(slot, m.id, m.content); } catch { /* ignora individual */ }
          done++;
          setPrepVoices({ done, total: todo.length, status: "running" });
        }
      };
      await Promise.all(Array.from({ length: concurrency }, worker));
      setPrepVoices({ done, total: todo.length, status: "done" });
    })();

    // 2) Vinhetas das personas (paralelo, não bloqueante para abrir o programa)
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const pA = personas.find((p) => norm(p.name) === norm(data.debate.debater_a_name)) ?? null;
    const pB = personas.find((p) => norm(p.name) === norm(data.debate.debater_b_name)) ?? null;

    const fetchVig = async (
      persona: typeof pA,
      setStatus: (s: { status: "idle" | "running" | "done" | "error"; message: string }) => void,
      setUrl: (u: string | null) => void,
    ) => {
      if (!persona) { setStatus({ status: "done", message: "sem persona" }); return; }
      if (!persona.image_url) { setStatus({ status: "done", message: "sem imagem" }); return; }
      setStatus({ status: "running", message: "gerando…" });
      try {
        const res = await ensureVig({ data: { personaId: persona.id, aspectRatio: "16:9" } });
        setUrl(res.vignetteUrl);
        setStatus({ status: "done", message: res.cached ? "pronta" : "nova" });
      } catch (e) {
        setStatus({ status: "error", message: e instanceof Error ? e.message.slice(0, 40) : "falhou" });
      }
    };
    void fetchVig(pA, setPrepVigA, setVignetteA);
    void fetchVig(pB, setPrepVigB, setVignetteB);
  }, [phase, data, personas, messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-avança para a vinheta cinematográfica quando vozes terminam.
  useEffect(() => {
    if (phase !== "preparing") return;
    if (prepVoices.status === "done") {
      const t = setTimeout(() => setPhase("vignette"), 600);
      return () => clearTimeout(t);
    }
  }, [phase, prepVoices.status]);


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

  if (rawMessages.length === 0) {
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

  // Resolve persona description/image once for the intro / closing cards.
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const personaA = personas?.find((p) => norm(p.name) === norm(data.debate.debater_a_name)) ?? null;
  const personaB = personas?.find((p) => norm(p.name) === norm(data.debate.debater_b_name)) ?? null;
  const aImageResolved = data.debate.debater_a_image_url ?? personaA?.image_url ?? null;
  const bImageResolved = data.debate.debater_b_image_url ?? personaB?.image_url ?? null;
  const aDescription = personaA?.description ?? null;
  const bDescription = personaB?.description ?? null;

  // N-up extra speaker: when current role is `ex<slot>`, find matching participant.
  const extraSpeaker = (() => {
    if (!current || typeof current.role !== "string" || !current.role.startsWith("ex")) return null;
    const slot = Number(current.role.slice(2));
    return extras.find((e) => e.slot === slot) ?? null;
  })();

  // Tarefas da preparação (montadas em tempo real para o PreparationScreen).
  const prepTasks = [
    { label: "Gerando vozes", done: prepVoices.done, total: prepVoices.total || 1, status: prepVoices.status },
    { label: `Vinheta · ${data.debate.debater_a_name}`, done: prepVigA.status === "done" ? 1 : 0, total: 1, status: prepVigA.status, message: prepVigA.message },
    { label: `Vinheta · ${data.debate.debater_b_name}`, done: prepVigB.status === "done" ? 1 : 0, total: 1, status: prepVigB.status, message: prepVigB.message },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[oklch(0.12_0.02_264)] text-foreground">
      <AIDisclaimer variant="footer" />
      {phase === "disclaimer" && (
        <button
          type="button"
          onClick={() => {
            // Prime audio element dentro do gesto → libera autoplay no iOS Safari.
            const a = ensureAudioEl();
            a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
            a.play().then(() => a.pause()).catch(() => { /* ignore */ });
            setPhase("preparing");
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-md cursor-pointer"
          aria-label="Continuar"
        >
          <AIDisclaimer variant="card" />
        </button>
      )}
      {phase === "preparing" && (
        <PreparationScreen
          tasks={prepTasks}
          canSkip
          onSkip={() => setPhase("vignette")}
        />
      )}
      {phase === "vignette" && (
        <OpeningVignette
          topic={data.debate.topic}
          audioPrimed
          compact
          onDone={() => { setPhase("live"); setPlaying(true); }}
        />
      )}

      {introBlock !== null && subtopicsList[introBlock] && (
        <BlockIntroCard
          blockIndex={introBlock}
          total={blocksTotal}
          title={subtopicsList[introBlock].title}
          focus={subtopicsList[introBlock].focus}
          onDone={() => setIntroBlock(null)}
        />
      )}
      {extraSpeaker && !isWinner && (
        <div className="absolute inset-x-0 top-20 z-30 mx-auto w-[min(92%,42rem)] rounded-2xl border border-primary/40 bg-card/90 p-4 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-3">
            {extraSpeaker.image_url ? (
              <img src={extraSpeaker.image_url} alt={extraSpeaker.display_name} className="h-14 w-14 rounded-full border-2 border-primary object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center border-2 border-primary"><Bot className="h-7 w-7 text-primary" /></div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.28em] text-primary font-semibold">{extraSpeaker.role.replace("_", " ")}</div>
              <h3 className="font-display text-lg md:text-2xl font-extrabold text-foreground truncate">{extraSpeaker.display_name}</h3>
            </div>
            <VoiceWave active={playing && !loading} colorClass="bg-primary" bars={16} />
          </div>
          <p className="mt-3 text-sm md:text-base leading-relaxed text-foreground/90">{speakerContent}</p>
        </div>
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
            <Button
              onClick={pregenerateAll}
              disabled={pregenProgress !== null}
              variant="secondary"
              className="w-full"
              size="sm"
            >
              {pregenProgress !== null ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Gerando {pregenProgress.done}/{pregenProgress.total}…</>
              ) : (
                <><Download className="h-3.5 w-3.5 mr-1.5" /> Pré-gerar todas as vozes</>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Gera todos os áudios agora — sem pausas durante a transmissão ao vivo.
            </p>

            <Button
              onClick={exportVideo}
              disabled={exportProgress !== null || pregenProgress !== null}
              className="w-full"
              size="sm"
            >
              {exportProgress !== null ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> {exportProgress.label} ({Math.round(exportProgress.pct * 100)}%)</>
              ) : (
                <><Film className="h-3.5 w-3.5 mr-1.5" /> Exportar vídeo MP4 (720p)</>
              )}
            </Button>
            {exportProgress !== null && (
              <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(exportProgress.pct * 100)}%` }} />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground leading-snug">
              Gera as vozes (se faltar) e monta um MP4 720p com avatares + legendas. Tudo no seu navegador — pode demorar alguns minutos.
              Defina vozes não-navegador para todos os participantes antes de exportar.
            </p>
          </div>

        </div>
      )}

      <div className="relative z-10 flex-1 min-h-0 px-4 pb-2 md:px-8">
        {isWinner && verdict ? (
          <div className="flex h-full items-center justify-center">
            <ClosingCard
              topic={data.debate.topic}
              verdict={verdict}
              a={{ name: data.debate.debater_a_name, imageUrl: aImageResolved }}
              b={{ name: data.debate.debater_b_name, imageUrl: bImageResolved }}
            />
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
              {moderatorSpeaking ? (
                <div className="mt-3">
                  <Teleprompter
                    text={speakerContent}
                    active={playing && !loading}
                    durationMs={currentAudioMs}
                    heightRem={6}
                  />
                  {voiceFallback && current?.id === voiceFallback.msgId && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Voz clonada falhou — usando voz do navegador. <span className="opacity-70">({voiceFallback.reason.slice(0, 80)})</span></span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={retryCurrent}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Tentar de novo
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-base leading-relaxed md:text-xl text-muted-foreground">
                  {currentSubtopic?.focus ?? data.debate.topic}
                </p>
              )}
            </section>

            <section className="relative grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
              <StageDebaterPanel
                side="a"
                name={data.debate.debater_a_name}
                imageUrl={aImageResolved}
                phase={current?.phase ?? ""}
                content={role === "a" ? speakerContent : ""}
                active={role === "a"}
                speaking={role === "a" && playing && !loading}
                loading={role === "a" && loading}
                durationMs={role === "a" ? currentAudioMs : null}
                fallbackReason={voiceFallback && current?.id === voiceFallback.msgId && role === "a" ? voiceFallback.reason : null}
                onRetry={retryCurrent}
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
                imageUrl={bImageResolved}
                phase={current?.phase ?? ""}
                content={role === "b" ? speakerContent : ""}
                active={role === "b"}
                speaking={role === "b" && playing && !loading}
                loading={role === "b" && loading}
                durationMs={role === "b" ? currentAudioMs : null}
                fallbackReason={voiceFallback && current?.id === voiceFallback.msgId && role === "b" ? voiceFallback.reason : null}
                onRetry={retryCurrent}
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
  imageUrl,
  phase,
  content,
  active,
  speaking,
  loading,
  durationMs,
  fallbackReason,
  onRetry,
}: {
  side: "a" | "b";
  name: string;
  imageUrl?: string | null;
  phase: string;
  content: string;
  active: boolean;
  speaking: boolean;
  loading: boolean;
  durationMs?: number | null;
  fallbackReason?: string | null;
  onRetry?: () => void;
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
          <div className={`relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 md:h-32 md:w-32 ${active ? `${theme.text} border-current bg-background/70` : "border-border text-muted-foreground bg-secondary/50"}`}>
            {active && <span className={`absolute inset-[-8px] rounded-full border ${theme.text} opacity-30 animate-ping`} />}
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
              <Bot className="h-12 w-12 md:h-16 md:w-16" />
            )}
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
          {active ? (
            <div className="mx-auto max-w-xl">
              <Teleprompter
                text={content}
                active={speaking}
                durationMs={durationMs ?? null}
                heightRem={7}
              />
              {fallbackReason && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Voz clonada falhou — usando navegador.</span>
                  </div>
                  {onRetry && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onRetry}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Tentar
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="mx-auto max-w-xl text-base leading-relaxed md:text-xl text-muted-foreground">
              {""}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

