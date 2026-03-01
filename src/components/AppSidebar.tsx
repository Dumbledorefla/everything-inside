import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Zap, Calendar, Library, FileStack, Settings,
  ChevronLeft, ChevronRight, FolderOpen, Dna, Home, History, Layers, FileText, Sparkles, ScrollText, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const globalNav = [
  { to: "/", icon: LayoutDashboard, label: "Projetos" },
  { to: "/library", icon: Library, label: "Biblioteca Global" },
  { to: "/models", icon: FileStack, label: "Modelos" },
  { to: "/logs", icon: ScrollText, label: "Logs" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

const projectNav = [
  { to: "home", icon: Home, label: "Visão Geral" },
  { to: "dna", icon: Dna, label: "DNA" },
  { to: "references", icon: Eye, label: "Referências" },
  { to: "production", icon: Zap, label: "Produção" },
  { to: "library", icon: FolderOpen, label: "Biblioteca" },
  { to: "planning", icon: Calendar, label: "Planejamento" },
  { to: "sprints", icon: Layers, label: "Sprints" },
  { to: "pages", icon: FileText, label: "Páginas" },
  { to: "models", icon: Sparkles, label: "Modelos" },
  { to: "history", icon: History, label: "Histórico" },
];

export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const isInProject = location.pathname.startsWith("/project/");

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300",
      "bg-sidebar border-r border-border",
      collapsed ? "w-[60px]" : "w-56"
    )}>
      {/* Brand header */}
      <div className="flex h-14 items-center justify-between px-3">
        <div className={cn("flex items-center gap-2.5 transition-all", collapsed && "justify-center w-full")}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-cos-purple flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
            <span className="text-xs font-bold text-primary-foreground font-mono-brand">C</span>
          </div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-baseline gap-1.5">
              <span className="font-mono-brand text-sm font-bold tracking-wider text-gradient-cyan">COS</span>
              <span className="text-[8px] font-mono-brand text-muted-foreground/50 tracking-widest">v2</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Toggle button — elegant pill at sidebar edge */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[22px] z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-card/80 backdrop-blur-sm text-muted-foreground/60 hover:text-foreground hover:bg-card hover:border-primary/30 transition-all shadow-sm"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {isInProject && (
          <>
            {!collapsed && (
              <div className="mb-2 px-3">
                <span className="text-[9px] font-mono-brand uppercase tracking-[0.2em] text-muted-foreground/60">Projeto</span>
              </div>
            )}
            {projectNav.map((item) => {
              const projectBase = location.pathname.split("/").slice(0, 3).join("/");
              const to = `${projectBase}/${item.to}`;
              return (
                <NavLink
                  key={item.to}
                  to={to}
                  className={({ isActive }) => cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-all duration-200 relative group",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-sidebar-foreground/80 hover:bg-card/40 hover:text-foreground",
                    collapsed && "justify-center px-0"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full bg-primary"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                        />
                      )}
                      <item.icon className={cn("h-[15px] w-[15px] shrink-0", isActive && "drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </>
                  )}
                </NavLink>
              );
            })}
            <div className="my-3 mx-3 border-t border-border/10" />
            {!collapsed && (
              <div className="mb-2 px-3">
                <span className="text-[9px] font-mono-brand uppercase tracking-[0.2em] text-muted-foreground/60">Global</span>
              </div>
            )}
          </>
        )}
        {globalNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-all duration-200 relative group",
              isActive && !isInProject
                ? "bg-primary/10 text-primary font-medium"
                : "text-sidebar-foreground/80 hover:bg-card/40 hover:text-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && !isInProject && (
                  <motion.div
                    layoutId="sidebar-active-global"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full bg-primary"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                  />
                )}
                <item.icon className={cn("h-[15px] w-[15px] shrink-0", isActive && !isInProject && "drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-border/10">
          <p className="text-[8px] text-muted-foreground/40 font-mono-brand text-center tracking-[0.3em] uppercase">Creative OS v2</p>
        </div>
      )}
    </aside>
  );
}
