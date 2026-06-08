import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VOICE_CATALOG, PROVIDER_LABEL, type VoiceProvider } from "@/lib/voice-catalog";

interface Props {
  label?: string;
  provider: VoiceProvider | null | undefined;
  voiceId: string | null | undefined;
  onChange: (provider: VoiceProvider, voiceId: string | null) => void;
}

export function VoicePicker({ label, provider, voiceId, onChange }: Props) {
  const p: VoiceProvider = provider ?? "browser";
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    function load() {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const v = window.speechSynthesis.getVoices();
      setBrowserVoices(v);
    }
    load();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>}
      <div className="grid grid-cols-2 gap-2">
        <Select value={p} onValueChange={(v) => onChange(v as VoiceProvider, null)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(["browser", "eleven", "minimax"] as const).map((k) => (
              <SelectItem key={k} value={k}>{PROVIDER_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {p === "browser" ? (
          <Select value={voiceId ?? "__auto"} onValueChange={(v) => onChange("browser", v === "__auto" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto">Automática (pt-BR)</SelectItem>
              {browserVoices.map((v) => (
                <SelectItem key={v.name} value={v.name}>{v.name} ({v.lang})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={voiceId ?? VOICE_CATALOG[p][0].id} onValueChange={(v) => onChange(p, v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VOICE_CATALOG[p].map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
