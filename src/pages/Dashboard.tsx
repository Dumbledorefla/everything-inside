import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CreateProjectWizard from "@/components/CreateProjectWizard";
import GlobalContextSearch from "@/components/dashboard/GlobalContextSearch";
import WorkspaceFolderManager from "@/components/dashboard/WorkspaceFolderManager";
import DashboardFilters, { type FilterState } from "@/components/dashboard/DashboardFilters";
import StatsRow from "@/components/dashboard/StatsRow";
import ProjectCard from "@/components/dashboard/ProjectCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ niche: null, stale: false, minAssets: null, status: null });
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ─── Projects with joined data ───
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, sprints(status)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        is_pinned: p.is_pinned ?? false,
        workspace_folder: p.workspace_folder ?? null,
        performance_rating: p.performance_rating ?? null,
        sprint_status: p.sprints?.find((s: any) => s.status === "active") ? "active" : null,
      }));
    },
    enabled: !!user,
  });

  // ─── Asset counts per project ───
  const { data: assetCounts = {} } = useQuery({
    queryKey: ["project-asset-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("project_id, status");
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

  // ─── Global stats ───
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
  });

  // ─── Derived ───
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
    return projects.map((p: any) => ({
      ...p,
      asset_count: assetCounts[p.id]?.total ?? 0,
    }));
  }, [projects, assetCounts]);

  const filtered = useMemo(() => {
    let list = enriched;

    // Folder
    if (selectedFolder) list = list.filter((p: any) => p.workspace_folder === selectedFolder);

    // Niche
    if (filters.niche) list = list.filter((p: any) => p.niche === filters.niche);

    // Stale
    if (filters.stale) {
      const cutoff = Date.now() - 15 * 86400000;
      list = list.filter((p: any) => new Date(p.updated_at).getTime() < cutoff);
    }

    // Min assets
    if (filters.minAssets) list = list.filter((p: any) => (assetCounts[p.id]?.approved ?? 0) >= filters.minAssets!);

    // Status
    if (filters.status === "sprint") list = list.filter((p: any) => p.sprint_status === "active");
    else if (filters.status === "active") list = list.filter((p: any) => !p.sprint_status && Date.now() - new Date(p.updated_at).getTime() < 15 * 86400000);
    else if (filters.status === "review") list = list.filter((p: any) => (assetCounts[p.id]?.total ?? 0) > 0);

    // Sort: pinned first, then by updated_at
    return list.sort((a: any, b: any) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [enriched, selectedFolder, filters, assetCounts]);

  const pinnedCount = projects.filter((p: any) => p.is_pinned).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ─── Header ─── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/8 border border-primary/10 p-2.5">
              <span className="text-primary text-lg">◎</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-mono">Mission Control</h1>
              <p className="text-[11px] text-muted-foreground/60 font-mono tracking-widest uppercase">Centro de comando · {projects.length} projetos</p>
            </div>
          </div>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setWizardOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all shrink-0"
        >
          + Novo Projeto
        </motion.button>
      </div>

      {/* ─── Search ─── */}
      <div className="mb-5">
        <GlobalContextSearch />
      </div>

      {/* ─── Stats ─── */}
      <div className="mb-6">
        <StatsRow
          projectCount={projects.length}
          drafts={stats?.drafts ?? 0}
          official={stats?.official ?? 0}
          pinned={pinnedCount}
        />
      </div>

      {/* ─── Folders + Filters ─── */}
      <div className="mb-4 space-y-2">
        <WorkspaceFolderManager
          folders={folders}
          onSelect={setSelectedFolder}
          selectedFolder={selectedFolder}
        />
        <DashboardFilters
          filters={filters}
          onChange={setFilters}
          availableNiches={niches}
        />
      </div>

      {/* ─── Main Grid ─── */}
      <div className="grid grid-cols-12 gap-5">
        {/* Projects */}
        <div className="col-span-12 lg:col-span-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-[0.2em]">
              {filtered.length} projeto{filtered.length !== 1 ? "s" : ""}
              {selectedFolder && ` em "${selectedFolder}"`}
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/10 bg-card/20 p-5 space-y-3 animate-pulse">
                  <div className="h-4 w-3/4 rounded-lg bg-muted/20" />
                  <div className="h-3 w-1/2 rounded-lg bg-muted/20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-border/20 bg-card/10 p-14 text-center"
            >
              <span className="text-3xl text-muted-foreground/20 block mb-4">◎</span>
              <h3 className="text-base font-semibold mb-1.5 font-mono">
                {projects.length === 0 ? "Pronto para a decolagem?" : "Nenhum projeto corresponde aos filtros"}
              </h3>
              <p className="text-xs text-muted-foreground/50 mb-6">
                {projects.length === 0
                  ? "Crie seu primeiro projeto e deixe a IA cuidar do resto."
                  : "Tente ajustar os filtros ou pastas de trabalho."}
              </p>
              {projects.length === 0 && (
                <button
                  onClick={() => setWizardOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  + Criar Primeiro Projeto
                </button>
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
          <ActivityFeed
            recent={stats?.recent || []}
            projectCount={projects.length}
            drafts={stats?.drafts ?? 0}
            official={stats?.official ?? 0}
          />
        </div>
      </div>

      <CreateProjectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
