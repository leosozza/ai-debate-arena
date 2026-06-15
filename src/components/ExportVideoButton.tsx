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
import { Film, Loader2, Download, Layers } from "lucide-react";
import { toast } from "sonner";
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

  // Cache em memória das URLs criadas a partir do cache IDB nesta sessão.
  // O cache PERSISTENTE de TTS vive em IndexedDB (src/lib/tts-cache.ts),
  // chaveado por provider|voiceId|msgId|hash(content) — sobrevive a refresh,
  // re-abrir editor e re-exportar. Aqui guardamos só as object URLs ativas.
  const sessionUrlCacheRef = useRef<Map<string, { url: string; duration: number }>>(new Map());
  // Roda 1× por sessão pra apagar entradas IDB antigas.
  useEffect(() => { void ttsCachePrune(); }, []);

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
  ): Promise<TimelineClip[] | null> {
    const cache = audioCacheRef.current;
    const cacheKey = (m: PreparedMsg, slot: Slot) =>
      `${slot.provider}|${slot.voiceId}|${m.id}|${hashContent(m.content)}`;
    const todo = all.map((m) => ({
      m,
      slot: m.role === "a" ? slots.slotA : m.role === "b" ? slots.slotB : slots.slotMod,
    }));
    const audioByMsg = new Map<string, { url: string; duration: number }>();
    const errors: { role: string; reason: string }[] = [];
    const pending: typeof todo = [];
    for (const item of todo) {
      const hit = cache.get(cacheKey(item.m, item.slot));
      if (hit) audioByMsg.set(item.m.id, hit);
      else pending.push(item);
    }
    const reused = audioByMsg.size;
    if (reused > 0) {
      setProgress({ label: `Reaproveitando ${reused} áudio(s) do cache`, pct: reused / todo.length });
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
          const entry = { url, duration };
          audioByMsg.set(m.id, entry);
          cache.set(cacheKey(m, slot), entry);
        } catch (e) {
          errors.push({ role: labelFor(m.role), reason: e instanceof Error ? e.message : String(e) });
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

  /** One-click: synth → render → download. No editor. blockIndex=null = full debate. */
  async function exportDirect(blockIndex: number | null) {
    if (!data) return;
    const d = data.debate;
    if ((d.format ?? "duel") !== "duel") {
      toast.error("Exportação de vídeo ainda só suporta o formato Duelo.");
      return;
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
      toast.success(blockIndex === null ? "Vídeo MP4 exportado!" : `Bloco ${blockIndex + 1} exportado!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar vídeo");
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

  const busy = progress !== null;
  const disabled = !data || data.messages.length === 0 || busy;
  const subtopics = (data?.debate.block_subtopics as Array<{ title?: string }> | null) ?? [];
  const blockCount = subtopics.length;

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="inline-flex flex-wrap items-center gap-1">
        <Button onClick={prepareAndOpen} disabled={disabled} size="sm" variant="default">
          {busy && !editorOpen ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Film className="h-4 w-4 mr-1" />}
          {busy && !editorOpen ? "Preparando…" : "Editor de vídeo"}
        </Button>
        <Button onClick={() => exportDirect(null)} disabled={disabled} size="sm" variant="outline" title="Gera o MP4 completo direto, sem abrir o editor">
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Exportar MP4
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
    </div>
  );
}
