import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FolderOpen,
  Home,
  Library,
  Settings,
  FileText,
  Cpu,
  Palette,
  Layers,
  Zap,
} from "lucide-react";

const globalRoutes = [
  { label: "Dashboard", path: "/", icon: Home },
  { label: "Biblioteca Global", path: "/library", icon: Library },
  { label: "Modelos", path: "/models", icon: Cpu },
  { label: "Configurações", path: "/settings", icon: Settings },
  { label: "Logs", path: "/logs", icon: FileText },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-cmd"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, niche")
        .order("updated_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user && open,
    staleTime: 30000,
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar projetos, páginas, ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          {globalRoutes.map((r) => (
            <CommandItem key={r.path} onSelect={() => go(r.path)}>
              <r.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {r.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projetos">
              {projects.map((p) => (
                <CommandItem key={p.id} onSelect={() => go(`/project/${p.id}/home`)}>
                  <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{p.name}</span>
                  {p.niche && (
                    <span className="text-[10px] text-muted-foreground font-mono">{p.niche}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Ações Rápidas">
          <CommandItem onSelect={() => go("/")}>
            <Zap className="mr-2 h-4 w-4 text-cos-warning" />
            Criar Novo Projeto
          </CommandItem>
          <CommandItem onSelect={() => go("/library")}>
            <Palette className="mr-2 h-4 w-4 text-cos-purple" />
            Explorar Templates
          </CommandItem>
          <CommandItem onSelect={() => go("/models")}>
            <Layers className="mr-2 h-4 w-4 text-cos-cyan" />
            Gerenciar Modelos
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
