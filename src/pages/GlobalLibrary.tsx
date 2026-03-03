import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Library, Loader2, RefreshCw, Search, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  review: "Revisão",
  approved: "Aprovado",
  official: "Oficial",
  archived: "Arquivado",
  error: "Erro",
};

const pickLatestVersion = (asset: any) => {
  const versions = asset.asset_versions || [];
  if (versions.length <= 1) return versions[0] || null;
  return [...versions].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )[0] || null;
};

export default function GlobalLibrary() {
  const [search, setSearch] = useState("");

  const { data: assets = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["global-library-assets"],
    queryFn: async () => {
      const { data: baseAssets, error: assetsError } = await supabase
        .from("assets")
        .select("id, title, status, output, created_at, projects(name)")
        .order("created_at", { ascending: false })
        .limit(24);

      if (assetsError) throw assetsError;

      const assetIds = (baseAssets || []).map((asset) => asset.id);
      if (assetIds.length === 0) return [];

      const { data: versions, error: versionsError } = await supabase
        .from("asset_versions")
        .select("asset_id, created_at, headline, image_url")
        .in("asset_id", assetIds);

      if (versionsError) throw versionsError;

      const latestByAsset = new Map<string, any>();
      for (const version of versions || []) {
        const current = latestByAsset.get(version.asset_id);
        if (!current || new Date(version.created_at).getTime() > new Date(current.created_at).getTime()) {
          latestByAsset.set(version.asset_id, version);
        }
      }

      return (baseAssets || []).map((asset) => ({
        ...asset,
        asset_versions: latestByAsset.get(asset.id) ? [latestByAsset.get(asset.id)] : [],
      }));
    },
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return assets;

    return assets.filter((asset) => {
      const latest = pickLatestVersion(asset);
      const projectName = Array.isArray(asset.projects) ? asset.projects[0]?.name : asset.projects?.name;
      return [asset.title, latest?.headline, projectName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [assets, search]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight mb-2">Biblioteca Global</h1>
          <p className="text-sm text-muted-foreground">Últimos ativos gerados em todos os projetos</p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/60 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ativos em todos os projetos..."
          className="w-full rounded-md border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        />
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Carregando ativos recentes...</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center space-y-3">
          <Library className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Falha ao carregar a biblioteca: {(error as Error)?.message || "erro desconhecido"}</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary/70 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Tentar novamente
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Library className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum ativo encontrado para esse filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((asset) => {
            const latest = pickLatestVersion(asset);
            const projectName = Array.isArray(asset.projects) ? asset.projects[0]?.name : asset.projects?.name;

            return (
              <article key={asset.id} className="rounded-xl border border-border bg-card/70 overflow-hidden">
                <div className="aspect-square bg-secondary/30 flex items-center justify-center">
                  {latest?.image_url ? (
                    <img
                      src={latest.image_url}
                      alt={latest.headline || asset.title || "Ativo gerado"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="p-3 space-y-1.5">
                  <p className="text-sm font-medium line-clamp-2">{latest?.headline || asset.title || "Sem título"}</p>
                  <p className="text-xs text-muted-foreground truncate">{projectName || "Projeto"}</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{statusLabels[asset.status] || asset.status}</span>
                    <span>{new Date(asset.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

