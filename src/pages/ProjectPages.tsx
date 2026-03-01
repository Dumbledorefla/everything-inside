import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, Loader2, ChevronRight, Layout, Play, Download, Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import SectionList from "@/components/pages/SectionList";
import VariantInspector from "@/components/pages/VariantInspector";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

const pageTypeLabels: Record<string, string> = {
  sales: "Página de Vendas", landing: "Landing Page", vsl: "VSL", presell: "Presell",
  advertorial: "Advertorial", checkout: "Checkout", thankyou: "Obrigado", ecommerce: "E-commerce",
};

export default function ProjectPages() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("sales");
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
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

  // Create page via edge function (LLM outline)
  const createPage = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("page-assembler", {
        body: { action: "outline", projectId, pageType: newType, pageName: newName || undefined },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pages", projectId] });
      setShowCreate(false);
      setNewName("");
      toast.success(`Página criada com ${data.outline?.length || 0} seções (outline IA)`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Generate variants for a single section
  const generateSection = async (sectionId: string) => {
    setGeneratingSection(sectionId);
    try {
      const { error } = await supabase.functions.invoke("page-assembler", {
        body: { action: "generate-section", projectId, sectionId },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["pages", projectId] });
      toast.success("3 variantes geradas para a seção");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGeneratingSection(null);
    }
  };

  // Assemble all sections at once
  const assemblePage = async (pageId: string) => {
    setAssembling(pageId);
    try {
      const page = pages?.find((p: any) => p.id === pageId);
      const sections = ((page as any)?.page_sections || []).filter((s: any) => (s.page_section_variants?.length || 0) === 0);
      
      let generated = 0;
      for (const s of sections) {
        try {
          await supabase.functions.invoke("page-assembler", {
            body: { action: "generate-section", projectId, sectionId: s.id },
          });
          generated++;
        } catch (e) {
          console.error(`Section ${s.section_type} failed:`, e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["pages", projectId] });
      toast.success(`Assembler: ${generated} seções geradas com variantes`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAssembling(null);
    }
  };

  // Export page JSON
  const exportPage = async (pageId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("page-assembler", {
        body: { action: "export", pageId },
      });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `page-${pageId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Página exportada como JSON");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Approve variant
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

  // Get selected section data
  const getSelectedSection = () => {
    if (!expandedPage || !selectedSectionId) return null;
    const page = pages?.find((p: any) => p.id === expandedPage);
    const sections = (page as any)?.page_sections || [];
    return sections.find((s: any) => s.id === selectedSectionId) || null;
  };

  const selectedSection = getSelectedSection();

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Páginas</h1>
          <p className="text-xs text-muted-foreground mt-1">Outline IA → Geração por seção → Assembly → Export JSON</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-3.5 w-3.5" />Nova Página
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border border-primary/30 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />Criar Página (Outline IA)
          </h3>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da página" className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs focus:border-primary focus:outline-none">
            {Object.entries(pageTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => createPage.mutate()} disabled={createPage.isPending} className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
              {createPage.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar com IA"}
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary">Cancelar</button>
          </div>
        </motion.div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {/* Page list */}
      <div className="space-y-4">
        {pages?.map((page: any, i: number) => {
          const sections = (page.page_sections || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
          const isExpanded = expandedPage === page.id;
          const isAssembling = assembling === page.id;
          const totalVariants = sections.reduce((s: number, sec: any) => s + (sec.page_section_variants?.length || 0), 0);
          const approvedCount = sections.filter((s: any) => s.status === "approved").length;
          const allApproved = approvedCount === sections.length && sections.length > 0;

          return (
            <motion.div key={page.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-lg border border-border bg-card overflow-hidden">
              {/* Page header */}
              <div className="flex items-center justify-between p-4">
                <button onClick={() => { setExpandedPage(isExpanded ? null : page.id); setSelectedSectionId(null); }} className="flex items-center gap-3 text-left flex-1">
                  <Layout className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{page.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {pageTypeLabels[page.page_type] || page.page_type} · {sections.length} seções · {totalVariants} variantes · {approvedCount}/{sections.length} aprovadas
                    </p>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>
                <div className="flex items-center gap-2">
                  {allApproved && (
                    <button
                      onClick={() => exportPage(page.id)}
                      className="flex items-center gap-1.5 rounded-md bg-green-600/10 px-3 py-1.5 text-[11px] font-medium text-green-600 hover:bg-green-600/20 transition-colors"
                    >
                      <Download className="h-3 w-3" />Export JSON
                    </button>
                  )}
                  <button
                    onClick={() => assemblePage(page.id)}
                    disabled={isAssembling}
                    className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {isAssembling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {isAssembling ? "Montando..." : "Assembler"}
                  </button>
                </div>
              </div>

              {/* Split view: sections + variant inspector */}
              {isExpanded && (
                <div className="border-t border-border" style={{ height: 420 }}>
                  <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={35} minSize={25}>
                      <div className="h-full overflow-auto p-3">
                        <SectionList
                          sections={sections}
                          selectedSectionId={selectedSectionId}
                          onSelect={setSelectedSectionId}
                          generatingSection={generatingSection}
                          onGenerateSection={generateSection}
                        />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={65} minSize={40}>
                      {selectedSection ? (
                        <VariantInspector
                          section={selectedSection}
                          onApprove={approveVariant}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                          <FileText className="h-8 w-8 text-muted-foreground/20 mb-3" />
                          <p className="text-xs text-muted-foreground">Selecione uma seção para inspecionar variantes</p>
                        </div>
                      )}
                    </ResizablePanel>
                  </ResizablePanelGroup>
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
