import { motion } from "motion/react";

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
          <motion.span
            key={i}
            className={`w-[3px] rounded-full ${colorClass}`}
            initial={{ height: 6 }}
            animate={active ? { height: [6, peak, 6] } : { height: 6 }}
            transition={
              active
                ? { duration: dur, repeat: Infinity, ease: "easeInOut", delay }
                : { duration: 0.3 }
            }
            style={{ opacity: active ? 1 : 0.4 }}
          />
        );
      })}
    </div>
  );
}
