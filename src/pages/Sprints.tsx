import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Play, Pause, CheckCircle, Loader2, Zap } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const statusIcons: Record<string, React.ElementType> = { active: Play, paused: Pause, completed: CheckCircle };
const statusLabels: Record<string, string> = { active: "Ativo", paused: "Pausado", completed: "Concluído" };
const statusColors: Record<string, string> = { active: "text-cos-success", paused: "text-cos-warning", completed: "text-muted-foreground" };

export default function Sprints() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBudget, setNewBudget] = useState(500);

  const { data: sprints, isLoading } = useQuery({
    queryKey: ["sprints", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("sprints").select("*, sprint_items(id, status)").eq("project_id", projectId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!projectId,
  });

  const createSprint = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sprints").insert({
        project_id: projectId!,
        user_id: user!.id,
        name: newName || `Sprint ${(sprints?.length || 0) + 1}`,
        budget_credits: newBudget,
        status: "active" as const,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
      setShowCreate(false);
      setNewName("");
      toast.success("Sprint criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("sprints").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints", projectId] }),
  });

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sprints</h1>
          <p className="text-xs text-muted-foreground mt-1">Produção em massa com budget isolado</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-3.5 w-3.5" />Novo Sprint
        </button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border border-primary/30 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">Criar Sprint</h3>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do sprint" className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Budget: {newBudget} créditos</label>
            <input type="range" min={50} max={5000} step={50} value={newBudget} onChange={(e) => setNewBudget(+e.target.value)} className="w-full accent-primary" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createSprint.mutate()} disabled={createSprint.isPending} className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              {createSprint.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar"}
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary">Cancelar</button>
          </div>
        </motion.div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      <div className="space-y-4">
        {sprints?.map((sprint, i) => {
          const Icon = statusIcons[sprint.status] || Play;
          const itemCount = (sprint as any).sprint_items?.length || 0;
          const spent = Number(sprint.spent_credits) || 0;
          const budget = Number(sprint.budget_credits) || 1;
          const pct = Math.min(100, (spent / budget) * 100);
          return (
            <motion.div key={sprint.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">{sprint.name}</h3>
                  <p className="text-xs text-muted-foreground">{itemCount} ativos · {spent}/{budget} créditos</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1 text-[10px] font-mono ${statusColors[sprint.status]}`}>
                    <Icon className="h-3 w-3" />{statusLabels[sprint.status]}
                  </span>
                  {sprint.status === "active" && (
                    <button onClick={() => updateStatus.mutate({ id: sprint.id, status: "paused" })} className="text-[10px] text-muted-foreground hover:text-foreground">Pausar</button>
                  )}
                  {sprint.status === "paused" && (
                    <button onClick={() => updateStatus.mutate({ id: sprint.id, status: "active" })} className="text-[10px] text-primary hover:text-primary/80">Retomar</button>
                  )}
                  {sprint.status !== "completed" && (
                    <button onClick={() => updateStatus.mutate({ id: sprint.id, status: "completed" })} className="text-[10px] text-muted-foreground hover:text-cos-success">Concluir</button>
                  )}
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </motion.div>
          );
        })}
        {!isLoading && (!sprints || sprints.length === 0) && (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum sprint criado</p>
          </div>
        )}
      </div>
    </div>
  );
}
