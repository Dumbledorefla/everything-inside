import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CreateProjectWizard from "@/components/CreateProjectWizard";
import ConnectionStatus from "@/components/dashboard/ConnectionStatus";
import GlobalContextSearch from "@/components/dashboard/GlobalContextSearch";
import WorkspaceFolderManager from "@/components/dashboard/WorkspaceFolderManager";
import DashboardFilters, { type FilterState } from "@/components/dashboard/DashboardFilters";
import StatsRow from "@/components/dashboard/StatsRow";
import ProjectCard from "@/components/dashboard/ProjectCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { cn } from "@/lib/utils";

const PROJECTS_CACHE_KEY = "dashboard:projects-cache:v1";

const readProjectsCache = () => {
  if (typeof window === "undefined") return [] as any[];
  try {
    const raw = localStorage.getItem(PROJECTS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as any[]) : [];
  } catch {
    return [] as any[];
  }
};

const withTimeout = <T,>(promise: Promise<T>, ms = 12000): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error("request_timeout")), ms);
    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
export default function Dashboard() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ niche: null, stale: false, minAssets: null, status: null });
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cachedProjects = useMemo(() => readProjectsCache(), []);

  const { data: projects = [], isLoading, isError, isRefetchError, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await withTimeout(
        (async () => {
          return await supabase
            .from("projects")
            .select("*, sprints(status)")
            .order("updated_at", { ascending: false });
        })()
      );

      if (error) throw error;

      const normalized = (data || []).map((p: any) => ({
        ...p,
        is_pinned: p.is_pinned ?? false,
        workspace_folder: p.workspace_folder ?? null,
        performance_rating: p.performance_rating ?? null,
        sprint_status: p.sprints?.find((s: any) => s.status === "active") ? "active" : null,
      }));

      if (normalized.length > 0) {
        try {
          localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(normalized));
        } catch {
          // ignore cache write failures
        }
      }

      return normalized;
    },
    enabled: !!user,
    initialData: cachedProjects,
    retry: 1,
    retryDelay: 1500,
  });

  const { data: assetCounts = {} } = useQuery({
    queryKey: ["project-asset-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("project_id, status");
      const counts: Record<string, { total: number; approved: number }> = {};
      (data || []).forEach((a: any) => {
        if (!counts[a.project_id]) counts[a.project_id] = { total: 0, approved: 0 };
        counts[a.project_id].total++;
        if (a.status === "approved" || a.status === "official") counts[a.project_id].approved++;
      });
      return counts;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["global-stats"],
    queryFn: async () => {
      const { count: draftCount } = await supabase.from("assets").select("*", { count: "exact", head: true }).eq("status", "draft");
      const { count: officialCount } = await supabase.from("assets").select("*", { count: "exact", head: true }).eq("status", "official");
      const { data: recentAssets } = await supabase
        .from("assets")
        .select("id, title, status, output, created_at, project_id, projects(name, niche)")
        .order("created_at", { ascending: false })
        .limit(10);
      return { drafts: draftCount || 0, official: officialCount || 0, recent: recentAssets || [] };
    },
    enabled: !!user,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  const folders = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => { if (p.workspace_folder) set.add(p.workspace_folder); });
    return Array.from(set).sort();
  }, [projects]);

  const niches = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => { if (p.niche) set.add(p.niche); });
    return Array.from(set).sort();
  }, [projects]);

  const enriched = useMemo(() => {
    return projects.map((p: any) => ({ ...p, asset_count: assetCounts[p.id]?.total ?? 0 }));
  }, [projects, assetCounts]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (selectedFolder) list = list.filter((p: any) => p.workspace_folder === selectedFolder);
    if (filters.niche) list = list.filter((p: any) => p.niche === filters.niche);
    if (filters.stale) {
      const cutoff = Date.now() - 15 * 86400000;
      list = list.filter((p: any) => new Date(p.updated_at).getTime() < cutoff);
    }
    if (filters.minAssets) list = list.filter((p: any) => (assetCounts[p.id]?.approved ?? 0) >= filters.minAssets!);
    if (filters.status === "sprint") list = list.filter((p: any) => p.sprint_status === "active");
    else if (filters.status === "active") list = list.filter((p: any) => !p.sprint_status && Date.now() - new Date(p.updated_at).getTime() < 15 * 86400000);
    else if (filters.status === "review") list = list.filter((p: any) => (assetCounts[p.id]?.total ?? 0) > 0);
    return list.sort((a: any, b: any) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [enriched, selectedFolder, filters, assetCounts]);

  const pinnedCount = projects.filter((p: any) => p.is_pinned).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ─── Hero Header ─── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/8 border border-primary/10 p-2.5 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.15)]">
              <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L4 7l8 5 8-5-8-5z" /><path d="M4 12l8 5 8-5" /><path d="M4 17l8 5 8-5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight font-mono-brand">Mission Control</h1>
                <ConnectionStatus />
              </div>
              <p className="text-[11px] text-muted-foreground/70 font-mono-brand tracking-widest uppercase">
                Centro de comando · {projects.length} projetos
              </p>
            </div>
          </div>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setWizardOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_0_24px_-6px_hsl(var(--primary)/0.4)] shrink-0"
        >
          <span className="text-base leading-none">+</span>
          Novo Projeto
        </motion.button>
      </div>

      {/* ─── Search ─── */}
      <div className="mb-6">
        <GlobalContextSearch />
      </div>

      {/* ─── Stats ─── */}
      <div className="mb-8">
        <StatsRow projectCount={projects.length} drafts={stats?.drafts ?? 0} official={stats?.official ?? 0} pinned={pinnedCount} />
      </div>

      {/* ─── Workspace Folders ─── */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-3">
          <svg className="h-3 w-3 text-muted-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-[10px] font-mono-brand text-muted-foreground/50 uppercase tracking-[0.2em]">Workspaces</span>
        </div>
        <WorkspaceFolderManager folders={folders} onSelect={setSelectedFolder} selectedFolder={selectedFolder} />
      </div>

      {/* ─── Filters ─── */}
      <div className="mb-6">
        <DashboardFilters filters={filters} onChange={setFilters} availableNiches={niches} />
      </div>

      {/* ─── Main Grid ─── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Projects */}
        <div className="col-span-12 lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 text-muted-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <h2 className="text-[10px] font-mono-brand text-muted-foreground/70 uppercase tracking-[0.2em]">Projetos</h2>
            </div>
            <span className="text-[9px] text-muted-foreground/40 font-mono-brand px-2.5 py-0.5 rounded-full bg-card/30 border border-border/10">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              {selectedFolder && ` · ${selectedFolder}`}
            </span>
          </div>

          {isLoading && projects.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <div className="h-4 w-3/4 rounded-lg bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded-lg bg-muted animate-pulse" />
                  <div className="h-3 w-1/3 rounded-lg bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : (isError || isRefetchError) && projects.length === 0 ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
              <p className="text-sm text-destructive mb-3">Erro ao carregar projetos</p>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
              >
                Tentar novamente
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-dashed border-border bg-card p-14 text-center relative overflow-hidden"
            >
              <div className="mx-auto mb-6 relative">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-20 h-20 mx-auto rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center"
                >
                  <svg className="h-10 w-10 text-primary/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    <path d="M2 12h20" />
                  </svg>
                </motion.div>
                {[0, 1, 2].map((j) => (
                  <motion.div
                    key={j}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10 + j * 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0"
                  >
                    <div className="w-1 h-1 rounded-full bg-primary/30 absolute" style={{ top: `${8 + j * 6}%`, left: "50%" }} />
                  </motion.div>
                ))}
              </div>
              <h3 className="text-base font-semibold mb-1.5 font-mono-brand">
                {projects.length === 0 ? "Pronto para a decolagem?" : "Nenhum projeto corresponde aos filtros"}
              </h3>
              <p className="text-xs text-muted-foreground/60 mb-6 max-w-sm mx-auto leading-relaxed">
                {projects.length === 0
                  ? "Crie seu primeiro projeto e deixe a IA cuidar do resto."
                  : "Tente ajustar os filtros ou pastas de trabalho."}
              </p>
              {projects.length === 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setWizardOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_0_24px_-6px_hsl(var(--primary)/0.4)]"
                >
                  <span className="text-base leading-none">+</span>
                  Criar Primeiro Projeto
                </motion.button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatePresence>
                {filtered.map((project: any, i: number) => (
                  <ProjectCard key={project.id} project={project} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="col-span-12 lg:col-span-4">
          <ActivityFeed recent={stats?.recent || []} projectCount={projects.length} drafts={stats?.drafts ?? 0} official={stats?.official ?? 0} />
        </div>
      </div>

      <CreateProjectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
