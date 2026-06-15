import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Pause, Loader2 } from "lucide-react";
import { ttsCacheFindByMsgId, blobToUrl } from "@/lib/tts-cache";

/**
 * Botão para ouvir individualmente a fala já gerada (cache IndexedDB).
 * Não regenera — só toca se já existir áudio salvo (pela apresentação ou exportador).
 */
export function MessageAudioButton({ msgId, label }: { msgId: string; label?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "missing">("idle");
  const [hasCache, setHasCache] = useState<boolean | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void ttsCacheFindByMsgId(msgId).then((e) => {
      if (alive) setHasCache(!!e);
    });
    return () => {
      alive = false;
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [msgId]);

  async function toggle() {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setState("idle");
      return;
    }
    if (audioRef.current && urlRef.current) {
      await audioRef.current.play().catch(() => {});
      setState("playing");
      return;
    }
    setState("loading");
    const entry = await ttsCacheFindByMsgId(msgId);
    if (!entry) {
      setState("missing");
      setHasCache(false);
      return;
    }
    const url = blobToUrl(entry.blob);
    urlRef.current = url;
    const a = new Audio(url);
    audioRef.current = a;
    a.onended = () => setState("idle");
    a.onerror = () => setState("idle");
    try {
      await a.play();
      setState("playing");
    } catch {
      setState("idle");
    }
  }

  const disabled = hasCache === false;
  const title = disabled
    ? "Áudio ainda não gerado — abra a apresentação ou exporte o MP4 para gerar."
    : state === "playing" ? "Pausar" : "Ouvir fala";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={disabled || state === "loading"}
      className="h-7 px-2 gap-1 text-xs"
      title={title}
      aria-label={title}
    >
      {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : state === "playing" ? <Pause className="h-3.5 w-3.5" />
        : <Volume2 className="h-3.5 w-3.5" />}
      {label ?? "Ouvir"}
    </Button>
  );
}
