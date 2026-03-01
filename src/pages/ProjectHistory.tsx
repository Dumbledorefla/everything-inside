import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
        {logs?.map((log, i) => (
          <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="mt-0.5 rounded-full bg-secondary p-1.5"><Clock className="h-3 w-3 text-muted-foreground" /></div>
            <div className="flex-1">
              <p className="text-sm">{log.action}</p>
              {log.entity_type && <p className="text-[10px] font-mono text-muted-foreground">{log.entity_type} · {log.entity_id?.slice(0, 8)}</p>}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
