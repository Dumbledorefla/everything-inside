import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, FileCheck, Star, ArrowRight, Plus, Upload, TrendingUp } from "lucide-react";

const stats = [
  { label: "Rascunhos", value: 24, icon: Zap, color: "text-cos-warning" },
  { label: "Aprovados", value: 8, icon: FileCheck, color: "text-cos-cyan" },
  { label: "Ativos Oficiais", value: 5, icon: Star, color: "text-cos-success" },
];

const recentAssets = [
  { id: 1, type: "Banner", status: "Rascunho", title: "Banner Black Friday — Variação A", time: "2h atrás" },
  { id: 2, type: "Post", status: "Aprovado", title: "Post Instagram — Lançamento", time: "5h atrás" },
  { id: 3, type: "Ad Copy", status: "Rascunho", title: "Copy Facebook Ads — Topo de Funil", time: "1d atrás" },
  { id: 4, type: "Story", status: "Oficial", title: "Story Countdown — 3 dias", time: "2d atrás" },
];

const statusColors: Record<string, string> = {
  Rascunho: "bg-cos-warning/10 text-cos-warning",
  Aprovado: "bg-cos-cyan/10 text-cos-cyan",
  Oficial: "bg-cos-success/10 text-cos-success",
};

export default function ProjectHome() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lançamento Expert Pro</h1>
          <p className="text-sm text-muted-foreground mt-1">Infoprodutos / Marketing Digital</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <Upload className="h-3.5 w-3.5" />
            Importar Referência
          </button>
          <button
            onClick={() => navigate(`/project/${projectId}/production`)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors glow-cyan"
          >
            <Zap className="h-3.5 w-3.5" />
            Gerar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-lg border border-border bg-card p-5"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-secondary p-2">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-3xl font-bold font-mono">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent assets */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Últimos Ativos</h2>
          <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
            Ver todos <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="divide-y divide-border">
          {recentAssets.map((asset, i) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {asset.type}
                </span>
                <span className="text-sm">{asset.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${statusColors[asset.status]}`}>
                  {asset.status}
                </span>
                <span className="text-[10px] text-muted-foreground">{asset.time}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
