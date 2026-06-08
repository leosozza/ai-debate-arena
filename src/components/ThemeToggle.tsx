import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

/**
 * Toggles the light theme by adding/removing `.light` on <html>.
 * The app is dark by default (:root); `.light` flips the tokens.
 */
export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const isLight = localStorage.getItem("arena-theme") === "light";
    setLight(isLight);
    document.documentElement.classList.toggle("light", isLight);
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    localStorage.setItem("arena-theme", next ? "light" : "dark");
  }

  return (
    <Button size="icon" variant="ghost" onClick={toggle} aria-label="Alternar tema claro/escuro" title="Tema claro/escuro">
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
