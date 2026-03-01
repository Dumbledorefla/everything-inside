import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, CheckCircle2, Clock, Loader2, Search,
  Filter, ChevronDown, Zap, CreditCard, Image, MessageSquare,
  RefreshCw, XCircle, Info,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Icon/color mappings ──────────────────────────────
const opIcons: Record<string, typeof Zap> = {
  IMAGE_GEN: Image,
  TEXT_GEN: MessageSquare,
  BRANDING_KIT: Zap,
  MEMORY_ANALYSIS: RefreshCw,
  SPRINT: Zap,
  CHAT: MessageSquare,
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  success: { icon: CheckCircle2, className: "text-[hsl(var(--cos-success))]", label: "Sucesso" },
  error: { icon: XCircle, className: "text-destructive", label: "Erro" },
  pending: { icon: Clock, className: "text-[hsl(var(--cos-warning))]", label: "Pendente" },
};

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function Logs() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tab, setTab] = useState("operations");

  // ── Fetch operations (cos_ledger) ──────────────────
  const { data: operations = [], isLoading: opsLoading, refetch: refetchOps } = useQuery({
    queryKey: ["logs-operations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cos_ledger")
        .select("*, projects(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // ── Fetch activity log ─────────────────────────────
  const { data: activities = [], isLoading: actLoading, refetch: refetchAct } = useQuery({
    queryKey: ["logs-activity", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*, projects(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // ── Filtered data ──────────────────────────────────
  const filteredOps = useMemo(() => {
    let list = operations;
    if (typeFilter !== "all") list = list.filter((o: any) => o.operation_type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((o: any) =>
        o.operation_type?.toLowerCase().includes(q) ||
        o.provider_used?.toLowerCase().includes(q) ||
        (o.projects as any)?.name?.toLowerCase().includes(q) ||
        (o.metadata && JSON.stringify(o.metadata).toLowerCase().includes(q))
      );
    }
    return list;
  }, [operations, typeFilter, search]);

  const filteredActs = useMemo(() => {
    if (!search) return activities;
    const q = search.toLowerCase();
    return activities.filter((a: any) =>
      a.action?.toLowerCase().includes(q) ||
      a.entity_type?.toLowerCase().includes(q) ||
      (a.projects as any)?.name?.toLowerCase().includes(q)
    );
  }, [activities, search]);

  const opTypes = useMemo(() => {
    const set = new Set(operations.map((o: any) => o.operation_type));
    return Array.from(set);
  }, [operations]);

  // ── Stats ──────────────────────────────────────────
  const totalCredits = operations.reduce((s: number, o: any) => s + (o.credits_cost || 0), 0);
  const totalUsd = operations.reduce((s: number, o: any) => s + (o.estimated_usd || 0), 0);
  const errorCount = activities.filter((a: any) => 
    a.action?.toLowerCase().includes("error") || a.action?.toLowerCase().includes("fallback")
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Logs & Monitoramento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe todas as operações de IA, erros e consumo do sistema
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetchOps(); refetchAct(); }}
          className="gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Zap className="h-4 w-4 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Operações</p>
                <p className="text-xl font-bold text-foreground">{operations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[hsl(var(--cos-success))]/10 p-2"><CreditCard className="h-4 w-4 text-[hsl(var(--cos-success))]" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Créditos Usados</p>
                <p className="text-xl font-bold text-foreground">{totalCredits.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[hsl(var(--cos-warning))]/10 p-2"><CreditCard className="h-4 w-4 text-[hsl(var(--cos-warning))]" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Custo Estimado</p>
                <p className="text-xl font-bold text-foreground">${totalUsd.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2"><AlertCircle className="h-4 w-4 text-destructive" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Erros / Fallbacks</p>
                <p className="text-xl font-bold text-foreground">{errorCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por tipo, provider, projeto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {tab === "operations" && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <Filter className="h-3.5 w-3.5 mr-2" />
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {opTypes.map((t: string) => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="operations" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Operações IA ({filteredOps.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Atividades ({filteredActs.length})
          </TabsTrigger>
        </TabsList>

        {/* Operations Tab */}
        <TabsContent value="operations">
          <Card>
            <ScrollArea className="h-[calc(100vh-420px)]">
              <CardContent className="p-0">
                {opsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredOps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Info className="h-8 w-8 mb-2" />
                    <p className="text-sm">Nenhuma operação registrada ainda</p>
                    <p className="text-xs mt-1">As operações de IA aparecerão aqui quando você gerar conteúdo</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    <AnimatePresence>
                      {filteredOps.map((op: any, i: number) => {
                        const Icon = opIcons[op.operation_type] || Zap;
                        const hasError = op.metadata?.error || op.metadata?.fallback;
                        const status = hasError ? "error" : "success";
                        const StatusIcon = statusConfig[status].icon;

                        return (
                          <motion.div
                            key={op.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="px-4 py-3 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="rounded-lg bg-muted p-2 mt-0.5">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm text-foreground">
                                    {op.operation_type?.replace(/_/g, " ")}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {op.provider_used}
                                  </Badge>
                                  <StatusIcon className={`h-3.5 w-3.5 ${statusConfig[status].className}`} />
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span>{formatTimestamp(op.created_at)}</span>
                                  {(op.projects as any)?.name && (
                                    <span className="text-primary/70">📁 {(op.projects as any).name}</span>
                                  )}
                                  <span>{op.credits_cost} créditos</span>
                                  <span className="font-mono">${op.estimated_usd?.toFixed(3)}</span>
                                </div>
                                {/* Metadata / Error details */}
                                {op.metadata && Object.keys(op.metadata).length > 0 && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                      {hasError ? "⚠️ Detalhes do erro" : "📋 Metadata"}
                                    </summary>
                                    <pre className="mt-1 rounded-md bg-muted p-2 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-32">
                                      {JSON.stringify(op.metadata, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-mono text-muted-foreground">
                                  {op.asset_id ? `#${op.asset_id.slice(0, 6)}` : "—"}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <ScrollArea className="h-[calc(100vh-420px)]">
              <CardContent className="p-0">
                {actLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredActs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Info className="h-8 w-8 mb-2" />
                    <p className="text-sm">Nenhuma atividade registrada</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    <AnimatePresence>
                      {filteredActs.map((act: any, i: number) => {
                        const isError = act.action?.toLowerCase().includes("error") || act.action?.toLowerCase().includes("fail");
                        return (
                          <motion.div
                            key={act.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="px-4 py-3 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className={`rounded-lg p-2 mt-0.5 ${isError ? "bg-destructive/10" : "bg-muted"}`}>
                                {isError ? (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm font-medium ${isError ? "text-destructive" : "text-foreground"}`}>
                                  {act.action}
                                </span>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span>{formatTimestamp(act.created_at)}</span>
                                  {(act.projects as any)?.name && (
                                    <span className="text-primary/70">📁 {(act.projects as any).name}</span>
                                  )}
                                  {act.entity_type && (
                                    <Badge variant="outline" className="text-[10px]">{act.entity_type}</Badge>
                                  )}
                                </div>
                                {act.metadata && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                      📋 Detalhes
                                    </summary>
                                    <pre className="mt-1 rounded-md bg-muted p-2 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-32">
                                      {JSON.stringify(act.metadata, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                              <span className="text-xs font-mono text-muted-foreground shrink-0">
                                {act.entity_id ? `#${act.entity_id.slice(0, 6)}` : "—"}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
