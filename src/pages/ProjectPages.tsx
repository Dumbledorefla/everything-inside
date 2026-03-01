import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, Loader2, ChevronRight, Layout, Zap, Play, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const pageTypeLabels: Record<string, string> = {
  sales: "Página de Vendas", landing: "Landing Page", vsl: "VSL", presell: "Presell",
  advertorial: "Advertorial", checkout: "Checkout", thankyou: "Obrigado", ecommerce: "E-commerce",
};

const sectionTypes = ["hero", "dor", "mecanismo", "prova", "depoimentos", "oferta", "garantia", "faq", "cta", "comparativo", "bonus"];

const sectionLabels: Record<string, string> = {
  hero: "Hero", dor: "Dor / Problema", mecanismo: "Mecanismo", prova: "Prova Social",
  depoimentos: "Depoimentos", oferta: "Oferta", garantia: "Garantia", faq: "FAQ",
  cta: "CTA Final", comparativo: "Comparativo", bonus: "Bônus",
};

export default function ProjectPages() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("sales");
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [assembling, setAssembling] = useState<string | null>(null);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["pages", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pages")
        .select("*, page_sections(*, page_section_variants(*))")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
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

  // Page Assembler: generate variants for all sections
  const assemblePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      setAssembling(pageId);

      // Get page sections
      const { data: sections } = await supabase
        .from("page_sections")
        .select("*")
        .eq("page_id", pageId)
        .order("sort_order");

      if (!sections || sections.length === 0) throw new Error("Nenhuma seção encontrada");

      // Generate 2 variants per section using cos-generate
      let totalGenerated = 0;
      for (const section of sections) {
        try {
          const { data, error } = await supabase.functions.invoke("cos-generate", {
            body: {
              projectId,
              mode: "rapido",
              output: "text",
              pieceType: section.section_type,
              quantity: 2,
              profile: "standard",
              provider: "Auto",
              destination: "Página de Vendas",
              ratio: "16:9",
              intensity: "Equilibrado",
              useModel: false,
              useVisualProfile: false,
              userPrompt: `Gere conteúdo para a seção "${sectionLabels[section.section_type] || section.section_type}" de uma página de vendas. Retorne headline, body e CTA específicos para esta seção.`,
            },
          });

          if (error) {
            console.error(`Section ${section.section_type} error:`, error);
            continue;
          }

          // Save results as section variants
          const results = data?.results || [];
          for (const result of results) {
            await supabase.from("page_section_variants").insert({
              section_id: section.id,
              headline: result.headline,
              body: result.body,
              cta: result.cta,
              image_url: result.imageUrl,
              style: {
                provider: result.provider,
                profile: result.profile,
                piece_type: section.section_type,
              },
            });
            totalGenerated++;
          }
        } catch (e) {
          console.error(`Section ${section.section_type} failed:`, e);
        }
      }

      return totalGenerated;
    },
    onSuccess: (count, pageId) => {
      queryClient.invalidateQueries({ queryKey: ["pages", projectId] });
      toast.success(`PageAssembler: ${count} variantes geradas em ${sectionTypes.length} seções`);
      setAssembling(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setAssembling(null);
    },
  });

  // Approve a section variant
  const approveVariant = async (sectionId: string, variantId: string) => {
    try {
      await supabase.from("page_sections").update({
        selected_variant_id: variantId,
        status: "approved",
      }).eq("id", sectionId);
      queryClient.invalidateQueries({ queryKey: ["pages", projectId] });
      toast.success("Seção aprovada");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Páginas</h1>
          <p className="text-xs text-muted-foreground mt-1">Ativos compostos — Outline → Geração por seção → Assembly</p>
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
          const sections = ((page as any).page_sections || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
          const isExpanded = expandedPage === page.id;
          const isAssembling = assembling === page.id;
          const totalVariants = sections.reduce((s: number, sec: any) => s + (sec.page_section_variants?.length || 0), 0);
          const approvedSections = sections.filter((s: any) => s.status === "approved").length;

          return (
            <motion.div key={page.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-5">
                <button onClick={() => setExpandedPage(isExpanded ? null : page.id)} className="flex items-center gap-3 text-left flex-1">
                  <Layout className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{page.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {pageTypeLabels[page.page_type] || page.page_type} · {sections.length} seções · {totalVariants} variantes · {approvedSections}/{sections.length} aprovadas
                    </p>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>
                <button
                  onClick={() => assemblePageMutation.mutate(page.id)}
                  disabled={isAssembling}
                  className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {isAssembling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  {isAssembling ? "Montando..." : "Assembler"}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-border px-5 py-3 space-y-3">
                  {sections.map((s: any) => {
                    const variants = s.page_section_variants || [];
                    return (
                      <div key={s.id} className="rounded-md border border-border overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                          <div className="flex items-center gap-2">
                            {s.status === "approved" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-cos-success" />
                            ) : (
                              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="text-xs font-medium">{sectionLabels[s.section_type] || s.section_type}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{variants.length} variantes</span>
                        </div>
                        {variants.length > 0 && (
                          <div className="divide-y divide-border">
                            {variants.map((v: any) => (
                              <div key={v.id} className={`px-3 py-2 text-xs hover:bg-secondary/20 transition-colors ${s.selected_variant_id === v.id ? "bg-cos-success/5 border-l-2 border-l-cos-success" : ""}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    {v.headline && <p className="font-semibold truncate">{v.headline}</p>}
                                    {v.body && <p className="text-muted-foreground line-clamp-2 mt-0.5">{v.body}</p>}
                                    {v.cta && <p className="text-primary font-medium mt-0.5">{v.cta}</p>}
                                  </div>
                                  {s.selected_variant_id !== v.id && (
                                    <button
                                      onClick={() => approveVariant(s.id, v.id)}
                                      className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-cos-success bg-cos-success/10 hover:bg-cos-success/20 transition-colors"
                                    >
                                      Aprovar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {variants.length === 0 && (
                          <p className="px-3 py-2 text-[10px] text-muted-foreground italic">Clique em "Assembler" para gerar variantes</p>
                        )}
                      </div>
                    );
                  })}
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
