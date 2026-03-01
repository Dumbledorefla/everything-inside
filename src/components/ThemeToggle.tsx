import { useState, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import EclipseTransition from "./EclipseTransition";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [eclipseActive, setEclipseActive] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<string | null>(null);

  const handleClick = useCallback(() => {
    if (eclipseActive) return;
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setPendingTheme(next);
    setEclipseActive(true);

    // Apply theme at the "corona" moment (400ms)
    setTimeout(() => {
      setTheme(next);
    }, 400);
  }, [resolvedTheme, eclipseActive, setTheme]);

  const handleComplete = useCallback(() => {
    setEclipseActive(false);
    setPendingTheme(null);
  }, []);

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "relative rounded-xl p-2 text-muted-foreground/40 transition-all",
          "hover:bg-card/30 hover:text-foreground"
        )}
        title={resolvedTheme === "dark" ? "Modo Snow" : "Modo Obsidian"}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute inset-0 m-auto h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Alternar tema</span>
      </button>

      <EclipseTransition
        active={eclipseActive}
        targetTheme={pendingTheme || "dark"}
        onComplete={handleComplete}
      />
    </>
  );
}
