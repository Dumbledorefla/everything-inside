import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Zap, Calendar, Library, FileStack, Settings,
  ChevronLeft, FolderOpen, Dna, Home, History, Layers, FileText, Sparkles, ScrollText,
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
      "border-r border-border/20 bg-background/70 backdrop-blur-2xl",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Brand header */}
      <div className="flex h-14 items-center justify-between border-b border-border/20 px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-cos-purple flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-[11px] font-bold text-primary-foreground">C</span>
            </div>
            <span className="font-mono text-sm font-bold tracking-wider text-gradient-cyan">COS</span>
            <span className="text-[8px] font-mono text-muted-foreground/40 tracking-widest">v2</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 mx-auto rounded-lg bg-gradient-to-br from-primary to-cos-purple flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-[11px] font-bold text-primary-foreground">C</span>
          </div>
        )}
        <button onClick={onToggle} className={cn(
          "rounded-lg p-1.5 text-muted-foreground hover:bg-card/50 hover:text-foreground transition-colors",
          collapsed && "hidden"
        )}>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {isInProject && (
          <>
            <div className={cn("mb-3 px-2", collapsed && "text-center")}>
              {!collapsed && <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">Projeto</span>}
            </div>
            {projectNav.map((item) => {
              const projectBase = location.pathname.split("/").slice(0, 3).join("/");
              const to = `${projectBase}/${item.to}`;
              return (
                <NavLink
                  key={item.to}
                  to={to}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 relative",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-card/40 hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                        />
                      )}
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </>
                  )}
                </NavLink>
              );
            })}
            <div className="my-4 mx-3 border-t border-border/20" />
            <div className={cn("mb-3 px-2", collapsed && "text-center")}>
              {!collapsed && <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">Global</span>}
            </div>
          </>
        )}
        {globalNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 relative",
              isActive && !isInProject
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-card/40 hover:text-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && !isInProject && (
                  <motion.div
                    layoutId="sidebar-active-global"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom brand mark */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-border/20">
          <p className="text-[9px] text-muted-foreground/30 font-mono text-center tracking-widest uppercase">Creative OS v2</p>
        </div>
      )}
    </aside>
  );
}
