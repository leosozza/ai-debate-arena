import { motion } from "motion/react";

/**
 * Global animated backdrop for the studio. Three slow-drifting, heavily
 * blurred color orbs in the brand + duel palette, over a subtle grid and a
 * vignette. Fixed and behind everything (-z-10). Opaque pages (e.g. the
 * present mode) simply paint over it.
 */
export function ArenaBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-background">
      <motion.div
        className="absolute -left-[15%] -top-[20%] h-[65vh] w-[65vh] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, oklch(0.62 0.205 277 / 0.40), transparent 70%)" }}
        animate={{ x: [0, 70, 0], y: [0, 50, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[10%] -top-[10%] h-[55vh] w-[55vh] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.145 221 / 0.32), transparent 70%)" }}
        animate={{ x: [0, -55, 0], y: [0, 70, 0], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-20%] left-[30%] h-[55vh] w-[55vh] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, oklch(0.77 0.16 64 / 0.22), transparent 70%)" }}
        animate={{ x: [0, 45, 0], y: [0, -45, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* faint grid */}
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:64px_64px]" />
      {/* vignette to deepen edges */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-10%,transparent_45%,oklch(0.1_0.02_264_/_0.65))]" />
    </div>
  );
}
