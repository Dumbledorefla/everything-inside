import { useAssistant } from "@/contexts/AssistantContext";
import { Check, Star, Archive, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

export default function QuickActions() {
  const ctx = useAssistant();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);

  const updateAssetStatus = async (assetId: string, status: string, action: string) => {
    setLoading(action);
    try {
      const { error } = await supabase.from("assets").update({ status: status as any }).eq("id", assetId);
      if (error) throw error;

      // Log activity
      await supabase.from("activity_log").insert({
        project_id: ctx.activeProjectId!,
        user_id: (await supabase.auth.getUser()).data.user!.id,
        action: `${action}: ${ctx.selectedAsset?.title || assetId.slice(0, 8)}`,
        entity_type: "asset",
        entity_id: assetId,
      });

      queryClient.invalidateQueries({ queryKey: ["project-assets"] });
      queryClient.invalidateQueries({ queryKey: ["recent-assets"] });
      queryClient.invalidateQueries({ queryKey: ["project-stats"] });
      toast.success(`${action} realizado com sucesso`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  const regenerateWithQuality = async (assetId: string) => {
    setLoading("regen-quality");
    try {
      const { data, error } = await supabase.functions.invoke("cos-generate", {
        body: {
          projectId: ctx.activeProjectId,
          mode: "rapido",
          output: "both",
          pieceType: "post",
          quantity: 1,
          profile: "quality",
          provider: "Auto",
          destination: "Feed",
          ratio: "1:1",
          intensity: "Equilibrado",
          useModel: false,
          useVisualProfile: false,
          regenerateAssetId: assetId,
        },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["project-assets"] });
      queryClient.invalidateQueries({ queryKey: ["recent-assets"] });
      toast.success("Regerado com perfil Qualidade");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  const actions = [
    { id: "approve", label: "Aprovar Ativo", icon: Check, color: "text-cos-success bg-cos-success/10 hover:bg-cos-success/20", fn: () => ctx.selectedAsset && updateAssetStatus(ctx.selectedAsset.id, "approved", "Aprovação") },
    { id: "promote", label: "Promover a Oficial", icon: Star, color: "text-cos-cyan bg-cos-cyan/10 hover:bg-cos-cyan/20", fn: () => ctx.selectedAsset && updateAssetStatus(ctx.selectedAsset.id, "official", "Promoção a Oficial") },
    { id: "archive", label: "Arquivar", icon: Archive, color: "text-muted-foreground bg-secondary hover:bg-secondary/80", fn: () => ctx.selectedAsset && updateAssetStatus(ctx.selectedAsset.id, "archived", "Arquivamento") },
    { id: "regenerate", label: "Regerar", icon: RefreshCw, color: "text-foreground bg-secondary hover:bg-secondary/80", fn: () => ctx.selectedAsset && updateAssetStatus(ctx.selectedAsset.id, "draft", "Regerar") },
    { id: "regen-quality", label: "Regerar com Qualidade", icon: Sparkles, color: "text-cos-purple bg-cos-purple/10 hover:bg-cos-purple/20", fn: () => ctx.selectedAsset && regenerateWithQuality(ctx.selectedAsset.id) },
  ];

  const quickPrompts = [
    { label: "Gerar 5 criativos topo de funil", message: "Gere 5 criativos de topo de funil para o projeto atual" },
    { label: "Planejar 7 dias", message: "Crie um plano de conteúdo para os próximos 7 dias" },
    { label: "Sprint de ads 4:5", message: "Crie um sprint de ads com formato 4:5 para Instagram" },
  ];

  return (
    <div className="overflow-y-auto p-3 space-y-4">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Ações do Ativo</p>
        {!ctx.selectedAsset && <p className="text-xs text-muted-foreground/60 italic">Selecione um ativo na Biblioteca para ver ações.</p>}
        <div className="space-y-1">
          {actions.map((a) => (
            <button key={a.id} disabled={!ctx.selectedAsset || loading === a.id} onClick={a.fn}
              className={cn("w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed", a.color)}>
              {loading === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <a.icon className="h-3.5 w-3.5" />}
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Atalhos Rápidos</p>
        <div className="space-y-1">
          {quickPrompts.map((q) => (
            <button key={q.label} onClick={() => ctx.sendMessage(q.message)} className="w-full text-left rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
