import { useState } from "react";
import { useParams } from "react-router-dom";
import { FileStack, Loader2, Sparkles, Copy, Trash2, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function Models() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch custom model templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["custom-templates", projectId],
    queryFn: async () => {
      const query = supabase
        .from("templates")
        .select("*")
        .eq("is_custom_model", true)
        .order("created_at", { ascending: false });

      // If we have a projectId, filter by it; otherwise get all user templates
      if (projectId) {
        query.eq("project_id", projectId);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Delete template
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-templates"] });
      toast.success("Modelo removido");
    },
  });

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold tracking-tight mb-2">Modelos</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Modelos extraídos de ativos aprovados — fórmulas reutilizáveis de copy
      </p>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (!templates || templates.length === 0) && (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <FileStack className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum modelo criado ainda. Na Biblioteca, clique em "Salvar como Modelo" em um ativo aprovado.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {templates?.map((t: any, i: number) => {
          const content = t.template_content || {};
          const isExpanded = expandedId === t.id;

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="flex items-center gap-3 text-left flex-1"
                >
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t.aspect_ratio} · Framework: {content.framework || "—"} · Tom: {content.tone || "—"}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMut.mutate(t.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border px-4 py-3 space-y-3 bg-secondary/20"
                  >
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Headline Template</p>
                      <p className="text-xs bg-card rounded-md p-2 border border-border font-mono">{content.headline_template || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Body Template</p>
                      <p className="text-xs bg-card rounded-md p-2 border border-border font-mono whitespace-pre-wrap">{content.body_template || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">CTA Template</p>
                      <p className="text-xs bg-card rounded-md p-2 border border-border font-mono">{content.cta_template || "—"}</p>
                    </div>
                    {content.variables && content.variables.length > 0 && (
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Variáveis</p>
                        <div className="flex flex-wrap gap-1.5">
                          {content.variables.map((v: any, vi: number) => (
                            <span key={vi} className="rounded-md bg-primary/10 px-2 py-1 text-[10px] text-primary font-mono">
                              {v.name}: {v.example}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
