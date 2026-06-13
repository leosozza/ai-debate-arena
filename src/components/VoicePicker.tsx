import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VOICE_CATALOG, PROVIDER_LABEL, filterVoicesByGender, type VoiceProvider, type VoiceGender } from "@/lib/voice-catalog";
import { ttsSpeak } from "@/lib/debate.functions";
import { minimaxTts } from "@/lib/tts.functions";
import { replicateTts } from "@/lib/voice-replicate.functions";
import { listVoicePresets } from "@/lib/voice-presets.functions";
import { Play, Square, Loader2, Sliders, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export interface VoiceSettings {
  speed: number; // 0.5 .. 2.0
  pitch: number; // -12 .. 12 (semitones; aplicado por browser/minimax)
  volume: number; // 0 .. 2
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { speed: 1, pitch: 0, volume: 1 };

interface Props {
  label?: string;
  provider: VoiceProvider | null | undefined;
  voiceId: string | null | undefined;
  onChange: (provider: VoiceProvider, voiceId: string | null) => void;
  settings?: VoiceSettings | null;
  onSettingsChange?: (s: VoiceSettings) => void;
  sampleText?: string;
  /** Quando definido, esconde vozes do gênero oposto (Kokoro/Piper/Eleven). */
  filterGender?: VoiceGender | null;
}

const DEFAULT_SAMPLE = "Olá! Esta é uma amostra da minha voz para o debate.";

export function VoicePicker({ label, provider, voiceId, onChange, settings, onSettingsChange, sampleText, filterGender }: Props) {
  const p: VoiceProvider = provider ?? "browser";
  const s: VoiceSettings = settings ?? DEFAULT_VOICE_SETTINGS;
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const elTts = useServerFn(ttsSpeak);
  const mmTts = useServerFn(minimaxTts);
  const rpTts = useServerFn(replicateTts);
  const listPresets = useServerFn(listVoicePresets);
  const presetsQuery = useQuery({
    queryKey: ["voice-presets"],
    queryFn: () => listPresets(),
    staleTime: 60_000,
  });
  const presets = presetsQuery.data ?? [];

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

  function updateSetting(key: keyof VoiceSettings, value: number) {
    if (!onSettingsChange) return;
    onSettingsChange({ ...s, [key]: value });
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
        u.rate = Math.max(0.1, Math.min(10, s.speed));
        // pitch do Web Speech: 0..2 (1 = normal). Mapeia semitons -12..12 → 0..2.
        u.pitch = Math.max(0, Math.min(2, 1 + s.pitch / 12));
        u.volume = Math.max(0, Math.min(1, s.volume));
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

      if (p === "kokoro" || p === "piper") {
        setLoading(true);
        const fallbackId = p === "kokoro" ? "pf_dora" : "pt_BR-faber-medium";
        const vid = (voiceId && voiceId.length > 0 ? voiceId : VOICE_CATALOG[p][0]?.id) ?? fallbackId;
        const url = p === "kokoro"
          ? await (await import("@/lib/kokoro-tts")).kokoroSynthUrl(text, vid)
          : await (await import("@/lib/piper-tts")).piperSynthUrl(text, vid);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.onerror = () => setPlaying(false);
        setPlaying(true);
        await audio.play();
        return;
      }

      const id = (voiceId && voiceId.length > 0 ? voiceId : VOICE_CATALOG[p]?.[0]?.id) ?? "";
      if (!id) {
        toast.error("Selecione uma voz primeiro.");
        return;
      }
      setLoading(true);
      const res =
        p === "eleven"
          ? await elTts({ data: { text, voiceId: id } })
          : p === "minimax"
          ? await mmTts({
              data: {
                text,
                voiceId: id,
                model: "speech-02-hd",
                speed: s.speed,
                pitch: Math.round(s.pitch),
                vol: Math.max(0.1, Math.min(10, s.volume * 1.0)),
              },
            })
          : await rpTts({ data: { text, voiceId: id } });
      if ("error" in res && res.error) throw new Error(res.error);
      const base64 = "audio" in res ? res.audio : res.audioBase64;
      const mime = res.mime;
      const audio = new Audio(`data:${mime};base64,${base64}`);
      audioRef.current = audio;
      // Para providers que não aceitam settings server-side, aplica no player.
      if (p === "replicate" || p === "eleven") {
        audio.playbackRate = Math.max(0.5, Math.min(2, s.speed));
        audio.volume = Math.max(0, Math.min(1, s.volume));
      }
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

  const pitchSupported = p === "browser" || p === "minimax";

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>}
      <div className="flex gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <Select
            value={p}
            onValueChange={(v) => {
              stop();
              const np = v as VoiceProvider;
              if (np === "browser") onChange(np, null);
              else onChange(np, VOICE_CATALOG[np][0].id);
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["browser", "kokoro", "piper", "eleven", "minimax", "replicate"] as const).map((k) => (
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
            (() => {
              const catalog = VOICE_CATALOG[p] ?? [];
              const fallback = catalog[0]?.id ?? "";
              const currentId = voiceId && voiceId.length > 0 ? voiceId : fallback;
              const showPresets = p === "replicate" && presets.length > 0;
              // Para presets clonados (replicate), o usuário pode escolher o modelo:
              // armazenamos como "<prefix>:<url>" ou só "<url>" (xtts default).
              const stripPrefix = (s: string) => s.replace(/^(cb|fish|xtts):/, "");
              const cleanId = p === "replicate" ? stripPrefix(currentId) : currentId;
              const presetMatch = showPresets ? presets.find((pr) => pr.voice_url === cleanId) : null;
              const isCustomUrl = cleanId.startsWith("http") && !presetMatch;
              const isCustomCatalog = !cleanId.startsWith("http") && cleanId.length > 0 && !catalog.some((v) => v.id === currentId);
              if (!currentId) {
                return (
                  <Select disabled value="__none">
                    <SelectTrigger><SelectValue placeholder="Sem vozes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem vozes disponíveis</SelectItem>
                    </SelectContent>
                  </Select>
                );
              }
              // Quando uma URL clonada está selecionada (replicate), mostramos seletor
              // de modelo logo abaixo do select de vozes (renderizado fora).
              return (
                <Select
                  value={presetMatch ? presetMatch.voice_url : currentId}
                  onValueChange={(v) => { stop(); onChange(p, v); }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {showPresets && (
                      <SelectGroup>
                        <SelectLabel>🎭 Meus presets (clonados)</SelectLabel>
                        {presets.map((pr) => (
                          <SelectItem key={pr.id} value={pr.voice_url}>
                            {pr.is_real_person ? "🎭 " : "🎙 "}{pr.name}
                            {pr.is_real_person ? " · Voz simulada por IA" : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {isCustomUrl && !presetMatch && (
                      <SelectItem value={cleanId}>🎙 Personalizada (URL)</SelectItem>
                    )}
                    {isCustomCatalog && (
                      <SelectItem value={currentId}>🎙 Personalizada ({currentId.slice(0, 12)}…)</SelectItem>
                    )}
                    <SelectGroup>
                      <SelectLabel>Catálogo PT-BR &amp; Geral</SelectLabel>
                      {catalog.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              );
            })()
          )}
        </div>
        {onSettingsChange && (
          <Button
            type="button"
            variant={showAdjust ? "secondary" : "outline"}
            size="icon"
            onClick={() => setShowAdjust((v) => !v)}
            aria-label="Ajustes de voz"
            title="Ajustes de voz (velocidade, tom, volume)"
          >
            <Sliders className="h-4 w-4" />
          </Button>
        )}
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

      {p === "replicate" && (() => {
        const raw = voiceId ?? "";
        const cleanId = raw.replace(/^(cb|fish|xtts):/, "");
        if (!/^https?:\/\//i.test(cleanId)) return null;
        const currentModel: "xtts" | "cb" | "fish" = raw.startsWith("cb:")
          ? "cb"
          : raw.startsWith("fish:")
          ? "fish"
          : "xtts";
        return (
          <div className="flex items-center gap-2">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Modelo</Label>
            <Select
              value={currentModel}
              onValueChange={(v) => {
                stop();
                const prefix = v === "xtts" ? "" : `${v}:`;
                onChange("replicate", `${prefix}${cleanId}`);
              }}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cb">🌎 Chatterbox · PT-BR nativo (recomendado)</SelectItem>
                <SelectItem value="xtts">⚡ XTTS v2 · rápido (legado)</SelectItem>
                <SelectItem value="fish">💎 Fish Speech · premium (lento)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      })()}


      {onSettingsChange && showAdjust && (
        <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ajustes de voz</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onSettingsChange(DEFAULT_VOICE_SETTINGS)}
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Padrão
            </Button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <Label className="text-xs">Velocidade</Label>
              <span className="text-muted-foreground tabular-nums">{s.speed.toFixed(2)}x</span>
            </div>
            <Slider
              min={0.5}
              max={2}
              step={0.05}
              value={[s.speed]}
              onValueChange={(v) => updateSetting("speed", v[0])}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <Label className="text-xs">
                Tom (pitch){!pitchSupported && <span className="text-muted-foreground/70"> — só Browser/MiniMax</span>}
              </Label>
              <span className="text-muted-foreground tabular-nums">{s.pitch > 0 ? "+" : ""}{s.pitch}</span>
            </div>
            <Slider
              min={-12}
              max={12}
              step={1}
              value={[s.pitch]}
              onValueChange={(v) => updateSetting("pitch", v[0])}
              disabled={!pitchSupported}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <Label className="text-xs">Volume</Label>
              <span className="text-muted-foreground tabular-nums">{Math.round(s.volume * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[s.volume]}
              onValueChange={(v) => updateSetting("volume", v[0])}
            />
          </div>

          <p className="text-[10px] text-muted-foreground leading-snug">
            Velocidade e volume valem para todos os providers (volume aplicado no player quando o provider não aceita). Tom só é aplicado em Browser e MiniMax.
          </p>
        </div>
      )}
    </div>
  );
}
