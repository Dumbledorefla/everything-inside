import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, FolderOpen, Trash2, Zap, Star,
  ArrowRight, TrendingUp, Clock,
  Rocket, Globe2, Activity, Orbit
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CreateProjectWizard from "@/components/CreateProjectWizard";
import { getNicheClass } from "@/lib/nicheAccent";
import { cn } from "@/lib/utils";

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
        .limit(8);
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
    { label: "Projetos Ativos", value: projects.length, icon: FolderOpen, gradient: "from-primary/15 to-primary/5" },
    { label: "Em Rascunho", value: stats?.drafts ?? 0, icon: Zap, gradient: "from-cos-warning/15 to-cos-warning/5" },
    { label: "Oficiais", value: stats?.official ?? 0, icon: Star, gradient: "from-cos-success/15 to-cos-success/5" },
  ];

  const statusDotColor = (s: string) =>
    s === "official" ? "bg-cos-success" :
    s === "approved" ? "bg-primary" :
    s === "draft" ? "bg-cos-warning" :
    "bg-muted-foreground";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Hero header */}
      <div className="mb-8 flex items-end justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="rounded-xl bg-gradient-to-br from-primary/20 to-cos-purple/10 p-2.5 shadow-lg shadow-primary/10">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Mission Control</h1>
              <p className="text-xs text-muted-foreground/70 font-mono tracking-wide">Centro de comando criativo</p>
            </div>
          </div>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setWizardOpen(true)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 rounded-xl bg-primary/20 border border-primary/30 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/30 transition-all"
        >
          <Plus className="h-4 w-4" />
          Novo Projeto
        </motion.button>
      </div>

      {/* ═══ Bento Grid — Stats ═══ */}
      <div className="grid grid-cols-12 gap-3 mb-6">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="col-span-12 sm:col-span-4 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-5 hover:bg-card/60 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className={cn("rounded-xl bg-gradient-to-br p-3 transition-transform group-hover:scale-110 group-hover:shadow-lg", s.gradient)}>
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold font-mono tracking-tighter">{s.value}</p>
                <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wider">{s.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══ Main Bento: Projects (8 cols) + Activity (4 cols) ═══ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Projects — 8 cols */}
        <div className="col-span-12 lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-muted-foreground/60" />
              <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">Projetos</h2>
            </div>
            <span className="text-[10px] text-muted-foreground/50 font-mono px-2 py-0.5 rounded-full bg-card/40 border border-border/20">{projects.length} total</span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/20 bg-card/30 p-6 space-y-3">
                  <div className="h-4 w-3/4 rounded-lg skeleton-space" />
                  <div className="h-3 w-1/2 rounded-lg skeleton-space" />
                  <div className="h-3 w-1/3 rounded-lg skeleton-space" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-dashed border-border/30 bg-card/20 backdrop-blur-sm p-16 text-center relative overflow-hidden"
            >
              {/* Floating astronaut */}
              <div className="mx-auto mb-6 relative">
                <motion.div
                  animate={{ y: [0, -12, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/10 to-cos-purple/10 flex items-center justify-center border border-primary/10"
                >
                  <Orbit className="h-12 w-12 text-primary/40" />
                </motion.div>
                {/* Orbiting dots */}
                {[0, 1, 2].map((j) => (
                  <motion.div
                    key={j}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8 + j * 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0"
                    style={{ transformOrigin: "center" }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-primary/40 absolute"
                      style={{ top: `${10 + j * 5}%`, left: "50%" }}
                    />
                  </motion.div>
                ))}
              </div>
              <h3 className="text-lg font-semibold mb-2">Pronto para a decolagem?</h3>
              <p className="text-sm text-muted-foreground/70 mb-6 max-w-md mx-auto">
                Crie seu primeiro projeto e deixe a IA cuidar do resto — do DNA criativo à produção em escala.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary/20 border border-primary/30 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/30 transition-all"
              >
                <Plus className="h-4 w-4" />
                Criar Primeiro Projeto
              </motion.button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatePresence>
                {projects.map((project, i) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/project/${project.id}/home`)}
                    whileHover={{ y: -2 }}
                    className={cn(
                      "group cursor-pointer rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm p-5 transition-all duration-300",
                      "hover:border-primary/20 hover:bg-card/50",
                      getNicheClass(project.niche)
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate font-mono">
                          {project.niche || "sem nicho"}
                        </p>
                      </div>
                      <span className="shrink-0 ml-2 rounded-full bg-cos-success/10 text-cos-success px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider border border-cos-success/15">
                        ativo
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/60 line-clamp-1 mb-4">
                      {project.product || project.description || "—"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/50 font-mono">
                        {new Date(project.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Excluir projeto?")) deleteMutation.mutate(project.id);
                          }}
                          className="rounded-lg p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <div className="rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-all">
                          <ArrowRight className="h-3.5 w-3.5 text-primary" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Activity Feed — 4 cols */}
        <div className="col-span-12 lg:col-span-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-muted-foreground/60" />
            <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">Atividade Ao Vivo</h2>
          </div>

          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
            {!stats?.recent?.length ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-card/50 border border-border/20 flex items-center justify-center mb-3">
                  <Clock className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground/50">Nenhuma atividade ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {stats.recent.map((asset: any, i: number) => (
                  <motion.button
                    key={asset.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/project/${asset.project_id}/library`)}
                    className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-card/40 transition-colors group"
                  >
                    <div className="relative">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", statusDotColor(asset.status))} />
                      {asset.status === "draft" && (
                        <div className={cn("absolute inset-0 h-2 w-2 rounded-full animate-ping", statusDotColor(asset.status), "opacity-30")} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                        {asset.title || `${asset.output} — ${asset.status}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50 truncate">
                        {(asset as any).projects?.name}
                      </p>
                    </div>
                    <span className="text-[9px] text-muted-foreground/40 font-mono shrink-0">
                      {new Date(asset.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats Widget */}
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary/70" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Resumo</span>
            </div>
            <div className="space-y-3">
              {[
                { label: "Projetos", value: projects.length, color: "bg-primary" },
                { label: "Rascunhos", value: stats?.drafts ?? 0, color: "bg-cos-warning" },
                { label: "Oficiais", value: stats?.official ?? 0, color: "bg-cos-success" },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/60">{item.label}</span>
                    <span className="text-xs font-mono font-bold">{item.value}</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-card/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(5, (item.value / Math.max(1, (stats?.drafts ?? 0) + (stats?.official ?? 0) + projects.length)) * 100))}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={cn("h-full rounded-full", item.color)}
                    />
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
