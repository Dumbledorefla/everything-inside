import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, FileCheck, Star, ArrowRight, Upload, Bot, BarChart3, DollarSign, Brain, TrendingUp } from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const statusColors: Record<string, string> = {
  draft: "bg-amber-500/10 text-amber-500",
  review: "bg-violet-500/10 text-violet-500",
  approved: "bg-cyan-500/10 text-cyan-500",
  official: "bg-green-500/10 text-green-500",
  archived: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho", review: "Revisão", approved: "Aprovado", official: "Oficial", archived: "Arquivado",
};

const PIE_COLORS = ["hsl(45, 93%, 47%)", "hsl(171, 77%, 64%)", "hsl(142, 71%, 45%)", "hsl(var(--muted-foreground))"];

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
      return { drafts, approved, official, total: assets?.length || 0 };
    },
    enabled: !!projectId,
  });

  // Ledger data for consumption card
  const { data: ledgerData } = useQuery({
    queryKey: ["project-ledger", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cos_ledger")
        .select("credits_cost, estimated_usd, operation_type, provider_used, created_at")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true })
        .limit(200);
      return data || [];
    },
    enabled: !!projectId,
  });

  // Fallback to credits log if no ledger data
  const { data: creditsData } = useQuery({
    queryKey: ["project-credits-chart", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cos_credits_log")
        .select("amount, created_at, description")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true })
        .limit(100);
      return data || [];
    },
    enabled: !!projectId,
  });

  const { data: pendingInsights } = useQuery({
    queryKey: ["pending-dna-updates-count", projectId],
    queryFn: async () => {
      const { count } = await supabase
        .from("pending_dna_updates")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId!)
        .eq("status", "pending");
      return count || 0;
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

  // Build ledger chart data
  const useLedger = (ledgerData || []).length > 0;
  const rawData = useLedger ? ledgerData! : creditsData || [];

  const byDay = rawData.reduce((acc: Record<string, { credits: number; usd: number }>, log: any) => {
    const day = new Date(log.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    if (!acc[day]) acc[day] = { credits: 0, usd: 0 };
    if (useLedger) {
      acc[day].credits += Math.abs(log.credits_cost || 0);
      acc[day].usd += Math.abs(log.estimated_usd || 0);
    } else {
      acc[day].credits += Math.abs(log.amount || 0);
      acc[day].usd += Math.abs(log.amount || 0) * 0.002;
    }
    return acc;
  }, {});

  const barData = Object.entries(byDay).slice(-14).map(([day, v]) => ({
    day, credits: Number(v.credits.toFixed(1)), estimatedUSD: v.usd.toFixed(3),
  }));

  const totalCredits = rawData.reduce((s: number, l: any) => s + Math.abs(useLedger ? (l.credits_cost || 0) : (l.amount || 0)), 0);
  const totalUSD = useLedger
    ? rawData.reduce((s: number, l: any) => s + Math.abs(l.estimated_usd || 0), 0)
    : totalCredits * 0.002;

  // Operation breakdown
  const byOp = (ledgerData || []).reduce((acc: Record<string, number>, l: any) => {
    acc[l.operation_type] = (acc[l.operation_type] || 0) + Math.abs(l.credits_cost || 0);
    return acc;
  }, {});

  const pieData = stats ? [
    { name: "Rascunhos", value: stats.drafts },
    { name: "Aprovados", value: stats.approved },
    { name: "Oficiais", value: stats.official },
  ].filter((d) => d.value > 0) : [];

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m atrás`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h atrás`;
    return `${Math.floor(hrs / 24)}d atrás`;
  };

  const statCards = [
    { label: "Rascunhos", value: stats?.drafts || 0, icon: Zap, color: "text-amber-500" },
    { label: "Aprovados", value: stats?.approved || 0, icon: FileCheck, color: "text-cyan-500" },
    { label: "Oficiais", value: stats?.official || 0, icon: Star, color: "text-green-500" },
  ];

  const quickChips = [
    { label: "Gerar 5 criativos topo de funil", msg: "Gere 5 criativos de topo de funil para o projeto atual" },
    { label: "Planejar 7 dias", msg: "Crie um plano de conteúdo para os próximos 7 dias" },
    { label: "Sprint de ads 4:5", msg: "Crie um sprint de ads com formato 4:5 para Instagram" },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project?.name || "Carregando..."}</h1>
          <p className="text-sm text-muted-foreground mt-1">{project?.niche || ""}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <Upload className="h-3.5 w-3.5" />Importar
          </button>
          <button onClick={() => navigate(`/project/${projectId}/production`)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Zap className="h-3.5 w-3.5" />Gerar
          </button>
        </div>
      </div>

      {/* Stats + Memory Insight Alert */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {statCards.map((s, i) => (
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

      {/* Pending DNA Insights Alert */}
      {(pendingInsights || 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-lg border border-violet-500/30 bg-violet-500/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-violet-500" />
            <div>
              <p className="text-sm font-semibold">💡 Evolução de DNA Detectada</p>
              <p className="text-xs text-muted-foreground">
                {pendingInsights} sugestão(ões) de atualização do DNA baseada(s) nos seus padrões de aprovação.
              </p>
            </div>
          </div>
          <button onClick={() => { openDock(); }}
            className="rounded-md bg-violet-500/20 px-4 py-2 text-xs font-medium text-violet-500 hover:bg-violet-500/30 transition-colors">
            Ver no Assistente
          </button>
        </motion.div>
      )}

      {/* Consumption Dashboard */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Pipeline de Ativos</h3>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-12">Sem dados</p>
          )}
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Taxa de aprovação: {stats && stats.total > 0 ? Math.round(((stats.official + stats.approved) / stats.total) * 100) : 0}%
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <h3 className="text-sm font-semibold">Consumo do Projeto</h3>
            </div>
            <span className="rounded-md bg-green-500/10 px-2 py-0.5 text-[10px] font-mono text-green-500">
              ~${totalUSD.toFixed(2)} USD
            </span>
          </div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={barData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
                      <p className="font-medium">{d.day}</p>
                      <p className="text-muted-foreground">{d.credits} créditos (~${d.estimatedUSD} USD)</p>
                    </div>
                  );
                }} />
                <Bar dataKey="credits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-12">Sem dados de consumo</p>
          )}
          {/* Operation breakdown */}
          {Object.keys(byOp).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(byOp).map(([op, credits]) => (
                <span key={op} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {op}: {Number(credits).toFixed(1)}cr
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            {totalCredits.toFixed(1)} créditos · {rawData.length} operações
          </p>
        </motion.div>
      </div>

      {/* Recent assets */}
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

      {/* Quick chips */}
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
