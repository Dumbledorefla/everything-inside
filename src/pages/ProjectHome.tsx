import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, FileCheck, Star, ArrowRight, Upload, Bot, BarChart3, DollarSign, Brain, TrendingUp, Palette, Loader2 } from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "bg-cos-warning/10 text-cos-warning border border-cos-warning/15",
  review: "bg-cos-purple/10 text-cos-purple border border-cos-purple/15",
  approved: "bg-primary/10 text-primary border border-primary/15",
  official: "bg-cos-success/10 text-cos-success border border-cos-success/15",
  archived: "bg-muted/30 text-muted-foreground border border-border/10",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho", review: "Revisão", approved: "Aprovado", official: "Oficial", archived: "Arquivado",
};

const PIE_COLORS = ["hsl(var(--cos-warning))", "hsl(var(--primary))", "hsl(var(--cos-success))", "hsl(var(--muted-foreground))"];

export default function ProjectHome() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { sendMessage, openDock } = useAssistant();
  const [brandingLoading, setBrandingLoading] = useState(false);

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

  const { data: brandKit } = useQuery({
    queryKey: ["brand-kit", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("brand_kits").select("*").eq("project_id", projectId!).maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  const handleGenerateBranding = async () => {
    setBrandingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("branding-generate", {
        body: { projectId },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["brand-kit", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dna-versions", projectId] });
      toast.success(`Branding Kit gerado! DNA atualizado para v${data.dnaVersion}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBrandingLoading(false);
    }
  };

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
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const statCards = [
    { label: "Rascunhos", value: stats?.drafts || 0, icon: Zap, color: "text-cos-warning", bg: "bg-cos-warning/8 border-cos-warning/10" },
    { label: "Aprovados", value: stats?.approved || 0, icon: FileCheck, color: "text-primary", bg: "bg-primary/8 border-primary/10" },
    { label: "Oficiais", value: stats?.official || 0, icon: Star, color: "text-cos-success", bg: "bg-cos-success/8 border-cos-success/10" },
  ];

  const quickChips = [
    { label: "Gerar 5 criativos", msg: "Gere 5 criativos de topo de funil para o projeto atual" },
    { label: "Planejar 7 dias", msg: "Crie um plano de conteúdo para os próximos 7 dias" },
    { label: "Sprint de ads", msg: "Crie um sprint de ads com formato 4:5 para Instagram" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-xl font-bold tracking-tight font-mono-brand">{project?.name || "..."}</h1>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5 font-mono-brand tracking-widest uppercase">{project?.niche || ""}</p>
        </motion.div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-xl border border-border/15 bg-card/15 px-3 py-2 text-xs text-muted-foreground/70 hover:bg-card/30 hover:text-muted-foreground transition-all">
            <Upload className="h-3.5 w-3.5" />Importar
          </button>
          <button onClick={() => navigate(`/project/${projectId}/production`)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-all glow-cyan">
            <Zap className="h-3.5 w-3.5" />Gerar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={cn("rounded-2xl border p-5 backdrop-blur-sm", s.bg)}>
            <div className="flex items-center gap-3">
              <s.icon className={cn("h-4 w-4", s.color)} />
              <div>
                <p className="text-2xl font-bold font-mono-brand tracking-tighter">{s.value}</p>
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-mono-brand">{s.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* DNA Insights Alert */}
      {(pendingInsights || 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-cos-purple/15 bg-cos-purple/5 backdrop-blur-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-4 w-4 text-cos-purple" />
            <div>
              <p className="text-xs font-semibold">Evolução de DNA Detectada</p>
              <p className="text-[10px] text-muted-foreground/60">{pendingInsights} sugestão(ões) baseada(s) nos seus padrões.</p>
            </div>
          </div>
          <button onClick={() => openDock()}
            className="rounded-xl bg-cos-purple/15 px-3 py-1.5 text-[11px] font-medium text-cos-purple hover:bg-cos-purple/25 transition-colors">
            Ver
          </button>
        </motion.div>
      )}

      {/* Branding Kit */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="mb-6 rounded-2xl border border-border/10 bg-card/15 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-primary/60" />
            <h3 className="text-xs font-semibold font-mono-brand">Branding Kit</h3>
          </div>
          {!brandKit && (
            <button onClick={handleGenerateBranding} disabled={brandingLoading}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50">
              {brandingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Palette className="h-3 w-3" />}
              {brandingLoading ? "Gerando..." : "Gerar Identidade"}
            </button>
          )}
        </div>
        {brandKit ? (
          <div className="space-y-3">
            <div>
              <p className="text-[9px] font-mono-brand uppercase tracking-[0.2em] text-muted-foreground/60 mb-1.5">Paleta</p>
              <div className="flex gap-2">
                {((brandKit.color_palette as any) || []).map((c: string, i: number) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="h-7 w-7 rounded-lg border border-border/10" style={{ backgroundColor: c }} />
                    <span className="text-[8px] font-mono-brand text-muted-foreground/50">{c}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-mono-brand uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Tipografia</p>
              <p className="text-xs">
                <span className="font-semibold">{(brandKit.typography as any)?.heading || "—"}</span>
                {" · "}
                <span className="text-muted-foreground/70">{(brandKit.typography as any)?.body || "—"}</span>
              </p>
            </div>
            <div>
              <p className="text-[9px] font-mono-brand uppercase tracking-[0.2em] text-muted-foreground/60 mb-1.5">Pilares</p>
              <div className="flex flex-wrap gap-1.5">
                {((brandKit.editorial_line as any) || []).map((p: any, i: number) => (
                  <span key={i} className="rounded-lg bg-primary/8 border border-primary/10 px-2 py-0.5 text-[10px] text-primary/70">
                    {p.pillar || p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/60">Gere um kit completo com paleta, tipografia e linha editorial baseados no DNA.</p>
        )}
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border/10 bg-card/15 backdrop-blur-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-3.5 w-3.5 text-primary/60" />
            <h3 className="text-xs font-semibold font-mono-brand">Pipeline</h3>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={60} innerRadius={35} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[11px] text-muted-foreground/50 text-center py-10">Sem dados</p>
          )}
          <p className="text-[9px] text-muted-foreground/50 text-center mt-2 font-mono-brand">
            Aprovação: {stats && stats.total > 0 ? Math.round(((stats.official + stats.approved) / stats.total) * 100) : 0}%
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl border border-border/10 bg-card/15 backdrop-blur-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-cos-success/60" />
              <h3 className="text-xs font-semibold font-mono-brand">Consumo</h3>
            </div>
            <span className="rounded-lg bg-cos-success/8 border border-cos-success/10 px-2 py-0.5 text-[9px] font-mono-brand text-cos-success/70">
              ~${totalUSD.toFixed(2)}
            </span>
          </div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={barData}>
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground) / 0.6)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground) / 0.6)" }} axisLine={false} tickLine={false} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-border/10 bg-card/80 backdrop-blur-sm px-3 py-2 text-[10px] shadow-lg">
                      <p className="font-medium font-mono-brand">{d.day}</p>
                      <p className="text-muted-foreground/60">{d.credits}cr · ${d.estimatedUSD}</p>
                    </div>
                  );
                }} />
                <Bar dataKey="credits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[11px] text-muted-foreground/50 text-center py-10">Sem dados</p>
          )}
          {Object.keys(byOp).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(byOp).map(([op, credits]) => (
                <span key={op} className="rounded-lg bg-card/20 border border-border/10 px-2 py-0.5 text-[9px] font-mono-brand text-muted-foreground/60">
                  {op}: {Number(credits).toFixed(1)}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Assets */}
      <div className="rounded-2xl border border-border/10 bg-card/15 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/10">
          <h2 className="text-xs font-semibold font-mono-brand">Últimos Ativos</h2>
          <button onClick={() => navigate(`/project/${projectId}/library`)} className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors">
            Ver todos <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="divide-y divide-border/10">
          {(!recentAssets || recentAssets.length === 0) && (
            <div className="px-5 py-10 text-center text-[11px] text-muted-foreground/50">Nenhum ativo gerado ainda.</div>
          )}
          {recentAssets?.map((asset, i) => (
            <motion.div key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between px-5 py-3 hover:bg-card/20 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-card/30 border border-border/10 px-2 py-0.5 text-[9px] font-mono-brand uppercase tracking-wider text-muted-foreground/60">{asset.output}</span>
                <span className="text-[12px] truncate">{asset.title || "Sem título"}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={cn("rounded-lg px-2 py-0.5 text-[9px] font-mono-brand uppercase tracking-wider", statusColors[asset.status] || "")}>
                  {statusLabels[asset.status] || asset.status}
                </span>
                <span className="text-[9px] text-muted-foreground/50 font-mono-brand">{formatTime(asset.created_at)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick Chips */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-3.5 w-3.5 text-primary/50" />
          <span className="text-[10px] font-mono-brand uppercase tracking-[0.2em] text-muted-foreground/60">Atalhos</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickChips.map((chip) => (
            <button key={chip.label} onClick={() => { openDock(); sendMessage(chip.msg); }}
              className="rounded-xl border border-border/10 bg-card/10 px-3.5 py-2 text-[11px] text-muted-foreground/70 hover:border-primary/20 hover:text-primary/70 hover:bg-primary/5 transition-all">
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
