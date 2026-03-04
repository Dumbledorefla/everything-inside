import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Zap, Calendar, Library, FileStack, Settings,
  ChevronLeft, ChevronRight, ChevronDown, FolderOpen, Dna, Home, History, Layers, FileText, Sparkles, ScrollText, Eye, Target, User, Video, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";

const globalNav = [
  { to: "/", icon: LayoutDashboard, label: "Projetos" },
  { to: "/library", icon: Library, label: "Biblioteca Global" },
  { to: "/models", icon: FileStack, label: "Modelos" },
  { to: "/logs", icon: ScrollText, label: "Logs" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

const projectNavGroups = [
  {
    id: "criacao",
    title: "Criação",
    icon: Sparkles,
    items: [
      { to: "production", icon: Zap, label: "Produção" },
      { to: "pro-studio", icon: Flame, label: "Studio Pro" },
      { to: "characters", icon: User, label: "Personagens" },
      { to: "ad-factory", icon: Target, label: "Ad Factory" },
      { to: "videos", icon: Video, label: "Vídeos" },
    ],
  },
  {
    id: "gestao",
    title: "Gestão",
    icon: FolderOpen,
    items: [
      { to: "library", icon: FolderOpen, label: "Biblioteca" },
      { to: "sprints", icon: Layers, label: "Sprints" },
      { to: "pages", icon: FileText, label: "Páginas" },
      { to: "history", icon: History, label: "Histórico" },
    ],
  },
  {
    id: "estrategia",
    title: "Estratégia",
    icon: Dna,
    items: [
      { to: "dna", icon: Dna, label: "DNA" },
      { to: "references", icon: Eye, label: "Referências" },
      { to: "planning", icon: Calendar, label: "Planejamento" },
      { to: "models", icon: Sparkles, label: "Modelos" },
    ],
  },
];

function useGroupState() {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("cos-sidebar-groups");
      return saved ? JSON.parse(saved) : { criacao: true, gestao: true, estrategia: true };
    } catch {
      return { criacao: true, gestao: true, estrategia: true };
    }
  });

  useEffect(() => {
    localStorage.setItem("cos-sidebar-groups", JSON.stringify(openGroups));
  }, [openGroups]);

  const toggle = useCallback((id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return { openGroups, toggle };
}

function CollapsibleNavGroup({
  group,
  collapsed,
  projectBase,
  isOpen,
  onToggle,
}: {
  group: typeof projectNavGroups[0];
  collapsed: boolean;
  projectBase: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const GroupIcon = group.icon;

  if (collapsed) {
    return (
      <>
        <div className="my-2 mx-3">
          <div className="h-px bg-border/60" />
        </div>
        {group.items.map((item) => {
          const to = `${projectBase}/${item.to}`;
          return (
            <NavLink
              key={item.to}
              to={to}
              className={({ isActive }) => cn(
                "flex items-center justify-center rounded-xl px-0 py-2 text-[13px] transition-all duration-200 relative group",
                isActive
                  ? "bg-primary/15 text-primary font-semibold shadow-inner shadow-primary/10"
                  : "text-sidebar-foreground hover:bg-accent/50",
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                    />
                  )}
                  <item.icon className={cn("h-[15px] w-[15px] shrink-0", isActive && "drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]")} />
                </>
              )}
            </NavLink>
          );
        })}
      </>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-mono-brand font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
      >
        <GroupIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left">{group.title}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !isOpen && "-rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 mt-0.5">
              {group.items.map((item) => {
                const to = `${projectBase}/${item.to}`;
                return (
                  <NavLink
                    key={item.to}
                    to={to}
                    className={({ isActive }) => cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-all duration-200 relative group",
                      isActive
                        ? "bg-primary/15 text-primary font-semibold shadow-inner shadow-primary/10"
                        : "text-sidebar-foreground hover:bg-accent/50",
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                            transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                          />
                        )}
                        <item.icon className={cn("h-[15px] w-[15px] shrink-0", isActive && "drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]")} />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const isInProject = location.pathname.startsWith("/project/");
  const { openGroups, toggle } = useGroupState();

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300",
      "bg-sidebar border-r border-sidebar-border",
      collapsed ? "w-[60px]" : "w-56"
    )}>
      {/* Brand header */}
      <div className="flex h-14 items-center justify-between px-3">
        <div className={cn("flex items-center gap-2.5 transition-all", collapsed && "justify-center w-full")}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shrink-0">
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

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[22px] z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shadow-sm"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {isInProject && (
          <>
            {/* Visão Geral (always visible) */}
            {(() => {
              const projectBase = location.pathname.split("/").slice(0, 3).join("/");
              const homeTo = `${projectBase}/home`;
              return (
                <>
                  <NavLink
                    to={homeTo}
                    className={({ isActive }) => cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-all duration-200 relative group",
                      isActive
                        ? "bg-primary/15 text-primary font-semibold shadow-inner shadow-primary/10"
                        : "text-sidebar-foreground hover:bg-accent/50",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                            transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                          />
                        )}
                        <Home className={cn("h-[15px] w-[15px] shrink-0", isActive && "drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]")} />
                        {!collapsed && <span className="truncate">Visão Geral</span>}
                      </>
                    )}
                  </NavLink>

                  {/* Collapsible groups */}
                  <div className="mt-2 space-y-1">
                    {projectNavGroups.map((group) => (
                      <CollapsibleNavGroup
                        key={group.id}
                        group={group}
                        collapsed={collapsed}
                        projectBase={projectBase}
                        isOpen={openGroups[group.id] ?? true}
                        onToggle={() => toggle(group.id)}
                      />
                    ))}
                  </div>
                </>
              );
            })()}

            <div className="my-4 mx-3">
              <div className="h-px bg-border" />
            </div>
            {!collapsed && (
              <div className="mb-3 px-3">
                <span className="text-[11px] font-mono-brand font-semibold uppercase tracking-[0.15em] text-foreground/70">
                  Global
                </span>
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
                ? "bg-primary/15 text-primary font-semibold shadow-inner shadow-primary/10"
                : "text-sidebar-foreground hover:bg-accent/50",
              collapsed && "justify-center px-0"
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && !isInProject && (
                  <motion.div
                    layoutId="sidebar-active-global"
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
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
        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-[8px] text-muted-foreground/40 font-mono-brand text-center tracking-[0.3em] uppercase">Creative OS v2</p>
        </div>
      )}
    </aside>
  );
}
