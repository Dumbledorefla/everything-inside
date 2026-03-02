import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getNicheClass } from "@/lib/nicheAccent";
import { cn } from "@/lib/utils";

interface ProjectRow {
  id: string;
  name: string;
  niche: string | null;
  product: string | null;
  description: string | null;
  updated_at: string;
  is_pinned: boolean;
  workspace_folder: string | null;
  performance_rating: number | null;
  asset_count?: number;
  sprint_status?: string | null;
}

interface Props {
  project: ProjectRow;
  index: number;
}

export default function ProjectCard({ project, index }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const togglePin = useMutation({
    mutationFn: async () => {
      await supabase.from("projects").update({ is_pinned: !project.is_pinned } as any).eq("id", project.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      await supabase.from("projects").delete().eq("id", project.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const stale = Date.now() - new Date(project.updated_at).getTime() > 15 * 86400000;

  const statusBadge = project.sprint_status === "active"
    ? { label: "Sprint Ativa", color: "bg-cos-warning/10 text-cos-warning border-cos-warning/15" }
    : stale
    ? { label: "Pausado", color: "bg-muted/10 text-muted-foreground/50 border-border/10" }
    : { label: "Ativo", color: "bg-cos-success/8 text-cos-success/70 border-cos-success/10" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03 }}
      onClick={() => navigate(`/project/${project.id}/home`)}
      whileHover={{ y: -2 }}
      className={cn(
        "group cursor-pointer rounded-2xl border border-border p-5 transition-all duration-300",
        "bg-card",
        "hover:border-primary/30 hover:shadow-md",
        getNicheClass(project.niche)
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {project.is_pinned && (
              <span className="text-[9px] text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]">◆</span>
            )}
            <h3 className="font-semibold text-sm truncate leading-tight">{project.name}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate font-mono-brand">
            {project.niche || "sem nicho"}
            {project.workspace_folder && (
              <span className="ml-2 text-muted-foreground/30">⌂ {project.workspace_folder}</span>
            )}
          </p>
        </div>
        <span className={cn(
          "shrink-0 ml-2 rounded-full px-2 py-0.5 text-[8px] font-mono-brand uppercase tracking-wider border",
          statusBadge.color
        )}>
          {statusBadge.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-[11px] text-muted-foreground/60 line-clamp-1 mb-3 leading-relaxed">
        {project.product || project.description || "—"}
      </p>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-muted-foreground/50 font-mono-brand">
            {new Date(project.updated_at).toLocaleDateString("pt-BR")}
          </span>
          {project.performance_rating != null && project.performance_rating > 0 && (
            <span className="text-[9px] text-cos-warning font-mono-brand flex items-center gap-0.5">
              ★ {project.performance_rating.toFixed(1)}
            </span>
          )}
          {typeof project.asset_count === "number" && project.asset_count > 0 && (
            <span className="text-[9px] text-muted-foreground/40 font-mono-brand">
              {project.asset_count} ativos
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={(e) => { e.stopPropagation(); togglePin.mutate(); }}
            className={cn(
              "rounded-lg p-1.5 transition-all text-[10px]",
              project.is_pinned ? "text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]" : "text-muted-foreground/40 hover:text-primary"
            )}
            title={project.is_pinned ? "Desafixar" : "Fixar"}
          >
            ◆
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Excluir projeto?")) deleteMut.mutate();
            }}
            className="rounded-lg p-1.5 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <div className="rounded-lg p-1.5">
            <svg className="w-3 h-3 text-primary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14m-7-7 7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
