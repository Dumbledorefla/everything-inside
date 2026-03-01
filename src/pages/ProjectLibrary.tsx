import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Grid3X3, List, Search, Filter, Image, MoreHorizontal, Loader2 } from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statusColors: Record<string, string> = {
  draft: "bg-cos-warning/10 text-cos-warning",
  review: "bg-cos-purple/10 text-cos-purple",
  approved: "bg-primary/10 text-primary",
  official: "bg-cos-success/10 text-cos-success",
  archived: "bg-muted text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho", review: "Revisão", approved: "Aprovado", official: "Oficial", archived: "Arquivado", error: "Erro",
};

const profileLabels: Record<string, string> = { economy: "Economia", standard: "Padrão", quality: "Qualidade" };
const profileColors: Record<string, string> = { economy: "text-cos-warning", standard: "text-primary", quality: "text-cos-purple" };

export default function ProjectLibrary() {
  const { projectId } = useParams();
  const [view, setView] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { selectAsset, selectedAsset } = useAssistant();

  const { data: folders } = useQuery({
    queryKey: ["library-folders", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("library_folders").select("*").eq("project_id", projectId!);
      return data || [];
    },
    enabled: !!projectId,
  });

  const { data: assets, isLoading } = useQuery({
    queryKey: ["project-assets", projectId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("assets")
        .select("*, asset_versions(headline, body, cta, image_url)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const { data } = await q.limit(100);
      return data || [];
    },
    enabled: !!projectId,
  });

  const filtered = assets?.filter((a) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (a.title || "").toLowerCase().includes(s) || (a.asset_versions?.[0]?.headline || "").toLowerCase().includes(s);
  }) || [];

  const folderCounts = (name: string) => {
    if (!assets) return 0;
    const map: Record<string, string> = { "Ativos Oficiais": "official", "Exploração": "draft", "Arquivados": "archived" };
    const status = map[name];
    if (status) return assets.filter((a) => a.status === status).length;
    return 0;
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Biblioteca</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("grid")} className={`rounded-md p-1.5 transition-colors ${view === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}><Grid3X3 className="h-4 w-4" /></button>
          <button onClick={() => setView("list")} className={`rounded-md p-1.5 transition-colors ${view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}><List className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Folders */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(folders || []).slice(0, 6).map((f) => (
          <button key={f.id} className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors">
            <p className="text-sm font-medium">{f.name}</p>
            <p className="text-xs text-muted-foreground">{folderCounts(f.name)} itens</p>
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ativos..." className="w-full rounded-md border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none">
          <option value="all">Todos</option>
          <option value="draft">Rascunho</option>
          <option value="approved">Aprovado</option>
          <option value="official">Oficial</option>
          <option value="archived">Arquivado</option>
        </select>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Image className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum ativo encontrado</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_90px_90px_120px_80px_40px] gap-4 border-b border-border px-5 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>Ativo</span><span>Status</span><span>Perfil</span><span>Provedor</span><span>Data</span><span />
          </div>
          <div className="divide-y divide-border">
            {filtered.map((asset, i) => (
              <motion.div key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                onClick={() => selectAsset({ id: asset.id, title: asset.title || asset.asset_versions?.[0]?.headline || "Sem título", type: asset.output, status: asset.status, profile: profileLabels[asset.profile_used || "standard"] || "Padrão", provider: asset.provider_used || "Auto" })}
                className={`grid grid-cols-[1fr_90px_90px_120px_80px_40px] gap-4 items-center px-5 py-3 hover:bg-secondary/30 transition-colors cursor-pointer ${selectedAsset?.id === asset.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{asset.output}</span>
                  <span className="text-sm truncate">{asset.title || asset.asset_versions?.[0]?.headline || "Sem título"}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono text-center ${statusColors[asset.status]}`}>{statusLabels[asset.status]}</span>
                <span className={`text-[11px] font-mono ${profileColors[asset.profile_used || "standard"]}`}>{profileLabels[asset.profile_used || "standard"]}</span>
                <span className="text-[11px] text-muted-foreground truncate">{asset.provider_used || "—"}</span>
                <span className="text-[11px] text-muted-foreground">{new Date(asset.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                <button className="rounded-md p-1 text-muted-foreground hover:bg-secondary transition-colors"><MoreHorizontal className="h-3.5 w-3.5" /></button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
