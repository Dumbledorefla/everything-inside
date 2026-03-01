import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, FileCheck, Star, ArrowRight, Upload, Bot, Loader2 } from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statusColors: Record<string, string> = {
  draft: "bg-cos-warning/10 text-cos-warning",
  review: "bg-cos-purple/10 text-cos-purple",
  approved: "bg-cos-cyan/10 text-cos-cyan",
  official: "bg-cos-success/10 text-cos-success",
  archived: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  review: "Revisão",
  approved: "Aprovado",
  official: "Oficial",
  archived: "Arquivado",
};

export default function ProjectHome() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { sendMessage, openDock } = useAssistant();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: stats } = useQuery({
    queryKey: ["project-stats", projectId],
    queryFn: async () => {
      const { data: assets } = await supabase.from("assets").select("status").eq("project_id", projectId!);
      const drafts = assets?.filter((a) => a.status === "draft").length || 0;
      const approved = assets?.filter((a) => a.status === "approved").length || 0;
      const official = assets?.filter((a) => a.status === "official").length || 0;
      return [
        { label: "Rascunhos", value: drafts, icon: Zap, color: "text-cos-warning" },
        { label: "Aprovados", value: approved, icon: FileCheck, color: "text-cos-cyan" },
        { label: "Ativos Oficiais", value: official, icon: Star, color: "text-cos-success" },
      ];
    },
    enabled: !!projectId,
  });

  const { data: recentAssets } = useQuery({
    queryKey: ["recent-assets", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, output, status, created_at, preset")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
    enabled: !!projectId,
  });

  const quickChips = [
    { label: "Gerar 5 criativos topo de funil", msg: "Gere 5 criativos de topo de funil para o projeto atual" },
    { label: "Planejar 7 dias", msg: "Crie um plano de conteúdo para os próximos 7 dias" },
    { label: "Sprint de ads 4:5", msg: "Crie um sprint de ads com formato 4:5 para Instagram" },
  ];

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m atrás`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h atrás`;
    return `${Math.floor(hrs / 24)}d atrás`;
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project?.name || "Carregando..."}</h1>
          <p className="text-sm text-muted-foreground mt-1">{project?.niche || ""}</p>
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

      <div className="grid grid-cols-3 gap-4 mb-8">
        {(stats || []).map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-secondary p-2"><s.icon className={`h-5 w-5 ${s.color}`} /></div>
              <div>
                <p className="text-3xl font-bold font-mono">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Últimos Ativos</h2>
          <button onClick={() => navigate(`/project/${projectId}/library`)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
            Ver todos <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="divide-y divide-border">
          {(!recentAssets || recentAssets.length === 0) && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum ativo gerado ainda.</div>
          )}
          {recentAssets?.map((asset, i) => (
            <motion.div key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{asset.output}</span>
                <span className="text-sm truncate">{asset.title || "Sem título"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${statusColors[asset.status] || ""}`}>{statusLabels[asset.status] || asset.status}</span>
                <span className="text-[10px] text-muted-foreground">{formatTime(asset.created_at)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Atalhos do Assistente</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickChips.map((chip) => (
            <button key={chip.label} onClick={() => { openDock(); sendMessage(chip.msg); }} className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
