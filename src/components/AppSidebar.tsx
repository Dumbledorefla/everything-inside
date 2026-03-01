import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Zap, Calendar, Library, FileStack, Settings,
  ChevronLeft, FolderOpen, Dna, Home, History, Layers, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const globalNav = [
  { to: "/", icon: LayoutDashboard, label: "Projetos" },
  { to: "/library", icon: Library, label: "Biblioteca Global" },
  { to: "/models", icon: FileStack, label: "Modelos" },
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
  { to: "history", icon: History, label: "Histórico" },
];

export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const isInProject = location.pathname.startsWith("/project/");

  return (
    <aside className={cn("fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300", collapsed ? "w-16" : "w-60")}>
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        {!collapsed && <span className="font-mono text-sm font-bold tracking-wider text-gradient-cyan">COS</span>}
        <button onClick={onToggle} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {isInProject && (
          <>
            <div className={cn("mb-2 px-2", collapsed && "text-center")}>
              {!collapsed && <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Projeto</span>}
            </div>
            {projectNav.map((item) => {
              const projectBase = location.pathname.split("/").slice(0, 3).join("/");
              const to = `${projectBase}/${item.to}`;
              return (
                <NavLink key={item.to} to={to} className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground", collapsed && "justify-center px-2")}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
            <div className="my-3 border-t border-border" />
            <div className={cn("mb-2 px-2", collapsed && "text-center")}>
              {!collapsed && <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Global</span>}
            </div>
          </>
        )}
        {globalNav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", isActive && !isInProject ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground", collapsed && "justify-center px-2")}>
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
