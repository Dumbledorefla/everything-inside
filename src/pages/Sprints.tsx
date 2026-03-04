import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Play, Pause, CheckCircle, Loader2, Zap, Layers, Rocket } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusIcons: Record<string, React.ElementType> = { active: Play, paused: Pause, completed: CheckCircle };
const statusLabels: Record<string, string> = { active: "Ativo", paused: "Pausado", completed: "Concluído" };
const statusColors: Record<string, string> = {
  active: "text-cos-success bg-cos-success/10 border-cos-success/20",
  paused: "text-cos-warning bg-cos-warning/10 border-cos-warning/20",
  completed: "text-muted-foreground bg-muted/50 border-border",
};

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
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-2.5">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight font-mono-brand">Sprints</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Produção em massa com budget isolado</p>
          </div>
        </div>
        <motion.button
          onClick={() => setShowCreate(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />Novo Sprint
        </motion.button>
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-primary/20 bg-card p-6 space-y-4"
        >
          <h3 className="text-sm font-semibold font-mono-brand flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />Criar Sprint
          </h3>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do sprint"
            className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
          <div>
            <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-1.5 block">
              Budget: <span className="text-primary font-semibold">{newBudget}</span> créditos
            </label>
            <input type="range" min={50} max={5000} step={50} value={newBudget} onChange={(e) => setNewBudget(+e.target.value)} className="w-full accent-primary" />
          </div>
          <div className="flex gap-2">
            <motion.button onClick={() => createSprint.mutate()} disabled={createSprint.isPending}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="rounded-xl bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-all">
              {createSprint.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar"}
            </motion.button>
            <button onClick={() => setShowCreate(false)} className="rounded-xl border border-border px-5 py-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      <div className="space-y-3">
        {sprints?.map((sprint, i) => {
          const Icon = statusIcons[sprint.status] || Play;
          const itemCount = (sprint as any).sprint_items?.length || 0;
          const spent = Number(sprint.spent_credits) || 0;
          const budget = Number(sprint.budget_credits) || 1;
          const pct = Math.min(100, (spent / budget) * 100);
          return (
            <motion.div key={sprint.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/15 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">{sprint.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono-brand">
                    {itemCount} ativos · {spent}/{budget} créditos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-mono-brand", statusColors[sprint.status])}>
                    <Icon className="h-3 w-3" />{statusLabels[sprint.status]}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {sprint.status === "active" && (
                      <button onClick={() => updateStatus.mutate({ id: sprint.id, status: "paused" })}
                        className="rounded-lg border border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:text-cos-warning hover:border-cos-warning/20 transition-all">
                        Pausar
                      </button>
                    )}
                    {sprint.status === "paused" && (
                      <button onClick={() => updateStatus.mutate({ id: sprint.id, status: "active" })}
                        className="rounded-lg border border-border px-2.5 py-1 text-[10px] text-primary hover:border-primary/30 transition-all">
                        Retomar
                      </button>
                    )}
                    {sprint.status !== "completed" && (
                      <button onClick={() => updateStatus.mutate({ id: sprint.id, status: "completed" })}
                        className="rounded-lg border border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:text-cos-success hover:border-cos-success/20 transition-all">
                        Concluir
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full transition-colors",
                    pct > 80 ? "bg-cos-warning" : "bg-primary"
                  )}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-muted-foreground font-mono-brand">{Math.round(pct)}%</span>
                <span className="text-[9px] text-muted-foreground font-mono-brand">{budget} créditos</span>
              </div>
            </motion.div>
          );
        })}
        {!isLoading && (!sprints || sprints.length === 0) && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-14 h-14 mx-auto rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-4"
            >
              <Rocket className="h-7 w-7 text-primary/30" />
            </motion.div>
            <h3 className="text-sm font-semibold font-mono-brand mb-1.5">Nenhum sprint criado</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed mb-4">
              Sprints permitem produzir conteúdo em escala com budget controlado.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Criar Primeiro Sprint
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
