import { useState } from "react";
import { motion } from "framer-motion";
import { Settings2, Shield, Zap, CreditCard, ScrollText, SlidersHorizontal, ToggleLeft, Loader2, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAIGuard } from "@/hooks/useAIGuard";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const roleColors: Record<string, string> = {
  economy: "bg-cos-warning/10 text-cos-warning",
  standard: "bg-primary/10 text-primary",
  quality: "bg-cos-purple/10 text-cos-purple",
};

const roleLabels: Record<string, string> = { economy: "Economia", standard: "Padrão", quality: "Qualidade" };

const tabs = [
  { id: "image", label: "Provedores Imagem", icon: Zap },
  { id: "text", label: "Provedores Texto", icon: ScrollText },
  { id: "budget", label: "Budget & Quotas", icon: CreditCard },
  { id: "logs", label: "Logs", icon: SlidersHorizontal },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("image");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: providers, isLoading } = useQuery({
    queryKey: ["provider-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("provider_configs").select("*").order("fallback_order");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: credits } = useQuery({
    queryKey: ["credits-total"],
    queryFn: async () => {
      const { data } = await supabase.from("cos_credits_log").select("amount").limit(1000);
      const total = data?.reduce((s, r) => s + Number(r.amount), 0) || 0;
      return total;
    },
    enabled: !!user,
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["credits-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("cos_credits_log").select("*").order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!user && activeTab === "logs",
  });

  const toggleProvider = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("provider_configs").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-configs"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const imageProviders = providers?.filter((p) => p.provider_type === "image") || [];
  const textProviders = providers?.filter((p) => p.provider_type === "text") || [];

  const renderProviders = (list: typeof providers) => (
    <div className="space-y-3">
      {list && list.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">Nenhum provedor configurado. Os provedores padrão do sistema serão usados.</p>
      )}
      {list?.map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-primary/15 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className={cn("h-2.5 w-2.5 rounded-full", p.is_active ? "bg-cos-success" : "bg-muted-foreground/30")} />
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              {p.model_name && <p className="text-[10px] font-mono-brand text-muted-foreground">{p.model_name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("rounded-lg px-2.5 py-0.5 text-[10px] font-mono-brand", roleColors[p.profile_level] || "bg-secondary text-muted-foreground")}>{roleLabels[p.profile_level] || p.profile_level}</span>
            <button onClick={() => toggleProvider.mutate({ id: p.id, active: !p.is_active })}
              className={cn("text-[10px] font-mono-brand px-2.5 py-1 rounded-lg border transition-all", p.is_active ? "text-cos-success border-cos-success/20 bg-cos-success/5" : "text-muted-foreground border-border hover:text-foreground")}>
              {p.is_active ? "Ativo" : "Inativo"}
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-2.5">
          <Settings2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight font-mono-brand">Configurações</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Provedores, budget e monitoramento</p>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="w-52 shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs text-left transition-all",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary font-medium border border-primary/20"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent"
              )}>
              <tab.icon className="h-4 w-4" />{tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {activeTab === "image" && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-mono-brand">Provedores de Imagem</CardTitle>
              </CardHeader>
              <CardContent>{renderProviders(imageProviders)}</CardContent>
            </Card>
          )}
          {activeTab === "text" && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-mono-brand">Provedores de Texto</CardTitle>
              </CardHeader>
              <CardContent>{renderProviders(textProviders)}</CardContent>
            </Card>
          )}
          {activeTab === "budget" && <BudgetTab credits={credits} />}
          {activeTab === "logs" && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-mono-brand">Logs de Uso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="divide-y divide-border">
                    {recentLogs?.map((log) => (
                      <div key={log.id} className="px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            Number(log.amount) < 0 ? "bg-destructive" : "bg-cos-success"
                          )} />
                          <div>
                            <p className="text-xs text-foreground">{log.description || "Operação"}</p>
                            <p className="text-[10px] text-muted-foreground font-mono-brand">{new Date(log.created_at).toLocaleString("pt-BR")}</p>
                          </div>
                        </div>
                        <span className={cn("text-xs font-mono-brand font-medium", Number(log.amount) < 0 ? "text-destructive" : "text-cos-success")}>{Number(log.amount) > 0 ? "+" : ""}{log.amount}</span>
                      </div>
                    ))}
                    {(!recentLogs || recentLogs.length === 0) && <p className="px-4 py-8 text-sm text-muted-foreground text-center">Sem logs ainda</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}