import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Search, Bell, Plus, User, LogOut, Bot } from "lucide-react";
import AppSidebar from "./AppSidebar";
import AssistantDock from "./assistant/AssistantDock";
import { useAuth } from "@/hooks/useAuth";
import { useAssistant } from "@/contexts/AssistantContext";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isInProject, dockOpen, toggleDock } = useAssistant();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <header
        className={cn(
          "fixed top-0 right-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6 transition-all duration-300",
          collapsed ? "left-16" : "left-60"
        )}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar projetos, ativos, modelos..."
              className="w-full rounded-md border border-border bg-secondary/50 py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isInProject && (
            <button
              onClick={toggleDock}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                dockOpen
                  ? "bg-primary/10 text-primary"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan"
              )}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Assistente</span>
            </button>
          )}
          <button className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors glow-cyan">
            <Plus className="h-3.5 w-3.5" />
            <span>Criar</span>
          </button>
          <button className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <Bell className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 ml-1">
            <span className="text-xs text-muted-foreground max-w-[120px] truncate hidden sm:block">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              title="Sair"
              className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "pt-14 min-h-screen flex transition-all duration-300",
          collapsed ? "ml-16" : "ml-60"
        )}
      >
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
        <AssistantDock />
      </div>
    </div>
  );
}
