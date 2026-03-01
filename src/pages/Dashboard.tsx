import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, FolderOpen, Loader2, Trash2, Zap, Star,
  ArrowRight, Sparkles, TrendingUp, Clock
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CreateProjectWizard from "@/components/CreateProjectWizard";
import { getNicheClass } from "@/lib/nicheAccent";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch global stats
  const { data: stats } = useQuery({
    queryKey: ["global-stats"],
    queryFn: async () => {
      const { count: draftCount } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft");
      const { count: officialCount } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("status", "official");
      const { data: recentAssets } = await supabase
        .from("assets")
        .select("id, title, status, output, created_at, project_id, projects(name, niche)")
        .order("created_at", { ascending: false })
        .limit(5);
      return {
        drafts: draftCount || 0,
        official: officialCount || 0,
        recent: recentAssets || [],
      };
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const statCards = [
    { label: "Projetos Ativos", value: projects.length, icon: FolderOpen, color: "text-primary" },
    { label: "Em Rascunho", value: stats?.drafts ?? 0, icon: Zap, color: "text-cos-warning" },
    { label: "Oficiais", value: stats?.official ?? 0, icon: Star, color: "text-cos-success" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Hero header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mission Control</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Centro de comando dos seus projetos criativos
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all glow-cyan"
        >
          <Plus className="h-4 w-4" />
          Novo Projeto
        </button>
      </div>

      {/* ═══ Bento Grid Stats ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4 elevation-1 hover:elevation-2 transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono tracking-tight">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══ Bento Grid: Projects + Activity Feed ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Projects — 2 cols */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Projetos</h2>
            <span className="text-[10px] text-muted-foreground font-mono">{projects.length} total</span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center"
            >
              <div className="mx-auto mb-4 rounded-2xl bg-primary/10 p-4 w-fit">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-1">O que vamos criar hoje?</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                Crie seu primeiro projeto e deixe a IA cuidar do resto — do DNA criativo à produção em escala.
              </p>
              <button
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all glow-cyan"
              >
                <Plus className="h-4 w-4" />
                Criar Primeiro Projeto
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatePresence>
                {projects.map((project, i) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/project/${project.id}/home`)}
                    className={cn(
                      "group cursor-pointer rounded-xl border border-border bg-card p-5 transition-all",
                      "hover:border-primary/30 hover:elevation-2",
                      getNicheClass(project.niche)
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {project.niche || "Sem nicho definido"}
                        </p>
                      </div>
                      <span className="shrink-0 ml-2 rounded-full bg-cos-success/10 text-cos-success px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider">
                        ativo
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                      {project.product || project.description || "—"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(project.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Excluir projeto?")) deleteMutation.mutate(project.id);
                          }}
                          className="rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Activity Feed — 1 col */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Atividade Recente</h2>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {!stats?.recent?.length ? (
              <div className="p-6 text-center">
                <Clock className="mx-auto h-5 w-5 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma atividade ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.recent.map((asset: any) => (
                  <motion.button
                    key={asset.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => navigate(`/project/${asset.project_id}/library`)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors"
                  >
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        asset.status === "official" ? "bg-cos-success" :
                        asset.status === "approved" ? "bg-primary" :
                        asset.status === "draft" ? "bg-cos-warning" :
                        "bg-muted-foreground"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {asset.title || `${asset.output} — ${asset.status}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {(asset as any).projects?.name}
                      </p>
                    </div>
                    <span className="text-[9px] text-muted-foreground font-mono shrink-0">
                      {new Date(asset.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats Widget */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">Resumo Rápido</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Projetos", value: projects.length },
                { label: "Rascunhos", value: stats?.drafts ?? 0 },
                { label: "Oficiais", value: stats?.official ?? 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-16 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (item.value / Math.max(1, projects.length)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-foreground w-5 text-right">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CreateProjectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
