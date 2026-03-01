import { useState } from "react";
import { motion } from "framer-motion";
import { Grid3X3, List, Search, Filter, Image, Star, Archive, MoreHorizontal } from "lucide-react";

const folders = [
  { name: "Ativos Oficiais", count: 5, icon: Star },
  { name: "Exploração", count: 24, icon: Grid3X3 },
  { name: "Sprints", count: 3, icon: Archive },
];

const mockAssets = [
  { id: 1, type: "Banner", title: "Banner BF — Variação A", status: "Rascunho", profile: "Padrão", provider: "Gemini Pro", date: "28/02" },
  { id: 2, type: "Post", title: "Post IG — Lançamento v2", status: "Aprovado", profile: "Qualidade", provider: "OpenAI", date: "27/02" },
  { id: 3, type: "Ad", title: "Facebook Ad — Topo Funil", status: "Rascunho", profile: "Economia", provider: "Gemini Flash", date: "27/02" },
  { id: 4, type: "Story", title: "Story Countdown 3d", status: "Oficial", profile: "Padrão", provider: "Gemini Pro", date: "26/02" },
  { id: 5, type: "Banner", title: "Banner Hero LP", status: "Aprovado", profile: "Qualidade", provider: "OpenAI", date: "25/02" },
  { id: 6, type: "Post", title: "Carrossel 5 slides", status: "Rascunho", profile: "Economia", provider: "Gemini Flash", date: "25/02" },
];

const statusColors: Record<string, string> = {
  Rascunho: "bg-cos-warning/10 text-cos-warning",
  Aprovado: "bg-cos-cyan/10 text-cos-cyan",
  Oficial: "bg-cos-success/10 text-cos-success",
};

const profileColors: Record<string, string> = {
  Economia: "text-cos-warning",
  Padrão: "text-cos-cyan",
  Qualidade: "text-cos-purple",
};

export default function ProjectLibrary() {
  const [view, setView] = useState<"grid" | "list">("list");
  const [search, setSearch] = useState("");

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Biblioteca</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("grid")} className={`rounded-md p-1.5 transition-colors ${view === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} className={`rounded-md p-1.5 transition-colors ${view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Folders */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {folders.map((f) => (
          <button key={f.name} className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors">
            <f.icon className="h-5 w-5 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">{f.name}</p>
            <p className="text-xs text-muted-foreground">{f.count} itens</p>
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ativos..."
            className="w-full rounded-md border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </button>
      </div>

      {/* Asset list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_100px_100px_80px_40px] gap-4 border-b border-border px-5 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span>Ativo</span><span>Status</span><span>Perfil</span><span>Provedor</span><span>Data</span><span />
        </div>
        <div className="divide-y divide-border">
          {mockAssets.map((asset, i) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="grid grid-cols-[1fr_100px_100px_100px_80px_40px] gap-4 items-center px-5 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{asset.type}</span>
                <span className="text-sm truncate">{asset.title}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono text-center ${statusColors[asset.status]}`}>{asset.status}</span>
              <span className={`text-[11px] font-mono ${profileColors[asset.profile]}`}>{asset.profile}</span>
              <span className="text-[11px] text-muted-foreground truncate">{asset.provider}</span>
              <span className="text-[11px] text-muted-foreground">{asset.date}</span>
              <button className="rounded-md p-1 text-muted-foreground hover:bg-secondary transition-colors">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
