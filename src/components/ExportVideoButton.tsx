import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { createDebateExportUpload, finalizeDebateExport, listDebateExports } from "@/lib/debate-exports.functions";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Film, Loader2, Download, Layers, Mic2, Scissors, RotateCcw, Archive, FileVideo, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { exportSpeechToMp4, concatMp4Parts, zipMp4Parts } from "@/lib/video-export-per-speech";
import { getDebate, ttsSpeak } from "@/lib/debate.functions";
import { listPersonas } from "@/lib/persona.functions";
import { minimaxTts } from "@/lib/tts.functions";
import { replicateTts } from "@/lib/voice-replicate.functions";
import { DEFAULT_VOICE_SETTINGS } from "@/components/VoicePicker";
import { type VoiceProvider } from "@/lib/voice-catalog";
import { stripMarkdownForTts } from "@/lib/text-utils";
import { AI_DISCLAIMER_TEXT } from "@/components/AIDisclaimer";
import { TimelineEditor, type TimelineClip, type TimelineMusic, type TimelineSfx } from "@/components/TimelineEditor";
import musicAsset from "@/assets/legends-opening.mp3.asset.json";
import { KOKORO_VOICE_IDS, kokoroFallback } from "@/lib/kokoro-voices";
import { ttsCacheGet, ttsCachePut, ttsCachePrune, blobToUrl, dataUrlToBlob, hashContent } from "@/lib/tts-cache";
import { mp4PartGet, mp4PartPut, mp4PartDelete, mp4PartsByDebate, mp4PartsPrune } from "@/lib/mp4-parts-cache";

type Slot = { provider: VoiceProvider; voiceId: string | null };

function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 5);
    a.onerror = () => resolve(5);
    a.src = url;
  });
}

export function ExportVideoButton({ debateId }: { debateId: string }) {
  const get = useServerFn(getDebate);
  const lp = useServerFn(listPersonas);
  const elTts = useServerFn(ttsSpeak);
  const mmTts = useServerFn(minimaxTts);
  const rpTts = useServerFn(replicateTts);
  const createUpload = useServerFn(createDebateExportUpload);
  const finalizeUpload = useServerFn(finalizeDebateExport);
  const listExports = useServerFn(listDebateExports);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["debate", debateId], queryFn: () => get({ data: { id: debateId } }) });
  const { data: personas } = useQuery({ queryKey: ["personas"], queryFn: () => lp() });
  const { data: savedExports } = useQuery({
    queryKey: ["debate-exports", debateId],
    queryFn: () => listExports({ data: { debateId } }),
  });

  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [clips, setClips] = useState<TimelineClip[]>([]);

  // ── Per-speech export panel ──
  type PartStatus = "pending" | "rendering" | "done" | "error";
  type Part = {
    msgId: string; index: number; label: string; phaseLabel: string;
    role: "moderator" | "a" | "b"; content: string;
    audioUrl?: string; duration?: number;
    videoBlob?: Blob; videoUrl?: string;
    status: PartStatus; error?: string; progressPct?: number;
  };
  const [perSpeechOpen, setPerSpeechOpen] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [perSpeechRunning, setPerSpeechRunning] = useState(false);
  const [mergeBusy, setMergeBusy] = useState<null | { label: string; pct: number }>(null);
  const cancelRef = useRef(false);
  const partsRef = useRef<Part[]>([]);
  const perSpeechRunningRef = useRef(false);
  const perSpeechTaskRef = useRef<Promise<void> | null>(null);
  const audioPreparingRef = useRef(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  function updateParts(updater: (prev: Part[]) => Part[]): void {
    setParts((prev) => {
      const next = updater(prev);
      partsRef.current = next;
      return next;
    });
  }

  useEffect(() => { partsRef.current = parts; }, [parts]);

  async function keepExportAwake(enable: boolean): Promise<void> {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    try {
      if (enable && !wakeLockRef.current && nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      }
      if (!enable && wakeLockRef.current) {
        await wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    } catch {
      wakeLockRef.current = null;
    }
  }

  // Cache em memória das URLs criadas a partir do cache IDB nesta sessão.
  // O cache PERSISTENTE de TTS vive em IndexedDB (src/lib/tts-cache.ts),
  // chaveado por provider|voiceId|msgId|hash(content) — sobrevive a refresh,
  // re-abrir editor e re-exportar. Aqui guardamos só as object URLs ativas.
  const sessionUrlCacheRef = useRef<Map<string, { url: string; duration: number }>>(new Map());
  // Roda 1× por sessão pra apagar entradas IDB antigas.
  useEffect(() => { void ttsCachePrune(); void mp4PartsPrune(); }, []);

  function resolveSlot(
    provider: string | null | undefined,
    voiceId: string | null | undefined,
    personaName?: string | null,
  ): Slot {
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const persona = personaName ? personas?.find((p) => norm(p.name) === norm(personaName)) ?? null : null;
    const pp = persona?.voice_provider as VoiceProvider | null | undefined;
    const pid = (persona?.voice_id ?? "").trim();
    // A persona só sobrescreve se tiver uma voz REAL com id.
    if (pp && pid && ["kokoro", "piper", "eleven", "minimax", "replicate"].includes(pp)) {
      return { provider: pp, voiceId: pid };
    }
    const p = ((provider === "kokoro" || provider === "piper" || provider === "eleven" || provider === "minimax" || provider === "replicate")
      ? provider
      : "eleven") as VoiceProvider;
    // Trata "" como ausente (?? não captura string vazia).
    const id = (voiceId ?? "").trim();
    const fallback = p === "kokoro" ? "pf_dora" : p === "eleven" ? "pNInz6obpgDQGcFmaJgB" : null;
    return { provider: p, voiceId: id || fallback };
  }

  async function fetchAudioUrl(slot: Slot, text: string): Promise<string> {
    if (!slot.voiceId) throw new Error("voz_nao_definida");
    const clean = stripMarkdownForTts(text).slice(0, 5000);
    if (slot.provider === "kokoro") {
      // Modelo Kokoro pode não conhecer a voz salva no banco (ex.: pm_santa removido).
      // Cai pra um fallback válido em vez de quebrar a exportação inteira.
      const safeId = KOKORO_VOICE_IDS.has(slot.voiceId) ? slot.voiceId : kokoroFallback(slot.voiceId);
      const { kokoroSynthUrl } = await import("@/lib/kokoro-tts");
      return await kokoroSynthUrl(clean, safeId);
    }
    if (slot.provider === "piper") {
      const { piperSynthUrl } = await import("@/lib/piper-tts");
      return await piperSynthUrl(clean, slot.voiceId);
    }
    if (slot.provider === "eleven") {
      const res = await elTts({ data: { text: clean, voiceId: slot.voiceId } });
      if ("error" in res && res.error) throw new Error(res.error);
      return `data:${res.mime};base64,${res.audio}`;
    }
    if (slot.provider === "minimax") {
      const res = await mmTts({ data: {
        text: clean, voiceId: slot.voiceId, model: "speech-02-hd",
        speed: DEFAULT_VOICE_SETTINGS.speed,
        pitch: Math.round(DEFAULT_VOICE_SETTINGS.pitch),
        vol: Math.max(0.1, Math.min(10, DEFAULT_VOICE_SETTINGS.volume)),
      } });
      return `data:${res.mime};base64,${res.audioBase64}`;
    }
    const res = await rpTts({ data: { text: clean, voiceId: slot.voiceId } });
    if ("error" in res && res.error) throw new Error(res.error);
    return `data:${res.mime};base64,${res.audioBase64}`;
  }

  type PreparedMsg = {
    id: string;
    role: "moderator" | "a" | "b";
    phase: string;
    content: string;
  };

  /** Resolve slots and warn loudly which named participant is missing a voice. */
  function resolveSlotsOrWarn(): { slotMod: Slot; slotA: Slot; slotB: Slot } | null {
    if (!data) return null;
    const d = data.debate;
    const slotMod = resolveSlot(d.voice_provider_mod, d.voice_id_mod);
    const slotA = resolveSlot(d.voice_provider_a, d.voice_id_a, d.debater_a_name);
    const slotB = resolveSlot(d.voice_provider_b, d.voice_id_b, d.debater_b_name);
    const missing: string[] = [];
    if (!slotA.voiceId) missing.push(d.debater_a_name ?? "Debatedor A");
    if (!slotB.voiceId) missing.push(d.debater_b_name ?? "Debatedor B");
    if (!slotMod.voiceId) missing.push("Moderador");
    if (missing.length) {
      toast.error(
        `Sem voz configurada para: ${missing.join(", ")}. Abra "Editar" e defina uma voz (ou use Kokoro grátis).`,
        { duration: 8000 },
      );
      return null;
    }
    return { slotMod, slotA, slotB };
  }

  function buildMessageList(blockIndex: number | null): PreparedMsg[] {
    if (!data) return [];
    const d = data.debate;
    const virtualOpening: PreparedMsg[] =
      blockIndex === null || blockIndex === 0
        ? [
            { id: "__opening_disclaimer__", role: "moderator", phase: "abertura", content: AI_DISCLAIMER_TEXT },
            {
              id: "__opening_guests__",
              role: "moderator",
              phase: "abertura",
              content:
                `Boa noite, e bem-vindos à Legends Arena. Hoje na arena, o tema é: ${d.topic}. ` +
                `À minha direita, ${d.debater_a_name}. À minha esquerda, ${d.debater_b_name}. ` +
                `Que vença o melhor argumento.`,
            },
          ]
        : [];
    const filtered = data.messages.filter((m) => {
      if (blockIndex === null) return true;
      const bi = (m as { block_index?: number | null }).block_index ?? 0;
      return bi === blockIndex;
    });
    return [
      ...virtualOpening,
      ...filtered.map((m) => ({
        id: m.id,
        role: ((m.role === "a" || m.role === "b") ? m.role : "moderator") as "moderator" | "a" | "b",
        phase: m.phase ?? "",
        content: m.content,
      })),
    ];
  }

  async function synthesizeClips(
    all: PreparedMsg[],
    slots: { slotMod: Slot; slotA: Slot; slotB: Slot },
    errorOut?: Map<string, string>,
  ): Promise<TimelineClip[] | null> {
    const sessionCache = sessionUrlCacheRef.current;
    const cacheKey = (m: PreparedMsg, slot: Slot) => {
      const clean = stripMarkdownForTts(m.content).slice(0, 5000);
      const suffix = slot.provider === "minimax"
        ? `|${DEFAULT_VOICE_SETTINGS.speed}|${DEFAULT_VOICE_SETTINGS.pitch}|${DEFAULT_VOICE_SETTINGS.volume}`
        : "";
      return `${slot.provider}|${slot.voiceId}|${m.id}|${hashContent(clean)}${suffix}`;
    };
    const todo = all.map((m) => ({
      m,
      slot: m.role === "a" ? slots.slotA : m.role === "b" ? slots.slotB : slots.slotMod,
    }));
    const audioByMsg = new Map<string, { url: string; duration: number }>();
    const errors: { role: string; reason: string }[] = [];
    const pending: typeof todo = [];

    // 1) Cache em memória da sessão
    // 2) Cache persistente em IndexedDB (sobrevive a refresh)
    for (const item of todo) {
      const key = cacheKey(item.m, item.slot);
      const hot = sessionCache.get(key);
      if (hot) { audioByMsg.set(item.m.id, hot); continue; }
      const persisted = await ttsCacheGet(key);
      if (persisted) {
        const entry = { url: blobToUrl(persisted.blob), duration: persisted.duration };
        sessionCache.set(key, entry);
        audioByMsg.set(item.m.id, entry);
        continue;
      }
      pending.push(item);
    }
    const reused = audioByMsg.size;
    if (reused > 0) {
      setProgress({ label: `Reaproveitando ${reused} voz(es) do cache`, pct: reused / todo.length });
    }

    let done = reused;
    let cursor = 0;
    const concurrency = 3;
    const labelFor = (role: string) =>
      role === "a" ? (data?.debate.debater_a_name ?? "Debatedor A")
      : role === "b" ? (data?.debate.debater_b_name ?? "Debatedor B")
      : "Moderador";
    const worker = async () => {
      while (cursor < pending.length) {
        const i = cursor++;
        const { m, slot } = pending[i];
        try {
          const url = await fetchAudioUrl(slot, m.content);
          const duration = await getAudioDuration(url);
          // Persiste em IDB pra próxima sessão.
          try {
            const blob = url.startsWith("data:")
              ? await dataUrlToBlob(url)
              : await (await fetch(url)).blob();
            await ttsCachePut(cacheKey(m, slot), blob, duration);
          } catch { /* cache best-effort */ }
          const entry = { url, duration };
          audioByMsg.set(m.id, entry);
          sessionCache.set(cacheKey(m, slot), entry);
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          errors.push({ role: labelFor(m.role), reason });
          errorOut?.set(m.id, reason);
        }
        done++;
        setProgress({ label: `Gerando vozes ${done}/${todo.length}`, pct: done / todo.length });
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));

    const missing = all.filter((m) => !audioByMsg.get(m.id));
    if (missing.length > all.length / 2) {
      const sample = errors.slice(0, 2).map((e) => `${e.role}: ${e.reason}`).join(" | ");
      toast.error(
        `Falha ao gerar ${missing.length}/${all.length} áudios. ${sample || "Verifique as vozes configuradas."}`,
        { duration: 9000 },
      );
      return null;
    }
    if (missing.length > 0) {
      const sample = errors.slice(0, 2).map((e) => `${e.role}: ${e.reason}`).join(" | ");
      toast.warning(`${missing.length} fala(s) sem áudio foram puladas. ${sample}`, { duration: 7000 });
    }

    setProgress({ label: "Montando timeline", pct: 0.97 });
    const built: TimelineClip[] = [];
    for (const m of all) {
      const entry = audioByMsg.get(m.id);
      if (!entry) continue;
      built.push({
        id: m.id,
        role: m.role,
        phase: m.phase,
        content: m.content,
        audioUrl: entry.url,
        duration: entry.duration,
        trimStart: 0,
        trimEnd: 0,
        subtitle: true,
      });
    }
    return built;
  }

  /** Etapa explícita: pré-gera e SALVA (cache IndexedDB) o áudio de todas as
   *  falas, com avisos por fala. Deixa o vídeo pronto pra exportar sem surpresa. */
  async function prepareAudiosOnly() {
    if (!data) return;
    const slots = resolveSlotsOrWarn();
    if (!slots) return;
    setProgress({ label: "Gerando áudios", pct: 0 });
    try {
      const all = buildMessageList(null);
      const built = await synthesizeClips(all, slots);
      if (built) {
        const ok = built.length, total = all.length;
        if (ok >= total) toast.success(`✓ Áudios prontos: ${ok}/${total} falas. Agora é só exportar o vídeo.`, { duration: 6000 });
        else toast.warning(`Áudios: ${ok}/${total} prontas — ${total - ok} falharam (confira as vozes). O vídeo pulará as sem áudio.`, { duration: 8000 });
      }
    } catch (e) {
      console.error("[gerar-audios] falhou:", e);
      toast.error(`Falha ao gerar áudios: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProgress(null);
    }
  }

  async function prepareAndOpen() {
    if (!data) return;
    const d = data.debate;
    if ((d.format ?? "duel") !== "duel") {
      toast.error("Editor de vídeo ainda só suporta o formato Duelo. Para outros formatos, use 'Exportar .md'.");
      return;
    }
    setProgress({ label: "Preparando vozes", pct: 0 });
    const slots = resolveSlotsOrWarn();
    if (!slots) { setProgress(null); return; }
    try {
      const built = await synthesizeClips(buildMessageList(null), slots);
      if (!built) { setProgress(null); return; }
      setClips(built);
      setProgress(null);
      setEditorOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao preparar vídeo");
      setProgress(null);
    }
  }

  async function renderAndDownload(
    builtClips: TimelineClip[],
    fileSuffix: string,
    persistMeta: { blockIndex: number | null; blockTitle: string | null } | null,
  ) {
    if (!data) return;
    const d = data.debate;
    const { exportDebateMp4 } = await import("@/lib/video-export");
    const findP = (name: string | null | undefined) => {
      const n = (name ?? "").trim().toLowerCase();
      return personas?.find((p) => (p.name ?? "").trim().toLowerCase() === n) ?? null;
    };
    const pA = findP(d.debater_a_name);
    const pB = findP(d.debater_b_name);

    const blob = await exportDebateMp4({
      topic: d.topic,
      aName: d.debater_a_name,
      bName: d.debater_b_name,
      aImageUrl: d.debater_a_image_url ?? pA?.image_url ?? null,
      bImageUrl: d.debater_b_image_url ?? pB?.image_url ?? null,
      aDescription: pA?.description ?? null,
      bDescription: pB?.description ?? null,
      messages: builtClips.map((c) => ({
        id: c.id,
        role: c.role,
        phase: c.phase,
        content: c.content,
        audioUrl: c.audioUrl,
        trimStart: c.trimStart,
        trimEnd: c.trimEnd,
        subtitle: c.subtitle,
      })),
      musicUrl: musicAsset.url,
      musicVolume: 0.18,
      sfx: [],
      onProgress: (label, pct) => setProgress({ label, pct }),
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debate-${debateId.slice(0, 8)}${fileSuffix}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (persistMeta) {
      try {
        setProgress({ label: "Salvando no debate…", pct: 0.99 });
        const kind = persistMeta.blockIndex === null ? "full" : "block";
        const up = await createUpload({ data: { debateId, kind, blockIndex: persistMeta.blockIndex } });
        const putRes = await fetch(up.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "video/mp4" },
          body: blob,
        });
        if (!putRes.ok) throw new Error(`upload ${putRes.status}`);
        const totalDur = builtClips.reduce(
          (s, c) => s + Math.max(0, c.duration - c.trimStart - c.trimEnd),
          0,
        );
        await finalizeUpload({ data: {
          debateId,
          kind,
          blockIndex: persistMeta.blockIndex,
          blockTitle: persistMeta.blockTitle,
          storagePath: up.storagePath,
          sizeBytes: blob.size,
          durationSeconds: totalDur || null,
        } });
        await qc.invalidateQueries({ queryKey: ["debate-exports", debateId] });
      } catch (e) {
        toast.warning(`Vídeo baixado, mas não foi salvo no debate: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  /** Sequencia exportDirect(0..N-1) — evita estouro de memória em debates longos. */
  async function exportAllBlocksSequentially() {
    if (!data) return;
    const subs = (data.debate.block_subtopics as Array<{ title?: string }> | null) ?? [];
    const total = subs.length;
    if (total <= 1) return;
    let ok = 0;
    for (let i = 0; i < total; i++) {
      try {
        setProgress({ label: `Bloco ${i + 1}/${total} — preparando`, pct: i / total });
        await exportDirect(i, { quiet: true });
        ok++;
      } catch (e) {
        console.error(`[export-block ${i + 1}] falhou:`, e);
        toast.error(`Bloco ${i + 1} falhou: ${e instanceof Error ? e.message : String(e)}`, { duration: 8000 });
      }
      // Folga pro GC entre blocos.
      await new Promise((r) => setTimeout(r, 250));
    }
    if (ok === total) {
      toast.success(`${ok}/${total} blocos exportados! Veja a lista de vídeos salvos abaixo.`, { duration: 9000 });
    } else {
      toast.warning(`${ok}/${total} blocos exportados. Tente os que falharam novamente.`, { duration: 9000 });
    }
  }

  /** One-click: synth → render → download. No editor. blockIndex=null = full debate. */
  async function exportDirect(blockIndex: number | null, opts?: { quiet?: boolean }) {
    if (!data) return;
    const d = data.debate;
    if ((d.format ?? "duel") !== "duel") {
      toast.error("Exportação de vídeo ainda só suporta o formato Duelo.");
      return;
    }
    // Debate longo + várias blocos? Exportar bloco a bloco evita crash da aba por OOM.
    if (blockIndex === null && !opts?.quiet) {
      const subs = (d.block_subtopics as Array<{ title?: string }> | null) ?? [];
      const isLong = data.messages.length > 20 || subs.length > 3;
      if (isLong && subs.length > 1) {
        const choose = window.confirm(
          `Esse debate é longo (${data.messages.length} falas, ${subs.length} blocos). ` +
          `Exportar o MP4 inteiro de uma vez costuma travar a aba por falta de memória.\n\n` +
          `OK = exportar bloco a bloco (recomendado).\nCancelar = tentar tudo num MP4 só.`,
        );
        if (choose) {
          await exportAllBlocksSequentially();
          return;
        }
      }
    }
    // Atalho: se já tem MP4 salvo pro mesmo escopo, baixa direto sem regerar.
    const existing = (savedExports ?? []).find((e) =>
      blockIndex === null ? e.kind === "full" : e.kind === "block" && e.block_index === blockIndex,
    );
    if (existing && existing.download_url && !opts?.quiet) {
      const reuse = window.confirm(
        `Já existe um MP4 salvo desse ${blockIndex === null ? "debate" : "bloco"} (${(existing.size_bytes / 1024 / 1024).toFixed(1)}MB). Baixar o existente em vez de gerar de novo?`,
      );
      if (reuse) {
        const a = document.createElement("a");
        a.href = existing.download_url;
        a.download = `debate-${debateId.slice(0, 8)}${blockIndex === null ? "" : `-bloco-${blockIndex + 1}`}.mp4`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        toast.success("Vídeo salvo baixado.");
        return;
      }
    }
    setProgress({ label: "Preparando vozes", pct: 0 });
    const slots = resolveSlotsOrWarn();
    if (!slots) { setProgress(null); return; }
    try {
      const built = await synthesizeClips(buildMessageList(blockIndex), slots);
      if (!built || built.length === 0) { setProgress(null); return; }
      setProgress({ label: "Renderizando vídeo", pct: 0 });
      const suffix = blockIndex === null ? "" : `-bloco-${blockIndex + 1}`;
      const subs = (data.debate.block_subtopics as Array<{ title?: string }> | null) ?? [];
      const blockTitle = blockIndex === null ? null : (subs[blockIndex]?.title ?? null);
      await renderAndDownload(built, suffix, { blockIndex, blockTitle });
      if (!opts?.quiet) {
        toast.success(blockIndex === null ? "Vídeo MP4 exportado!" : `Bloco ${blockIndex + 1} exportado!`);
      }
    } catch (e) {
      console.error("[export-mp4] falhou:", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (opts?.quiet) throw e;
      toast.error(`Falha ao gerar o MP4: ${msg}`, { duration: 9000 });
    } finally {
      setProgress(null);
    }
  }

  async function runExportFromEditor(editedClips: TimelineClip[], music: TimelineMusic, sfx: TimelineSfx[]) {
    if (!data) return;
    setProgress({ label: "Renderizando vídeo", pct: 0 });
    try {
      const d = data.debate;
      const { exportDebateMp4 } = await import("@/lib/video-export");
      const findP = (name: string | null | undefined) => {
        const n = (name ?? "").trim().toLowerCase();
        return personas?.find((p) => (p.name ?? "").trim().toLowerCase() === n) ?? null;
      };
      const pA = findP(d.debater_a_name);
      const pB = findP(d.debater_b_name);

      const blob = await exportDebateMp4({
        topic: d.topic,
        aName: d.debater_a_name,
        bName: d.debater_b_name,
        aImageUrl: d.debater_a_image_url ?? pA?.image_url ?? null,
        bImageUrl: d.debater_b_image_url ?? pB?.image_url ?? null,
        aDescription: pA?.description ?? null,
        bDescription: pB?.description ?? null,
        messages: editedClips.map((c) => ({
          id: c.id,
          role: c.role,
          phase: c.phase,
          content: c.content,
          audioUrl: c.audioUrl,
          trimStart: c.trimStart,
          trimEnd: c.trimEnd,
          subtitle: c.subtitle,
        })),
        musicUrl: music.enabled ? music.url : null,
        musicVolume: music.volume,
        sfx: sfx.map((s) => ({ type: s.type, at: s.at })),
        onProgress: (label, pct) => setProgress({ label, pct }),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `debate-${debateId.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      try {
        setProgress({ label: "Salvando no debate…", pct: 0.99 });
        const up = await createUpload({ data: { debateId, kind: "full", blockIndex: null } });
        const putRes = await fetch(up.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "video/mp4" },
          body: blob,
        });
        if (!putRes.ok) throw new Error(`upload ${putRes.status}`);
        const totalDur = editedClips.reduce(
          (s, c) => s + Math.max(0, c.duration - c.trimStart - c.trimEnd),
          0,
        );
        await finalizeUpload({ data: {
          debateId, kind: "full", blockIndex: null, blockTitle: null,
          storagePath: up.storagePath, sizeBytes: blob.size,
          durationSeconds: totalDur || null,
        } });
        await qc.invalidateQueries({ queryKey: ["debate-exports", debateId] });
      } catch (e) {
        toast.warning(`Vídeo baixado, mas não foi salvo no debate: ${e instanceof Error ? e.message : String(e)}`);
      }

      toast.success("Vídeo MP4 exportado!");
      setEditorOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar vídeo");
    } finally {
      setProgress(null);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Per-speech export: 1 MP4 por fala (não trava a aba em debates longos).
  // ─────────────────────────────────────────────────────────────
  function buildBasePerSpeech() {
    if (!data) return null;
    const d = data.debate;
    const findP = (name: string | null | undefined) => {
      const n = (name ?? "").trim().toLowerCase();
      return personas?.find((p) => (p.name ?? "").trim().toLowerCase() === n) ?? null;
    };
    const pA = findP(d.debater_a_name);
    const pB = findP(d.debater_b_name);
    return {
      topic: d.topic,
      aName: d.debater_a_name,
      bName: d.debater_b_name,
      aImageUrl: d.debater_a_image_url ?? pA?.image_url ?? null,
      bImageUrl: d.debater_b_image_url ?? pB?.image_url ?? null,
      aDescription: pA?.description ?? null,
      bDescription: pB?.description ?? null,
      musicUrl: musicAsset.url,
      musicVolume: 0.18,
    };
  }

  function labelForPart(role: "moderator" | "a" | "b", phase: string, idx: number): { label: string; phase: string } {
    const who = role === "a" ? (data?.debate.debater_a_name ?? "Convidado A")
      : role === "b" ? (data?.debate.debater_b_name ?? "Convidado B")
      : "Mediador";
    return { label: `${String(idx + 1).padStart(2, "0")} — ${who}`, phase: phase || "—" };
  }

  async function openPerSpeechPanel() {
    if (!data) return;
    if ((data.debate.format ?? "duel") !== "duel") {
      toast.error("Exportação por fala ainda só suporta o formato Duelo.");
      return;
    }
    if (perSpeechRunningRef.current || audioPreparingRef.current || partsRef.current.length > 0) {
      setPerSpeechOpen(true);
      return;
    }
    const slots = resolveSlotsOrWarn();
    if (!slots) return;

    // 1) Monta a lista IMEDIATAMENTE a partir das mensagens + cache de MP4.
    //    O painel abre antes mesmo de sintetizar áudios — assim, se algo der
    //    errado na voz, o usuário ainda vê os vídeos já prontos do cache.
    const all = buildMessageList(null);
    const cached = await mp4PartsByDebate(debateId);
    const baseParts: Part[] = all.map((m, i) => {
      const { label, phase } = labelForPart(m.role, m.phase, i);
      const cachedBlob = cached.get(m.id);
      return {
        msgId: m.id, index: i, label, phaseLabel: phase,
        role: m.role, content: m.content,
        videoBlob: cachedBlob,
        videoUrl: cachedBlob ? URL.createObjectURL(cachedBlob) : undefined,
        status: (cachedBlob ? "done" : "pending") as PartStatus,
        progressPct: cachedBlob ? 1 : undefined,
      };
    });
    updateParts(() => baseParts);
    const reused = baseParts.filter((p) => p.status === "done").length;
    if (reused > 0) toast.success(`${reused} fala(s) reaproveitada(s) do cache.`, { duration: 4000 });
    setPerSpeechOpen(true);

    // 2) Sintetiza áudios em background. Falhas individuais NÃO derrubam o painel.
    audioPreparingRef.current = true;
    setProgress({ label: "Preparando vozes", pct: 0 });
    const errMap = new Map<string, string>();
    try {
      const built = await synthesizeClips(all, slots, errMap);
      const byId = new Map((built ?? []).map((c) => [c.id, c]));
      updateParts((prev) => prev.map((p) => {
        const c = byId.get(p.msgId);
        if (!c) {
          if (p.status === "done") return p;
          const reason = errMap.get(p.msgId) ?? "Áudio ausente.";
          return { ...p, status: "error", error: reason };
        }
        return { ...p, audioUrl: c.audioUrl, duration: c.duration,
          status: p.status === "done" ? "done" : "pending",
          error: undefined };
      }));
    } catch (e) {
      toast.error(`Falha ao preparar áudios: ${e instanceof Error ? e.message : String(e)}. Falas com áudio em cache continuam disponíveis.`);
      updateParts((prev) => prev.map((p) =>
        p.status === "done" || p.audioUrl ? p : { ...p, status: "error", error: errMap.get(p.msgId) ?? "Áudio ausente." },
      ));
    } finally {
      audioPreparingRef.current = false;
      setProgress(null);
      if (!perSpeechRunningRef.current && partsRef.current.some((p) => p.status !== "done" && p.audioUrl && p.duration)) {
        void runPerSpeechExport();
      }
    }
  }

  /** Retry TTS for one or more failed messages, then auto-render their MP4s. */
  async function retryAudiosForMsgIds(msgIds: string[]) {
    if (!data || msgIds.length === 0) return;
    const slots = resolveSlotsOrWarn();
    if (!slots) return;
    const all = buildMessageList(null);
    const subset = all.filter((m) => msgIds.includes(m.id));
    if (subset.length === 0) return;

    // Marca como "rendering" só pra indicar atividade na linha (sem barra).
    updateParts((prev) => prev.map((x) =>
      msgIds.includes(x.msgId) ? { ...x, status: "rendering", progressPct: 0, error: undefined } : x,
    ));
    setProgress({ label: `Gerando áudio (${subset.length})`, pct: 0 });
    const errMap = new Map<string, string>();
    let built: TimelineClip[] | null = null;
    try {
      built = await synthesizeClips(subset, slots, errMap);
    } catch (e) {
      toast.error(`Falha ao gerar áudio: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProgress(null);
    }
    const byId = new Map((built ?? []).map((c) => [c.id, c]));
    updateParts((prev) => prev.map((p) => {
      if (!msgIds.includes(p.msgId)) return p;
      const c = byId.get(p.msgId);
      if (!c) {
        return { ...p, status: "error", error: errMap.get(p.msgId) ?? "Áudio ausente." };
      }
      return { ...p, audioUrl: c.audioUrl, duration: c.duration, status: "pending", error: undefined };
    }));
    // Renderiza MP4 das que ganharam áudio
    const renderable = msgIds.filter((id) => byId.has(id));
    if (renderable.length > 0) {
      for (const id of renderable) {
        // Roda uma por vez para reusar a fila de render existente.
        await runPerSpeechExport(id);
      }
      toast.success(`${renderable.length} áudio(s) corrigido(s).`);
    }
  }

  async function retryAudioForPart(msgId: string) {
    await retryAudiosForMsgIds([msgId]);
  }

  async function retryAllMissingAudios() {
    const ids = parts.filter((p) => p.status === "error" && !p.audioUrl).map((p) => p.msgId);
    if (ids.length === 0) { toast.info("Nenhum áudio faltando."); return; }
    await retryAudiosForMsgIds(ids);
  }


  async function renderOnePart(p: Part, base: NonNullable<ReturnType<typeof buildBasePerSpeech>>): Promise<Part> {
    if (!p.audioUrl || !p.duration) {
      return { ...p, status: "error", error: "Áudio ausente." };
    }
    // Revoga URL antiga (re-render) pra não vazar memória.
    if (p.videoUrl) { try { URL.revokeObjectURL(p.videoUrl); } catch { /* noop */ } }
    try {
      const blob = await exportSpeechToMp4(
        base,
        {
          id: p.msgId, role: p.role, phase: p.phaseLabel === "—" ? "" : p.phaseLabel,
          content: p.content, audioUrl: p.audioUrl, trimStart: 0, trimEnd: 0, subtitle: true,
        },
        (_label, pct) => {
          updateParts((prev) => prev.map((x) => x.msgId === p.msgId ? { ...x, progressPct: pct, status: "rendering" } : x));
        },
      );
      // Aguarda persistir ANTES de avançar — assim, se o usuário fechar o
      // modal ou a aba travar, o MP4 já está no IndexedDB pra próxima sessão.
      try { await mp4PartPut(debateId, p.msgId, blob); } catch { /* best-effort */ }
      const url = URL.createObjectURL(blob);
      return { ...p, status: "done", videoBlob: blob, videoUrl: url, progressPct: 1, error: undefined };
    } catch (e) {
      return { ...p, status: "error", error: e instanceof Error ? e.message : String(e), progressPct: 0 };
    }
  }

  async function runPerSpeechExport(onlyMsgId?: string) {
    if (perSpeechRunningRef.current) {
      toast.info("A fila já está rodando em segundo plano.", { duration: 2500 });
      await perSpeechTaskRef.current;
      return;
    }
    const base = buildBasePerSpeech();
    if (!base) return;
    const task = (async () => {
      const attempted = new Set<string>();
      perSpeechRunningRef.current = true;
      setPerSpeechRunning(true);
      cancelRef.current = false;
      await keepExportAwake(true);
      try {
        while (!cancelRef.current) {
          const snapshot = partsRef.current;
          const queue = onlyMsgId
            ? snapshot.filter((p) => p.msgId === onlyMsgId)
            : snapshot.filter((p) => p.status !== "done");
          const next = queue.find((p) => !attempted.has(p.msgId) && p.audioUrl && p.duration);
          if (!next) {
            const waitingForAudio = queue.some((p) => !attempted.has(p.msgId) && (!p.audioUrl || !p.duration));
            if (waitingForAudio && audioPreparingRef.current) {
              await new Promise((r) => setTimeout(r, 600));
              continue;
            }
            if (waitingForAudio) {
              updateParts((prev) => prev.map((x) =>
                queue.some((p) => p.msgId === x.msgId) && !attempted.has(x.msgId) && x.status !== "done"
                  ? { ...x, status: "error", error: x.error ?? "Áudio ausente.", progressPct: 0 }
                  : x,
              ));
            }
            break;
          }
          attempted.add(next.msgId);
          updateParts((prev) => prev.map((x) => x.msgId === next.msgId ? { ...x, status: "rendering", progressPct: 0, error: undefined } : x));
          const fresh = partsRef.current.find((x) => x.msgId === next.msgId) ?? next;
          const updated = await renderOnePart(fresh, base).catch((e) => ({
            ...fresh,
            status: "error" as PartStatus,
            error: e instanceof Error ? e.message : String(e),
            progressPct: 0,
          }));
          updateParts((prev) => prev.map((x) => x.msgId === next.msgId ? updated : x));
          await new Promise((r) => setTimeout(r, 400));
          if (onlyMsgId) break;
        }
      } finally {
        perSpeechRunningRef.current = false;
        setPerSpeechRunning(false);
        perSpeechTaskRef.current = null;
        await keepExportAwake(false);
      }
    })();
    perSpeechTaskRef.current = task;
    await task;
  }
  function downloadPart(p: Part) {
    if (!p.videoUrl) return;
    const a = document.createElement("a");
    a.href = p.videoUrl;
    a.download = `debate-${debateId.slice(0, 8)}-${String(p.index + 1).padStart(2, "0")}.mp4`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  async function downloadAllAsZip() {
    const ready = parts.filter((p) => p.status === "done" && p.videoBlob);
    if (ready.length === 0) { toast.error("Nenhuma fala pronta."); return; }
    setMergeBusy({ label: "Compactando ZIP", pct: 0.5 });
    try {
      const zip = await zipMp4Parts(
        ready.map((p) => ({
          name: `${String(p.index + 1).padStart(2, "0")}-${p.role}.mp4`,
          blob: p.videoBlob!,
        })),
      );
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url; a.download = `debate-${debateId.slice(0, 8)}-falas.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${ready.length} falas baixadas em ZIP.`);
    } catch (e) {
      toast.error(`ZIP falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setMergeBusy(null);
    }
  }

  async function mergeAndDownload() {
    const ready = parts.filter((p) => p.status === "done" && p.videoBlob);
    if (ready.length === 0) { toast.error("Nenhuma fala pronta."); return; }
    setMergeBusy({ label: "Juntando vídeos", pct: 0 });
    try {
      const merged = await concatMp4Parts(
        ready.map((p) => p.videoBlob!),
        (label, pct) => setMergeBusy({ label, pct }),
      );
      const url = URL.createObjectURL(merged);
      const a = document.createElement("a");
      a.href = url; a.download = `debate-${debateId.slice(0, 8)}-completo.mp4`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      // Persiste no debate como o "full"
      try {
        const up = await createUpload({ data: { debateId, kind: "full", blockIndex: null } });
        await fetch(up.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: merged });
        const totalDur = ready.reduce((s, p) => s + (p.duration ?? 0), 0);
        await finalizeUpload({ data: {
          debateId, kind: "full", blockIndex: null, blockTitle: null,
          storagePath: up.storagePath, sizeBytes: merged.size, durationSeconds: totalDur || null,
        } });
        await qc.invalidateQueries({ queryKey: ["debate-exports", debateId] });
      } catch (e) {
        toast.warning(`Vídeo baixado, mas não foi salvo no debate: ${e instanceof Error ? e.message : String(e)}`);
      }
      URL.revokeObjectURL(url);
      toast.success("Vídeo único exportado!");
    } catch (e) {
      toast.error(`Junção falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setMergeBusy(null);
    }
  }

  function closePerSpeechPanel() {
    // Fechar o modal NÃO pausa a fila — a renderização segue em segundo
    // plano. Só o botão "Parar" cancela. Mantém `parts` e object URLs vivos.
    setPerSpeechOpen(false);
  }


  const busy = progress !== null;
  const disabled = !data || data.messages.length === 0 || busy;
  const subtopics = (data?.debate.block_subtopics as Array<{ title?: string }> | null) ?? [];
  const blockCount = subtopics.length;

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="inline-flex flex-wrap items-center gap-1">
        <Button onClick={prepareAudiosOnly} disabled={disabled} size="sm" variant="secondary" title="Pré-gera e salva o áudio de todas as falas (deixa o vídeo pronto, sem falhar na hora)">
          {busy && !editorOpen ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mic2 className="h-4 w-4 mr-1" />}
          Gerar áudios
        </Button>
        <Button onClick={prepareAndOpen} disabled={disabled} size="sm" variant="default">
          {busy && !editorOpen ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Film className="h-4 w-4 mr-1" />}
          {busy && !editorOpen ? "Preparando…" : "Editor de vídeo"}
        </Button>
        <Button onClick={() => exportDirect(null)} disabled={disabled} size="sm" variant="outline" title="Gera o MP4 completo direto (pode travar em debates longos)">
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Exportar MP4
        </Button>
        <Button onClick={openPerSpeechPanel} disabled={!data || data.messages.length === 0} size="sm" variant="default" title="Gera um MP4 por fala (não trava em debates longos) — depois junta ou baixa individualmente">
          {busy || perSpeechRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Scissors className="h-4 w-4 mr-1" />}
          {parts.length > 0 ? "Ver fila" : "Exportar por fala"}
        </Button>
        {blockCount > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={disabled} size="sm" variant="outline" title="Exporta cada bloco em um MP4 separado (mais leve)">
                <Layers className="h-4 w-4 mr-1" /> Exportar bloco…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-w-xs">
              <DropdownMenuLabel>Um MP4 por bloco</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {subtopics.map((s, i) => (
                <DropdownMenuItem key={i} onSelect={() => exportDirect(i)}>
                  Bloco {i + 1}: {s.title ?? "Sem título"}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => exportDirect(null)}>
                Tudo (vídeo único)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {progress && !editorOpen && (
        <div className="min-w-[220px]">
          <Progress value={Math.round(progress.pct * 100)} className="h-1.5" />
          <div className="text-[10px] text-muted-foreground mt-0.5">{progress.label}</div>
        </div>
      )}
      <TimelineEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialClips={clips}
        musicUrl={musicAsset.url}
        onExport={runExportFromEditor}
        progress={editorOpen ? progress : null}
        preview={data ? {
          aName: data.debate.debater_a_name,
          bName: data.debate.debater_b_name,
          aImage: data.debate.debater_a_image_url ?? null,
          bImage: data.debate.debater_b_image_url ?? null,
          arenaThemeId: (data.debate as { arena_theme?: string | null }).arena_theme ?? null,
        } : undefined}
      />

      <Dialog open={perSpeechOpen} onOpenChange={(o) => { if (!o) closePerSpeechPanel(); else setPerSpeechOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Exportar por fala</DialogTitle>
            <DialogDescription>
              Cada fala vira um MP4 curto — mais leve, não trava em debates longos. Depois você baixa cada um, junta tudo num vídeo único, ou empacota em ZIP.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <Button size="sm" onClick={() => runPerSpeechExport()} disabled={perSpeechRunning || mergeBusy !== null}>
              {perSpeechRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileVideo className="h-4 w-4 mr-1" />}
              {parts.some((p) => p.status === "done") ? "Continuar fila" : "Gerar vídeos"}
            </Button>
            {perSpeechRunning && (
              <Button size="sm" variant="ghost" onClick={() => { cancelRef.current = true; }}>
                <X className="h-4 w-4 mr-1" /> Parar
              </Button>
            )}
            {parts.some((p) => p.status === "error" && !p.audioUrl) && !perSpeechRunning && (
              <Button size="sm" variant="secondary" onClick={retryAllMissingAudios} disabled={mergeBusy !== null}
                title="Tenta gerar de novo os áudios das falas marcadas como ausentes, e renderiza o MP4 em seguida">
                <Mic2 className="h-4 w-4 mr-1" />
                Corrigir áudios faltantes ({parts.filter((p) => p.status === "error" && !p.audioUrl).length})
              </Button>
            )}
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={mergeAndDownload}
              disabled={perSpeechRunning || mergeBusy !== null || parts.filter((p) => p.status === "done").length < 2}>
              {mergeBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Film className="h-4 w-4 mr-1" />}
              Baixar vídeo único
            </Button>
            <Button size="sm" variant="outline" onClick={downloadAllAsZip}
              disabled={perSpeechRunning || mergeBusy !== null || !parts.some((p) => p.status === "done")}>
              <Archive className="h-4 w-4 mr-1" />
              Baixar ZIP
            </Button>
          </div>
          {mergeBusy && (
            <div className="px-1">
              <Progress value={Math.round(mergeBusy.pct * 100)} className="h-1.5" />
              <div className="text-[10px] text-muted-foreground mt-0.5">{mergeBusy.label}</div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto -mx-2 px-2">
            <ul className="divide-y divide-border">
              {parts.map((p) => (
                <li key={p.msgId} className="py-2 flex items-center gap-3">
                  <div className="w-6 text-center text-xs">
                    {p.status === "done" ? <span className="text-emerald-500">✓</span>
                      : p.status === "error" ? <span className="text-red-500">✗</span>
                      : p.status === "rendering" ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                      : <span className="text-muted-foreground">·</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.label} <span className="text-muted-foreground text-xs">· {p.phaseLabel}</span></div>
                    <div className="text-xs text-muted-foreground truncate">{p.content.slice(0, 90)}{p.content.length > 90 ? "…" : ""}</div>
                    {p.status === "rendering" && (
                      <Progress value={Math.round((p.progressPct ?? 0) * 100)} className="h-1 mt-1" />
                    )}
                    {p.status === "error" && (
                      <div className="text-[11px] text-red-500 mt-0.5">{p.error}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {p.status === "done" && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => downloadPart(p)} title="Baixar esta fala">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {p.status === "error" && !p.audioUrl && !perSpeechRunning && (
                      <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => retryAudioForPart(p.msgId)} title="Gera o áudio que faltou e cria o vídeo">
                        <Mic2 className="h-3.5 w-3.5 mr-1" />
                        Tentar áudio
                      </Button>
                    )}
                    {(p.status === "error" || p.status === "done") && !perSpeechRunning && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => runPerSpeechExport(p.msgId)} title="Refazer só esta">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
