import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Search, Bell, Plus, Bot, Command } from "lucide-react";
import AppSidebar from "./AppSidebar";
import AssistantDock from "./assistant/AssistantDock";
import CommandPalette from "./CommandPalette";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useAssistant } from "@/contexts/AssistantContext";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isInProject, dockOpen, toggleDock } = useAssistant();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <header
        className={cn(
          "fixed top-0 right-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 transition-all duration-300",
          collapsed ? "left-16" : "left-60"
        )}
      >
        <div className="flex items-center gap-3 flex-1">
          {/* Command+K Trigger */}
          <button
            onClick={() => {
              const e = new KeyboardEvent("keydown", { key: "k", metaKey: true });
              document.dispatchEvent(e);
            }}
            className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors max-w-xs flex-1"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>
        <div className="flex items-center gap-1">
          {isInProject && (
            <button
              onClick={toggleDock}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                dockOpen
                  ? "bg-primary/10 text-primary"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan"
              )}
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Assistente</span>
            </button>
          )}
          <button className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors glow-cyan">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Criar</span>
          </button>
          <button className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <Bell className="h-4 w-4" />
          </button>
          <ThemeToggle />
          <div className="flex items-center gap-1 ml-1 pl-1 border-l border-border">
            <span className="text-[10px] text-muted-foreground max-w-[100px] truncate hidden sm:block font-mono">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              title="Sair"
              className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "pt-12 min-h-screen flex transition-all duration-300",
          collapsed ? "ml-16" : "ml-60"
        )}
      >
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
        <AssistantDock />
      </div>

      <CommandPalette />
    </div>
  );
}
