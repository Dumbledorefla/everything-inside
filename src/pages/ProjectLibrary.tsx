import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Grid3X3, List, Search, Image, Sparkles, Loader2,
  Check, RefreshCw, Eye, X, Clock, ChevronRight, Layers
} from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AssetDrawer from "@/components/library/AssetDrawer";

const statusColors: Record<string, string> = {
  draft: "bg-cos-warning/10 text-cos-warning border-cos-warning/20",
  review: "bg-cos-purple/10 text-cos-purple border-cos-purple/20",
  approved: "bg-primary/10 text-primary border-primary/20",
  official: "bg-cos-success/10 text-cos-success border-cos-success/20",
  archived: "bg-muted text-muted-foreground border-border",
  error: "bg-destructive/10 text-destructive border-destructive/20",
};
const statusLabels: Record<string, string> = {
  draft: "Rascunho", review: "Revisão", approved: "Aprovado", official: "Oficial", archived: "Arquivado", error: "Erro",
};

const pickLatestVersion = (asset: any) => {
  const versions = asset.asset_versions || [];
  if (versions.length <= 1) return versions[0] || null;
  return [...versions].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )[0] || null;
};

export default function ProjectLibrary() {
  const { projectId } = useParams();
  const [view, setView] = useState<"grid" | "masonry" | "list">("masonry");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [drawerAsset, setDrawerAsset] = useState<any>(null);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const { selectAsset, selectedAsset } = useAssistant();
  const queryClient = useQueryClient();

  const { data: assets, isLoading } = useQuery({
    queryKey: ["project-assets", projectId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("assets")
        .select("*, asset_versions(created_at, headline, body, cta, image_url, generation_metadata)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const { data } = await q.limit(100);
      return data || [];
    },
    enabled: !!projectId,
  });

  const approveMutation = useMutation({
    mutationFn: async (assetId: string) => {
      await supabase.from("assets").update({ status: "approved" }).eq("id", assetId);
    },
    onSuccess: (_, assetId) => {
      setApprovedId(assetId);
      setTimeout(() => setApprovedId(null), 1200);
      queryClient.invalidateQueries({ queryKey: ["project-assets"] });
      toast.success("Ativo aprovado!");
    },
  });

  const filtered = assets?.filter((a) => {
    const version = pickLatestVersion(a);
    if (!search) return true;
    const s = search.toLowerCase();
    return (a.title || "").toLowerCase().includes(s) || (version?.headline || "").toLowerCase().includes(s);
  }) || [];

  const statusFilterOptions = [
    { value: "all", label: "Todos" },
    { value: "draft", label: "Rascunho" },
    { value: "approved", label: "Aprovado" },
    { value: "official", label: "Oficial" },
    { value: "archived", label: "Arquivado" },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 p-2.5">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Biblioteca</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl bg-secondary/50 p-1">
          {[
            { id: "masonry" as const, icon: Grid3X3, label: "Masonry" },
            { id: "list" as const, icon: List, label: "Lista" },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "rounded-lg p-1.5 transition-all",
                view === v.id ? "bg-card text-primary elevation-1" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <v.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="mb-5 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ativos..."
            className="w-full rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-xl bg-card/30 p-1 border border-border/20">
          {statusFilterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
                statusFilter === opt.value
                  ? "bg-card text-primary elevation-1"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="masonry-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="aspect-square skeleton-space" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-3/4 rounded-lg skeleton-space" />
                <div className="h-2.5 w-1/2 rounded-lg skeleton-space" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-dashed border-border/20 bg-card/10 backdrop-blur-sm p-16 text-center relative overflow-hidden"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/10 to-cos-purple/10 flex items-center justify-center mb-4 animate-float">
            <Image className="h-8 w-8 text-primary/50" />
          </div>
          <h3 className="text-base font-semibold mb-1">Espaço vazio, potencial infinito</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Vá para a aba Produção e gere seus primeiros ativos criativos.
          </p>
        </motion.div>
      )}

      {/* ═══ Masonry Grid ═══ */}
      {!isLoading && filtered.length > 0 && view === "masonry" && (
        <div className="masonry-grid">
          <AnimatePresence>
            {filtered.map((asset, i) => {
              const version = pickLatestVersion(asset);
              const hasImage = !!version?.image_url;
              const isApproved = approvedId === asset.id;

              return (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    "group relative rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden transition-all duration-300",
                    "hover:border-primary/20 hover:bg-card/50",
                    selectedAsset?.id === asset.id && "ring-2 ring-primary/50",
                    isApproved && "ring-2 ring-cos-success"
                  )}
                >
                  {/* Image preview with zoom */}
                  {hasImage && (
                    <div className="relative overflow-hidden cursor-pointer" onClick={() => setDrawerAsset(asset)}>
                      <img
                        src={version.image_url!}
                        alt={version.headline || "Asset"}
                        className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Quick menu — floats on hover */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                        <button
                          onClick={(e) => { e.stopPropagation(); approveMutation.mutate(asset.id); }}
                          className="flex items-center gap-1.5 rounded-lg bg-cos-success/90 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-cos-success transition-colors"
                        >
                          <Check className="h-3 w-3" /> Aprovar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toast.info("Regenerando..."); }}
                          className="rounded-lg bg-card/90 p-1.5 backdrop-blur-sm hover:bg-card transition-colors"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-foreground" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDrawerAsset(asset); }}
                          className="rounded-lg bg-card/90 p-1.5 backdrop-blur-sm hover:bg-card transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5 text-foreground" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4 space-y-2" onClick={() => {
                    selectAsset({
                      id: asset.id,
                      title: asset.title || version?.headline || "Sem título",
                      type: asset.output,
                      status: asset.status,
                    });
                    setDrawerAsset(asset);
                  }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{version?.headline || asset.title || "Sem título"}</p>
                      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-mono", statusColors[asset.status])}>
                        {statusLabels[asset.status]}
                      </span>
                    </div>
                    {version?.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{version.body}</p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {asset.provider_used || "auto"} · {asset.output}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    </div>
                  </div>

                  {/* Confetti overlay on approve */}
                  {isApproved && (
                    <motion.div
                      initial={{ opacity: 1, scale: 0.5 }}
                      animate={{ opacity: 0, scale: 1.5 }}
                      transition={{ duration: 0.8 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <div className="text-4xl animate-confetti">✦</div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ═══ List View ═══ */}
      {!isLoading && filtered.length > 0 && view === "list" && (
        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_90px_90px_120px_80px] gap-4 border-b border-border px-5 py-2.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>Ativo</span><span>Status</span><span>Perfil</span><span>Provedor</span><span>Data</span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((asset, i) => {
              const version = pickLatestVersion(asset);
              return (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => setDrawerAsset(asset)}
                  className={cn(
                    "grid grid-cols-[1fr_90px_90px_120px_80px] gap-4 items-center px-5 py-3.5 hover:bg-secondary/20 transition-colors cursor-pointer",
                    selectedAsset?.id === asset.id && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{asset.output}</span>
                    <span className="text-sm truncate">{asset.title || version?.headline || "Sem título"}</span>
                  </div>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-mono text-center", statusColors[asset.status])}>{statusLabels[asset.status]}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">{asset.profile_used || "standard"}</span>
                  <span className="text-[11px] text-muted-foreground truncate">{asset.provider_used || "—"}</span>
                  <span className="text-[11px] text-muted-foreground">{new Date(asset.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Asset Drawer */}
      <AssetDrawer
        asset={drawerAsset}
        onClose={() => setDrawerAsset(null)}
        onApprove={(id) => approveMutation.mutate(id)}
      />
    </div>
  );
}
