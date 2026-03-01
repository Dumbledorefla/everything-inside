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
    { label: "Projetos Ativos", value: projects.length, icon: FolderOpen, color: "text-primary", bg: "bg-primary/8 border-primary/10" },
    { label: "Em Rascunho", value: stats?.drafts ?? 0, icon: Zap, color: "text-cos-warning", bg: "bg-cos-warning/8 border-cos-warning/10" },
    { label: "Oficiais", value: stats?.official ?? 0, icon: Star, color: "text-cos-success", bg: "bg-cos-success/8 border-cos-success/10" },
  ];

  const statusDotColor = (s: string) =>
    s === "official" ? "bg-cos-success" :
    s === "approved" ? "bg-primary" :
    s === "draft" ? "bg-cos-warning" :
    "bg-muted-foreground";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Hero header */}
      <div className="mb-8 flex items-end justify-between">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/8 border border-primary/10 p-2.5">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-mono-brand">Mission Control</h1>
              <p className="text-[11px] text-muted-foreground/70 font-mono-brand tracking-widest uppercase">Centro de comando</p>
            </div>
          </div>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setWizardOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all glow-cyan"
        >
          <Plus className="h-4 w-4" />
          Novo Projeto
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            className={cn(
              "rounded-2xl border p-5 backdrop-blur-sm transition-all hover:scale-[1.01]",
              s.bg
            )}
          >
            <div className="flex items-center gap-3.5">
              <s.icon className={cn("h-5 w-5", s.color)} />
              <div>
                <p className="text-2xl font-bold font-mono-brand tracking-tighter">{s.value}</p>
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-mono-brand">{s.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-5">
        {/* Projects */}
        <div className="col-span-12 lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe2 className="h-3.5 w-3.5 text-muted-foreground/40" />
              <h2 className="text-[10px] font-mono-brand text-muted-foreground/70 uppercase tracking-[0.2em]">Projetos</h2>
            </div>
            <span className="text-[9px] text-muted-foreground/50 font-mono-brand px-2 py-0.5 rounded-full bg-card/20 border border-border/10">
              {projects.length} total
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/10 bg-card/20 p-5 space-y-3">
                  <div className="h-4 w-3/4 rounded-lg skeleton-space" />
                  <div className="h-3 w-1/2 rounded-lg skeleton-space" />
                  <div className="h-3 w-1/3 rounded-lg skeleton-space" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-dashed border-border/20 bg-card/10 backdrop-blur-sm p-14 text-center relative overflow-hidden"
            >
              <div className="mx-auto mb-6 relative">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-20 h-20 mx-auto rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center"
                >
                  <Orbit className="h-10 w-10 text-primary/30" />
                </motion.div>
                {[0, 1, 2].map((j) => (
                  <motion.div
                    key={j}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10 + j * 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0"
                  >
                    <div
                      className="w-1 h-1 rounded-full bg-primary/30 absolute"
                      style={{ top: `${8 + j * 6}%`, left: "50%" }}
                    />
                  </motion.div>
                ))}
              </div>
              <h3 className="text-base font-semibold mb-1.5 font-mono-brand">Pronto para a decolagem?</h3>
              <p className="text-xs text-muted-foreground/60 mb-6 max-w-sm mx-auto leading-relaxed">
                Crie seu primeiro projeto e deixe a IA cuidar do resto.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-cyan"
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
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/project/${project.id}/home`)}
                    whileHover={{ y: -2 }}
                    className={cn(
                      "group cursor-pointer rounded-2xl border border-border/10 bg-card/15 backdrop-blur-sm p-5 transition-all duration-300",
                      "hover:border-primary/15 hover:bg-card/30 hover:shadow-lg hover:shadow-primary/5",
                      getNicheClass(project.niche)
                    )}
                  >
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate font-mono-brand">
                          {project.niche || "sem nicho"}
                        </p>
                      </div>
                      <span className="shrink-0 ml-2 rounded-full bg-cos-success/8 text-cos-success/70 px-2 py-0.5 text-[8px] font-mono-brand uppercase tracking-wider border border-cos-success/10">
                        ativo
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 line-clamp-1 mb-3">
                      {project.product || project.description || "—"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground/50 font-mono-brand">
                        {new Date(project.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Excluir projeto?")) deleteMutation.mutate(project.id);
                          }}
                          className="rounded-lg p-1.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <div className="rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-all">
                          <ArrowRight className="h-3 w-3 text-primary/60" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="col-span-12 lg:col-span-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-3.5 w-3.5 text-muted-foreground/40" />
            <h2 className="text-[10px] font-mono-brand text-muted-foreground/70 uppercase tracking-[0.2em]">Atividade</h2>
          </div>

          <div className="rounded-2xl border border-border/10 bg-card/15 backdrop-blur-sm overflow-hidden">
            {!stats?.recent?.length ? (
              <div className="p-10 text-center">
                <div className="w-10 h-10 mx-auto rounded-full bg-card/30 border border-border/10 flex items-center justify-center mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground/20" />
                </div>
                <p className="text-[11px] text-muted-foreground/50">Nenhuma atividade ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {stats.recent.map((asset: any, i: number) => (
                  <motion.button
                    key={asset.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/project/${asset.project_id}/library`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/20 transition-colors group"
                  >
                    <div className="relative">
                      <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDotColor(asset.status))} />
                      {asset.status === "draft" && (
                        <div className={cn("absolute inset-0 h-1.5 w-1.5 rounded-full animate-ping", statusDotColor(asset.status), "opacity-30")} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate group-hover:text-primary transition-colors">
                        {asset.title || `${asset.output} — ${asset.status}`}
                      </p>
                      <p className="text-[9px] text-muted-foreground/50 truncate">
                        {(asset as any).projects?.name}
                      </p>
                    </div>
                    <span className="text-[8px] text-muted-foreground/50 font-mono-brand shrink-0">
                      {new Date(asset.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Summary Widget */}
          <div className="rounded-2xl border border-border/10 bg-card/15 backdrop-blur-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary/50" />
              <span className="text-[10px] font-mono-brand uppercase tracking-[0.2em] text-muted-foreground/60">Resumo</span>
            </div>
            <div className="space-y-3">
              {[
                { label: "Projetos", value: projects.length, color: "bg-primary" },
                { label: "Rascunhos", value: stats?.drafts ?? 0, color: "bg-cos-warning" },
                { label: "Oficiais", value: stats?.official ?? 0, color: "bg-cos-success" },
              ].map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/60">{item.label}</span>
                    <span className="text-[11px] font-mono-brand font-bold">{item.value}</span>
                  </div>
                  <div className="h-[3px] w-full rounded-full bg-card/30 overflow-hidden">
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
