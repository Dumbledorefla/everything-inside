import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Loader2, Zap, Image, FileText, Check, Archive, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const actionIcons: Record<string, { icon: React.ElementType; color: string }> = {
  generate: { icon: Zap, color: "text-primary bg-primary/10" },
  approve: { icon: Check, color: "text-cos-success bg-cos-success/10" },
  archive: { icon: Archive, color: "text-muted-foreground bg-muted" },
  promote: { icon: Image, color: "text-cos-purple bg-cos-purple/10" },
  create: { icon: FileText, color: "text-cos-warning bg-cos-warning/10" },
  regenerate: { icon: RefreshCw, color: "text-cos-orange bg-cos-orange/10" },
};

function getActionConfig(action: string) {
  const lower = action.toLowerCase();
  if (lower.includes("gera") || lower.includes("gen")) return actionIcons.generate;
  if (lower.includes("aprov")) return actionIcons.approve;
  if (lower.includes("arquiv")) return actionIcons.archive;
  if (lower.includes("promov") || lower.includes("oficial")) return actionIcons.promote;
  if (lower.includes("cri")) return actionIcons.create;
  if (lower.includes("regen") || lower.includes("refaz")) return actionIcons.regenerate;
  return { icon: Clock, color: "text-muted-foreground bg-muted" };
}

export default function ProjectHistory() {
  const { projectId } = useParams();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity-log", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!projectId,
  });

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-tight">Histórico</h1>
        <p className="text-xs text-muted-foreground mt-1">Eventos e alterações do projeto</p>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {!isLoading && (!logs || logs.length === 0) && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Clock className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda</p>
          <p className="text-xs text-muted-foreground mt-1">Eventos aparecerão conforme você gera, aprova e promove ativos</p>
        </div>
      )}

      <div className="space-y-2">
        {logs?.map((log, i) => {
          const config = getActionConfig(log.action);
          const Icon = config.icon;
          return (
            <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <div className={cn("mt-0.5 rounded-full p-1.5", config.color)}>
                <Icon className="h-3 w-3" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground">{log.action}</p>
                {log.entity_type && (
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {log.entity_type} · <span className="text-foreground/70 font-semibold">{log.entity_id?.slice(0, 8)}</span>
                  </p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
