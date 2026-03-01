import { useState } from "react";
import { motion } from "framer-motion";
import { Settings2, Shield, Zap, CreditCard, ScrollText, SlidersHorizontal, ToggleLeft, Loader2, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const roleColors: Record<string, string> = {
  economy: "bg-cos-warning/10 text-cos-warning",
  standard: "bg-cos-cyan/10 text-cos-cyan",
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
    <div className="space-y-4">
      {list && list.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum provedor configurado. Os provedores padrão do sistema serão usados.</p>
      )}
      {list?.map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`h-2 w-2 rounded-full ${p.is_active ? "bg-cos-success" : "bg-muted-foreground"}`} />
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              {p.model_name && <p className="text-[10px] font-mono text-muted-foreground">{p.model_name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono ${roleColors[p.profile_level] || "bg-secondary text-muted-foreground"}`}>{roleLabels[p.profile_level] || p.profile_level}</span>
            <button onClick={() => toggleProvider.mutate({ id: p.id, active: !p.is_active })} className={`text-[10px] font-mono ${p.is_active ? "text-cos-success" : "text-muted-foreground"}`}>
              {p.is_active ? "Ativo" : "Inativo"}
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold tracking-tight mb-6">Configurações</h1>
      <div className="flex gap-6">
        <div className="w-48 shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-left transition-colors ${activeTab === tab.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <tab.icon className="h-3.5 w-3.5" />{tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1">
          {activeTab === "image" && (<><h2 className="text-sm font-semibold mb-4">Provedores de Imagem</h2>{renderProviders(imageProviders)}</>)}
          {activeTab === "text" && (<><h2 className="text-sm font-semibold mb-4">Provedores de Texto</h2>{renderProviders(textProviders)}</>)}
          {activeTab === "budget" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold mb-4">COS Credits</h2>
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-xs font-semibold mb-3">Saldo atual</h3>
                <p className="text-3xl font-bold font-mono">{credits?.toFixed(0) || "0"}</p>
                <p className="text-xs text-muted-foreground mt-1">créditos consumidos</p>
              </div>
            </div>
          )}
          {activeTab === "logs" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold mb-4">Logs de Uso</h2>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="divide-y divide-border">
                  {recentLogs?.map((log) => (
                    <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs">{log.description || "Operação"}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      <span className={`text-xs font-mono ${Number(log.amount) < 0 ? "text-destructive" : "text-cos-success"}`}>{Number(log.amount) > 0 ? "+" : ""}{log.amount}</span>
                    </div>
                  ))}
                  {(!recentLogs || recentLogs.length === 0) && <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sem logs ainda</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
