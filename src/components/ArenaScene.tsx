import type { ArenaTheme, ArenaPalette } from "@/lib/arena-themes";

/** Fundo cinematográfico da arena, desenhado em CSS a partir do tema. */
export function ArenaScene({ theme, className = "" }: { theme: ArenaTheme; className?: string }) {
  const p = theme.palette;
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ background: p.base }}>
      {/* brilhos ambiente nos dois lados */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(55% 75% at 12% 32%, ${p.a}, transparent 62%)`, opacity: 0.3 }} />
      <div className="absolute inset-0" style={{ background: `radial-gradient(55% 75% at 88% 32%, ${p.b}, transparent 62%)`, opacity: 0.3 }} />
      {/* piso em grade com perspectiva */}
      <FloorGrid accent={p.accent} />
      {/* cena específica do arquétipo */}
      {theme.scene === "split" && <SceneSplit p={p} />}
      {theme.scene === "table" && <SceneTable p={p} />}
      {theme.scene === "podiums" && <ScenePodiums p={p} />}
      {theme.scene === "columns" && <SceneColumns p={p} />}
      {theme.scene === "cosmic" && <SceneCosmic p={p} />}
      {/* vinheta */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 100% at 50% 28%, transparent 38%, rgba(0,0,0,0.55))" }} />
    </div>
  );
}

function FloorGrid({ accent }: { accent: string }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[48%] overflow-hidden [perspective:380px]">
      <div
        className="absolute inset-x-[-60%] bottom-0 h-[220%] origin-bottom [transform:rotateX(72deg)]"
        style={{
          backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
          backgroundSize: "44px 44px",
          opacity: 0.16,
          maskImage: "linear-gradient(to top, #000 10%, transparent)",
          WebkitMaskImage: "linear-gradient(to top, #000 10%, transparent)",
        }}
      />
    </div>
  );
}

function SceneSplit({ p }: { p: ArenaPalette }) {
  return (
    <>
      <div
        className="absolute top-[16%] bottom-[22%] left-1/2 w-px -translate-x-1/2"
        style={{ background: `linear-gradient(${p.a}, ${p.accent}, ${p.b})`, boxShadow: `0 0 32px ${p.accent}` }}
      />
      <div className="absolute bottom-[15%] left-[14%] h-2.5 w-[24%] rounded-[50%]" style={{ background: p.a, filter: "blur(7px)", opacity: 0.5 }} />
      <div className="absolute bottom-[15%] right-[14%] h-2.5 w-[24%] rounded-[50%]" style={{ background: p.b, filter: "blur(7px)", opacity: 0.5 }} />
    </>
  );
}

function SceneTable({ p }: { p: ArenaPalette }) {
  return (
    <>
      <div
        className="absolute bottom-[19%] left-1/2 -translate-x-1/2"
        style={{ width: "48%", height: "16%", borderRadius: "50%", border: `2px solid ${p.accent}`, boxShadow: `0 0 44px ${p.a}, inset 0 0 34px ${p.b}`, background: `radial-gradient(ellipse, ${p.base}, transparent)` }}
      />
      {[18, 38, 62, 82].map((x, i) => (
        <div key={i} className="absolute bottom-[30%] h-2 w-[8%] rounded-[50%]" style={{ left: `${x}%`, transform: "translateX(-50%)", background: i % 2 ? p.b : p.a, filter: "blur(4px)", opacity: 0.55 }} />
      ))}
    </>
  );
}

function ScenePodiums({ p }: { p: ArenaPalette }) {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute bottom-[17%]"
          style={{ left: `${19 + i * 16}%`, width: "8%", height: "13%", borderRadius: "4px 4px 0 0", background: `linear-gradient(${i % 2 ? p.b : p.a}, transparent)`, opacity: 0.5, boxShadow: `0 0 22px ${i % 2 ? p.b : p.a}` }}
        />
      ))}
    </>
  );
}

function SceneColumns({ p }: { p: ArenaPalette }) {
  return (
    <>
      {[10, 28, 72, 90].map((x, i) => (
        <div key={i} className="absolute top-[12%] bottom-[20%]" style={{ left: `${x}%`, width: "4.5%", background: `linear-gradient(${p.accent}, transparent)`, opacity: 0.22 }} />
      ))}
      <div
        className="absolute top-[18%] left-1/2 -translate-x-1/2"
        style={{ width: "30%", height: "26%", borderRadius: "0 0 50% 50%", border: `2px solid ${p.accent}`, borderTop: "none", opacity: 0.4, boxShadow: `0 0 32px ${p.a}` }}
      />
    </>
  );
}

function SceneCosmic({ p }: { p: ArenaPalette }) {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute top-[30%] left-1/2 -translate-x-1/2 rounded-full"
          style={{ width: `${16 + i * 13}%`, aspectRatio: "1", border: `1px solid ${i % 2 ? p.a : p.b}`, opacity: 0.42 - i * 0.08 }}
        />
      ))}
      <div className="absolute top-[34%] left-1/2 h-[8%] w-[8%] -translate-x-1/2 rounded-full" style={{ background: p.accent, filter: "blur(16px)", opacity: 0.6 }} />
    </>
  );
}
