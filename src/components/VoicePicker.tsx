import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VOICE_CATALOG, PROVIDER_LABEL, type VoiceProvider } from "@/lib/voice-catalog";
import { ttsSpeak } from "@/lib/debate.functions";
import { minimaxTts } from "@/lib/tts.functions";
import { Play, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  label?: string;
  provider: VoiceProvider | null | undefined;
  voiceId: string | null | undefined;
  onChange: (provider: VoiceProvider, voiceId: string | null) => void;
  sampleText?: string;
}

const DEFAULT_SAMPLE = "Olá! Esta é uma amostra da minha voz para o debate.";

export function VoicePicker({ label, provider, voiceId, onChange, sampleText }: Props) {
  const p: VoiceProvider = provider ?? "browser";
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const elTts = useServerFn(ttsSpeak);
  const mmTts = useServerFn(minimaxTts);

  useEffect(() => {
    function load() {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      setBrowserVoices(window.speechSynthesis.getVoices());
    }
    load();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = load;
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
  }

  async function preview() {
    if (playing || loading) {
      stop();
      return;
    }
    const text = sampleText?.trim() || DEFAULT_SAMPLE;
    try {
      if (p === "browser") {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "pt-BR";
        if (voiceId) {
          const v = browserVoices.find((bv) => bv.name === voiceId);
          if (v) u.voice = v;
        } else {
          const v = browserVoices.find((bv) => bv.lang?.toLowerCase().startsWith("pt"));
          if (v) u.voice = v;
        }
        u.onend = () => setPlaying(false);
        u.onerror = () => setPlaying(false);
        setPlaying(true);
        window.speechSynthesis.speak(u);
        return;
      }

      const id = voiceId ?? VOICE_CATALOG[p][0].id;
      setLoading(true);
      const res =
        p === "eleven"
          ? await elTts({ data: { text, voiceId: id } })
          : await mmTts({ data: { text, voiceId: id, model: "speech-02-hd", speed: 1 } });
      const base64 = "audio" in res ? res.audio : res.audioBase64;
      const mime = res.mime;
      const audio = new Audio(`data:${mime};base64,${base64}`);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      setPlaying(true);
      await audio.play();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao tocar amostra");
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>}
      <div className="flex gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <Select value={p} onValueChange={(v) => { stop(); onChange(v as VoiceProvider, null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["browser", "eleven", "minimax"] as const).map((k) => (
                <SelectItem key={k} value={k}>{PROVIDER_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {p === "browser" ? (
            <Select value={voiceId ?? "__auto"} onValueChange={(v) => { stop(); onChange("browser", v === "__auto" ? null : v); }}>
              <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto">Automática (pt-BR)</SelectItem>
                {browserVoices.map((v) => (
                  <SelectItem key={v.name} value={v.name}>{v.name} ({v.lang})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={voiceId ?? VOICE_CATALOG[p][0].id} onValueChange={(v) => { stop(); onChange(p, v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VOICE_CATALOG[p].map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={preview}
          aria-label={playing ? "Parar amostra" : "Ouvir amostra"}
          title={playing ? "Parar" : "Ouvir amostra"}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
