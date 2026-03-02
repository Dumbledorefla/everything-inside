import { useState, useEffect } from "react";
import { CloudRain, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type AppTheme = "obsidian" | "rainy";

function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "obsidian";
  return (localStorage.getItem("cos-theme") as AppTheme) || "obsidian";
}

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  if (theme === "rainy") {
    root.classList.add("rainy");
  } else {
    root.classList.remove("rainy");
  }
  localStorage.setItem("cos-theme", theme);
  window.dispatchEvent(new CustomEvent("cos-theme-change", { detail: theme }));
}

export function useCurrentTheme(): AppTheme {
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme);
  useEffect(() => {
    const handler = (e: Event) => setTheme((e as CustomEvent).detail);
    window.addEventListener("cos-theme-change", handler);
    return () => window.removeEventListener("cos-theme-change", handler);
  }, []);
  return theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Apply on mount
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  const toggle = () => setTheme((t) => (t === "obsidian" ? "rainy" : "obsidian"));
  const isRainy = theme === "rainy";

  return (
    <button
      onClick={toggle}
      className={cn(
        "relative flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-300",
        "hover:bg-accent/60 text-muted-foreground hover:text-foreground",
        isRainy && "text-primary hover:text-primary"
      )}
      title={isRainy ? "Modo Obsidian" : "Modo Chuva"}
    >
      {isRainy ? (
        <Moon className="h-4 w-4" />
      ) : (
        <CloudRain className="h-4 w-4" />
      )}
      {isRainy && (
        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      )}
    </button>
  );
}
