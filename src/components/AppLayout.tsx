import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Search, Bell, Plus, Bot, Command, Globe, LogOut } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import AppSidebar from "./AppSidebar";
import AssistantDock from "./assistant/AssistantDock";
import CommandPalette from "./CommandPalette";
import ThemeToggle from "./ThemeToggle";
import StarField from "./StarField";
import PageTransition from "./PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useAssistant } from "@/contexts/AssistantContext";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isInProject, dockOpen, toggleDock, openDock, agentMode } = useAssistant();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Immersive animated star field */}
      <StarField />

      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <header
        className={cn(
          "fixed top-0 right-0 z-30 flex h-12 items-center justify-between px-4 transition-all duration-300",
          "border-b border-border/30 bg-background/60 backdrop-blur-2xl",
          collapsed ? "left-16" : "left-60"
        )}
      >
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => {
              const e = new KeyboardEvent("keydown", { key: "k", metaKey: true });
              document.dispatchEvent(e);
            }}
            className="flex items-center gap-2 rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground hover:bg-card/50 hover:text-foreground transition-all max-w-xs flex-1 group"
          >
            <Search className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border/30 bg-background/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={dockOpen ? toggleDock : openDock}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
              dockOpen
                ? "bg-primary/10 text-primary border border-primary/20"
                : agentMode === "global"
                ? "bg-cos-purple/20 text-cos-purple border border-cos-purple/20 hover:bg-cos-purple/30"
                : "bg-primary/20 text-primary border border-primary/20 hover:bg-primary/30"
            )}
          >
            {agentMode === "global" ? <Globe className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">
              {agentMode === "global" ? "Diretor" : "Assistente"}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-cos-success animate-pulse" />
          </button>

          <button className="flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Criar</span>
          </button>
          <button className="rounded-xl p-2 text-muted-foreground hover:bg-card/50 hover:text-foreground transition-colors">
            <Bell className="h-4 w-4" />
          </button>
          <ThemeToggle />
          <div className="flex items-center gap-1.5 ml-1.5 pl-1.5 border-l border-border/30">
            <span className="text-[10px] text-muted-foreground max-w-[100px] truncate hidden sm:block font-mono">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              title="Sair"
              className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "pt-12 min-h-screen flex transition-all duration-300 relative z-[1]",
          collapsed ? "ml-16" : "ml-60"
        )}
      >
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
        <AssistantDock />
      </div>

      <CommandPalette />
    </div>
  );
}
