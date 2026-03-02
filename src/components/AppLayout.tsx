import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Search, Bell, Plus, Command, LogOut } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import AppSidebar from "./AppSidebar";
import AssistantDock from "./assistant/AssistantDock";
import ImmersiveDirector from "./assistant/ImmersiveDirector";
import CommandPalette from "./CommandPalette";
import StarField from "./StarField";
import RainEffect from "./RainEffect";
import PageTransition from "./PageTransition";
import BlackHoleShader from "./BlackHoleShader";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useAssistant } from "@/contexts/AssistantContext";
import { useCurrentTheme } from "./ThemeToggle";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isInProject, dockOpen, toggleDock, openDock, agentMode } = useAssistant();
  const currentTheme = useCurrentTheme();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden noise-overlay">
      {currentTheme === "rainy" ? <RainEffect /> : <StarField />}
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <header
        className={cn(
          "fixed top-0 right-0 z-30 flex h-12 items-center justify-between px-5 transition-all duration-300",
          "bg-surface-0 border-b border-border",
          collapsed ? "left-[60px]" : "left-56"
        )}
      >
        {/* Search */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <button
            onClick={() => {
              const e = new KeyboardEvent("keydown", { key: "k", metaKey: true });
              document.dispatchEvent(e);
            }}
            className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-3.5 py-1.5 text-xs text-muted-foreground/60 hover:bg-card/40 hover:text-muted-foreground hover:border-border/30 transition-all flex-1 group"
          >
            <Search className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border/20 bg-background/30 px-1.5 py-0.5 text-[9px] font-mono-brand text-muted-foreground/50">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={dockOpen ? toggleDock : openDock}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
              dockOpen
                ? "bg-primary/15 text-primary border border-primary/20"
                : agentMode === "global"
                ? "bg-muted/10 text-muted-foreground/80 border border-border/15 hover:bg-muted/20"
                : "bg-muted/10 text-muted-foreground/80 border border-border/15 hover:bg-muted/20"
            )}
          >
            <BlackHoleShader
              mode={agentMode === "global" ? "global" : "project"}
              size={26}
              thinking={false}
            />
            <span className="hidden sm:inline">
              {agentMode === "global" ? "Diretor" : "Assistente"}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-cos-success animate-pulse" />
          </button>

          <button className="flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/15 px-3 py-1.5 text-xs font-medium text-primary/80 hover:bg-primary/20 hover:text-primary transition-all">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Criar</span>
          </button>

          <ThemeToggle />

          <button className="rounded-xl p-2 text-muted-foreground/50 hover:bg-card/30 hover:text-muted-foreground transition-colors">
            <Bell className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1 ml-1 pl-2 border-l border-border/10">
            <span className="text-[10px] text-muted-foreground/60 max-w-[90px] truncate hidden sm:block font-mono-brand">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              title="Sair"
              className="rounded-xl p-2 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "pt-12 h-[calc(100vh)] flex transition-all duration-300 relative z-[1] overflow-hidden",
          collapsed ? "ml-[60px]" : "ml-56"
        )}
      >
        <main className="flex-1 min-w-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
        <AssistantDock />
      </div>

      <CommandPalette />
      <ImmersiveDirector />
    </div>
  );
}
