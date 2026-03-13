import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Zap, Calendar, Library, FileStack, Settings,
  ChevronLeft, ChevronRight, FolderOpen, Dna, Home, History,
  Layers, FileText, Sparkles, ScrollText, Eye, Target, User,
  Video, Flame, ChevronDown, PauseCircle, Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import cosLogo from "@/assets/cos-logo-wordmark.png";
import { Switch } from "@/components/ui/switch";
import { useAIGuard } from "@/hooks/useAIGuard";

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
    label: "Criação",
    icon: Zap,
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
    label: "Gestão",
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
    label: "Estratégia",
    icon: Dna,
    items: [
      { to: "dna", icon: Dna, label: "DNA" },
      { to: "references", icon: Eye, label: "Referências" },
      { to: "planning", icon: Calendar, label: "Planejamento" },
      { to: "models", icon: Sparkles, label: "Modelos" },
    ],
  },
];

function NavItem({ to, icon: Icon, label, collapsed }: { to: string; icon: any; label: string; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-all duration-150 relative group",
        isActive
          ? "bg-primary/15 text-primary font-semibold"
          : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-foreground",
        collapsed && "justify-center px-0 py-2"
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary"
              transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
            />
          )}
          <Icon className={cn(
            "shrink-0 transition-all",
            collapsed ? "h-[17px] w-[17px]" : "h-[14px] w-[14px]",
            isActive ? "text-primary drop-shadow-[0_0_5px_hsl(var(--primary)/0.6)]" : "text-muted-foreground group-hover:text-foreground"
          )} />
          {!collapsed && <span className="truncate leading-none">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

function NavGroup({ group, projectBase, collapsed }: { group: typeof projectNavGroups[0]; projectBase: string; collapsed: boolean }) {
  const storageKey = `sidebar-group-${group.id}`;
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(storageKey) !== "false"; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, String(open)); } catch {}
  }, [open, storageKey]);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-0.5 py-1">
        {group.items.map((item) => (
          <NavItem key={item.to} to={`${projectBase}/${item.to}`} icon={item.icon} label={item.label} collapsed={true} />
        ))}
        <div className="w-5 h-px bg-border/50 my-1" />
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <group.icon className="h-[11px] w-[11px]" />
          <span>{group.label}</span>
        </div>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !open && "-rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden pl-1"
          >
            <div className="flex flex-col gap-0.5 pt-0.5 pb-1">
              {group.items.map((item) => (
                <NavItem key={item.to} to={`${projectBase}/${item.to}`} icon={item.icon} label={item.label} collapsed={false} />
              ))}
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
  const projectBase = location.pathname.split("/").slice(0, 3).join("/");

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300",
      "bg-sidebar border-r border-sidebar-border",
      collapsed ? "w-[56px]" : "w-52"
    )}>
      <div className={cn("flex items-center shrink-0 px-3", collapsed ? "h-14 justify-center" : "h-16 justify-start")}>
        <img src={cosLogo} alt="COS" className={cn("object-contain transition-all", collapsed ? "h-6 w-6" : "h-8")} />
      </div>

      <button
        onClick={onToggle}
        className="absolute -right-3 top-[22px] z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shadow-sm"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {isInProject && (
          <>
            <NavItem to={`${projectBase}/home`} icon={Home} label="Visão Geral" collapsed={collapsed} />
            {!collapsed && <div className="h-px bg-border/50 my-2 mx-1" />}
            {collapsed && <div className="h-px bg-border/40 my-1 mx-2" />}
            {projectNavGroups.map((group) => (
              <NavGroup key={group.id} group={group} projectBase={projectBase} collapsed={collapsed} />
            ))}
            <div className="h-px bg-border/50 my-2 mx-1" />
            {!collapsed && (
              <div className="px-2.5 pb-1">
                <span className="text-[10px] font-mono-brand font-semibold uppercase tracking-[0.15em] text-muted-foreground/40">Global</span>
              </div>
            )}
          </>
        )}
        <div className="flex flex-col gap-0.5">
          {globalNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-all duration-150 relative group",
                isActive && !isInProject
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-foreground",
                collapsed && "justify-center px-0 py-2"
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && !isInProject && (
                    <motion.div
                      layoutId="sidebar-active-global"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                    />
                  )}
                  <item.icon className={cn(
                    "shrink-0 transition-all",
                    collapsed ? "h-[17px] w-[17px]" : "h-[14px] w-[14px]",
                    isActive && !isInProject ? "text-primary drop-shadow-[0_0_5px_hsl(var(--primary)/0.6)]" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  {!collapsed && <span className="truncate leading-none">{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {!collapsed && (
        <div className="px-4 py-2.5 border-t border-sidebar-border shrink-0">
          <p className="text-[8px] text-muted-foreground/30 font-mono-brand text-center tracking-[0.3em] uppercase">Creative OS v2</p>
        </div>
      )}
    </aside>
  );
}