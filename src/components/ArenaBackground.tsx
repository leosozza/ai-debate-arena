/**
 * Global animated backdrop for the studio. Three slow-drifting, heavily
 * blurred color orbs in the brand + duel palette, over a subtle grid and a
 * vignette. Fixed and behind everything (-z-10). Opaque pages (e.g. the
 * present mode) simply paint over it.
 */
export function ArenaBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-background">
      <div
        className="absolute -left-[15%] -top-[20%] h-[65vh] w-[65vh] rounded-full blur-[130px] animate-[arena-drift-a_20s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, oklch(0.62 0.205 277 / 0.40), transparent 70%)" }}
      />
      <div
        className="absolute -right-[10%] -top-[10%] h-[55vh] w-[55vh] rounded-full blur-[130px] animate-[arena-drift-b_24s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.145 221 / 0.32), transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-20%] left-[30%] h-[55vh] w-[55vh] rounded-full blur-[130px] animate-[arena-drift-c_28s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, oklch(0.77 0.16 64 / 0.22), transparent 70%)" }}
      />
      {/* faint grid */}
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:64px_64px]" />
      {/* vignette to deepen edges */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-10%,transparent_45%,oklch(0.1_0.02_264_/_0.65))]" />
      <style>{`@keyframes arena-drift-a { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(70px,50px) scale(1.15); } } @keyframes arena-drift-b { 0%, 100% { transform: translate(0,0) scale(1.1); } 50% { transform: translate(-55px,70px) scale(1); } } @keyframes arena-drift-c { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(45px,-45px) scale(1.2); } }`}</style>
    </div>
  );
}
