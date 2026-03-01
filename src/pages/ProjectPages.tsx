import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, Loader2, ChevronRight, Layout } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const pageTypeLabels: Record<string, string> = {
  sales: "Página de Vendas", landing: "Landing Page", vsl: "VSL", presell: "Presell",
  advertorial: "Advertorial", checkout: "Checkout", thankyou: "Obrigado", ecommerce: "E-commerce",
};

const sectionTypes = ["hero", "dor", "mecanismo", "prova", "depoimentos", "oferta", "garantia", "faq", "cta", "comparativo", "bonus"];

export default function ProjectPages() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("sales");
  const [expandedPage, setExpandedPage] = useState<string | null>(null);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["pages", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("pages").select("*, page_sections(*, page_section_variants(*))").eq("project_id", projectId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!projectId,
  });

  const createPage = useMutation({
    mutationFn: async () => {
      const { data: page, error } = await supabase.from("pages").insert({
        project_id: projectId!,
        user_id: user!.id,
        name: newName || "Nova Página",
        page_type: newType as any,
      }).select().single();
      if (error) throw error;
      // Auto-create sections
      const sections = sectionTypes.map((type, i) => ({
        page_id: page.id,
        section_type: type,
        sort_order: i,
      }));
      await supabase.from("page_sections").insert(sections);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages", projectId] });
      setShowCreate(false);
      setNewName("");
      toast.success("Página criada com seções padrão");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Páginas</h1>
          <p className="text-xs text-muted-foreground mt-1">Ativos compostos — páginas de vendas, LPs e e-commerce</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-3.5 w-3.5" />Nova Página
        </button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border border-primary/30 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">Criar Página</h3>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da página" className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs focus:border-primary focus:outline-none">
            {Object.entries(pageTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => createPage.mutate()} disabled={createPage.isPending} className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
              {createPage.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar"}
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary">Cancelar</button>
          </div>
        </motion.div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      <div className="space-y-4">
        {pages?.map((page, i) => {
          const sections = (page as any).page_sections || [];
          const isExpanded = expandedPage === page.id;
          return (
            <motion.div key={page.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-border bg-card overflow-hidden">
              <button onClick={() => setExpandedPage(isExpanded ? null : page.id)} className="w-full flex items-center justify-between p-5 text-left hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <Layout className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{page.name}</p>
                    <p className="text-[10px] text-muted-foreground">{pageTypeLabels[page.page_type] || page.page_type} · {sections.length} seções · {page.status}</p>
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>
              {isExpanded && (
                <div className="border-t border-border px-5 py-3 space-y-2">
                  {sections.sort((a: any, b: any) => a.sort_order - b.sort_order).map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-xs font-medium capitalize">{s.section_type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{s.page_section_variants?.length || 0} variantes</span>
                        <span className={`text-[10px] font-mono ${s.status === "approved" ? "text-cos-success" : "text-muted-foreground"}`}>{s.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
        {!isLoading && (!pages || pages.length === 0) && (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma página criada</p>
          </div>
        )}
      </div>
    </div>
  );
}
