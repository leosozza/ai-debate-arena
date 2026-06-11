import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Film, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getDebate, ttsSpeak } from "@/lib/debate.functions";
import { listPersonas } from "@/lib/persona.functions";
import { minimaxTts } from "@/lib/tts.functions";
import { replicateTts } from "@/lib/voice-replicate.functions";
import { DEFAULT_VOICE_SETTINGS } from "@/components/VoicePicker";
import { type VoiceProvider } from "@/lib/voice-catalog";
import { stripMarkdownForTts } from "@/lib/text-utils";
import { AI_DISCLAIMER_TEXT } from "@/components/AIDisclaimer";

type Slot = { provider: VoiceProvider; voiceId: string | null };

export function ExportVideoButton({ debateId }: { debateId: string }) {
  const get = useServerFn(getDebate);
  const lp = useServerFn(listPersonas);
  const elTts = useServerFn(ttsSpeak);
  const mmTts = useServerFn(minimaxTts);
  const rpTts = useServerFn(replicateTts);
  const { data } = useQuery({ queryKey: ["debate", debateId], queryFn: () => get({ data: { id: debateId } }) });
  const { data: personas } = useQuery({ queryKey: ["personas"], queryFn: () => lp() });

  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);

  function resolveSlot(
    provider: string | null | undefined,
    voiceId: string | null | undefined,
    personaName?: string | null,
  ): Slot {
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const persona = personaName ? personas?.find((p) => norm(p.name) === norm(personaName)) ?? null : null;
    const pp = persona?.voice_provider as VoiceProvider | null | undefined;
    const pid = persona?.voice_id ?? null;
    if (pp && ["browser", "eleven", "minimax", "replicate"].includes(pp)) {
      return { provider: pp, voiceId: pid };
    }
    const p = (provider as VoiceProvider) ?? "browser";
    return { provider: p, voiceId: voiceId ?? null };
  }

  async function fetchAudioUrl(slot: Slot, text: string): Promise<string> {
    if (!slot.voiceId) throw new Error("voz_nao_definida");
    const clean = stripMarkdownForTts(text).slice(0, 5000);
    if (slot.provider === "eleven") {
      const res = await elTts({ data: { text: clean, voiceId: slot.voiceId } });
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
    return `data:${res.mime};base64,${res.audioBase64}`;
  }

  async function run() {
    if (!data) return;
    const d = data.debate;
    const slotMod = resolveSlot(d.voice_provider_mod, d.voice_id_mod);
    const slotA = resolveSlot(d.voice_provider_a, d.voice_id_a, d.debater_a_name);
    const slotB = resolveSlot(d.voice_provider_b, d.voice_id_b, d.debater_b_name);

    if ([slotMod, slotA, slotB].some((s) => s.provider === "browser" || !s.voiceId)) {
      toast.error("Defina uma voz não-navegador para mediador e debatedores antes de exportar.");
      return;
    }

    const virtualOpening = [
      { id: "__opening_disclaimer__", role: "moderator" as const, phase: "abertura", content: AI_DISCLAIMER_TEXT },
      {
        id: "__opening_guests__",
        role: "moderator" as const,
        phase: "abertura",
        content:
          `Boa noite, e bem-vindos à Legends Arena. Hoje na arena, o tema é: ${d.topic}. ` +
          `À minha direita, ${d.debater_a_name}. À minha esquerda, ${d.debater_b_name}. ` +
          `Que vença o melhor argumento.`,
      },
    ];
    const all = [
      ...virtualOpening,
      ...data.messages.map((m) => ({
        id: m.id,
        role: ((m.role === "a" || m.role === "b") ? m.role : "moderator") as "moderator" | "a" | "b",
        phase: m.phase ?? "",
        content: m.content,
      })),
    ];

    setProgress({ label: "Preparando vozes", pct: 0 });
    try {
      const audioByMsg = new Map<string, string>();
      const todo = all.map((m) => ({ m, slot: m.role === "a" ? slotA : m.role === "b" ? slotB : slotMod }));
      let done = 0;
      let cursor = 0;
      const concurrency = 3;
      const worker = async () => {
        while (cursor < todo.length) {
          const i = cursor++;
          const { m, slot } = todo[i];
          try {
            const url = await fetchAudioUrl(slot, m.content);
            audioByMsg.set(m.id, url);
          } catch { /* ignore individual */ }
          done++;
          setProgress({ label: `Gerando vozes ${done}/${todo.length}`, pct: (done / todo.length) * 0.35 });
        }
      };
      await Promise.all(Array.from({ length: concurrency }, worker));

      const missing = all.filter((m) => !audioByMsg.get(m.id));
      if (missing.length > 0) {
        toast.error(`Falha ao gerar ${missing.length} áudio(s). Tente novamente.`);
        setProgress(null);
        return;
      }

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
        messages: all.map((m) => ({
          id: m.id,
          role: m.role,
          phase: m.phase,
          content: m.content,
          audioUrl: audioByMsg.get(m.id)!,
        })),
        onProgress: (label, pct) => setProgress({ label, pct: 0.35 + pct * 0.65 }),
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `debate-${debateId.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Vídeo MP4 exportado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar vídeo");
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  const disabled = !data || data.messages.length === 0 || busy;

  return (
    <div className="inline-flex flex-col gap-1">
      <Button onClick={run} disabled={disabled} size="sm" variant="default">
        {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Film className="h-4 w-4 mr-1" />}
        {busy ? "Exportando…" : "Exportar vídeo MP4"}
      </Button>
      {progress && (
        <div className="min-w-[220px]">
          <Progress value={Math.round(progress.pct * 100)} className="h-1.5" />
          <div className="text-[10px] text-muted-foreground mt-0.5">{progress.label}</div>
        </div>
      )}
    </div>
  );
}
