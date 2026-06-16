/**
 * Animated voice equalizer for the present mode. Bars pulse while `active`
 * (someone is speaking) and rest flat when idle. Colored per debater side
 * via `colorClass` (e.g. "bg-side-a"). Center-anchored so it grows
 * symmetrically like a waveform.
 */
export function VoiceWave({
  active,
  colorClass = "bg-primary",
  bars = 36,
}: {
  active: boolean;
  colorClass?: string;
  bars?: number;
}) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-16" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        // Deterministic per-bar variation (no Math.random → stable renders).
        const peak = 14 + ((i * 37) % 44);
        const dur = 0.45 + ((i % 6) * 0.09);
        const delay = (i % 9) * 0.04;
        return (
          <span
            key={i}
            className={`w-[3px] rounded-full ${colorClass}`}
            style={{
              height: active ? peak : 6,
              opacity: active ? 1 : 0.4,
              animation: active ? `voice-wave ${dur}s ease-in-out ${delay}s infinite` : undefined,
            }}
          />
        );
      })}
      <style>{`@keyframes voice-wave { 0%, 100% { transform: scaleY(0.28); } 50% { transform: scaleY(1); } }`}</style>
    </div>
  );
}
