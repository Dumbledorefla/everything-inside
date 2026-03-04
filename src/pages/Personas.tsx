import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Sparkles, Star, Loader2, Check, RotateCcw, ImagePlus, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAssistant } from "@/contexts/AssistantContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PersonaResult {
  id: string;
  imageUrl: string;
  title: string;
  personaType: string;
}

export default function Personas() {
  const { activeProjectId } = useAssistant();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [basePrompt, setBasePrompt] = useState("");
  const [variationPrompt, setVariationPrompt] = useState("");
  const [evalPrompt, setEvalPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingVariation, setGeneratingVariation] = useState(false);
  const [generatingEval, setGeneratingEval] = useState(false);

  // Fetch project to get main_influencer_asset_id
  const { data: project } = useQuery({
    queryKey: ["project-persona", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, main_influencer_asset_id")
        .eq("id", activeProjectId!)
        .single();
      return data;
    },
    enabled: !!activeProjectId,
  });

  // Fetch main influencer asset
  const { data: mainInfluencer } = useQuery({
    queryKey: ["main-influencer", project?.main_influencer_asset_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, final_render_url")
        .eq("id", project!.main_influencer_asset_id!)
        .single();
      return data;
    },
    enabled: !!project?.main_influencer_asset_id,
  });

  // Fetch persona candidates
  const { data: candidates = [] } = useQuery({
    queryKey: ["persona-candidates", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, final_render_url, persona_type, created_at")
        .eq("project_id", activeProjectId!)
        .eq("persona_type", "persona_candidate")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  // Fetch persona variations
  const { data: variations = [] } = useQuery({
    queryKey: ["persona-variations", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, final_render_url, persona_type, created_at")
        .eq("project_id", activeProjectId!)
        .eq("persona_type", "persona_variation")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  // Fetch evaluation personas
  const { data: evalPersonas = [] } = useQuery({
    queryKey: ["persona-evaluations", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, final_render_url, persona_type, created_at")
        .eq("project_id", activeProjectId!)
        .eq("persona_type", "persona_evaluation")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const handleGenerateBase = async () => {
    if (!basePrompt.trim() || !activeProjectId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("persona-generate", {
        body: { mode: "generate_base", project_id: activeProjectId, prompt: basePrompt, num_variations: 4 },
      });
      if (error) throw error;
      toast.success(`${data.count} candidatas geradas!`);
      queryClient.invalidateQueries({ queryKey: ["persona-candidates", activeProjectId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar personas");
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveInfluencer = async (assetId: string) => {
    if (!activeProjectId) return;
    try {
      const { error } = await supabase
        .from("projects")
        .update({ main_influencer_asset_id: assetId } as any)
        .eq("id", activeProjectId);
      if (error) throw error;
      toast.success("Influencer aprovada como principal!");
      queryClient.invalidateQueries({ queryKey: ["project-persona", activeProjectId] });
      queryClient.invalidateQueries({ queryKey: ["main-influencer"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao aprovar");
    }
  };

  const handleGenerateVariation = async () => {
    if (!variationPrompt.trim() || !mainInfluencer?.final_render_url || !activeProjectId) return;
    setGeneratingVariation(true);
    try {
      const { data, error } = await supabase.functions.invoke("persona-generate", {
        body: {
          mode: "generate_variation",
          project_id: activeProjectId,
          prompt: variationPrompt,
          reference_image_url: mainInfluencer.final_render_url,
          num_variations: 4,
        },
      });
      if (error) throw error;
      toast.success(`${data.count} variações geradas!`);
      queryClient.invalidateQueries({ queryKey: ["persona-variations", activeProjectId] });
      setVariationPrompt("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar variações");
    } finally {
      setGeneratingVariation(false);
    }
  };

  const handleGenerateEval = async () => {
    if (!evalPrompt.trim() || !activeProjectId) return;
    setGeneratingEval(true);
    try {
      const { data, error } = await supabase.functions.invoke("persona-generate", {
        body: { mode: "generate_evaluation", project_id: activeProjectId, prompt: evalPrompt, num_variations: 2 },
      });
      if (error) throw error;
      toast.success(`${data.count} personas geradas!`);
      queryClient.invalidateQueries({ queryKey: ["persona-evaluations", activeProjectId] });
      setEvalPrompt("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar persona");
    } finally {
      setGeneratingEval(false);
    }
  };

  const hasMainInfluencer = !!project?.main_influencer_asset_id && !!mainInfluencer;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Personas</h1>
          <p className="text-xs text-muted-foreground">Influenciadores virtuais e personas para avaliações</p>
        </div>
      </div>

      <Tabs defaultValue="influencer" className="space-y-6">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="influencer" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Star className="h-3.5 w-3.5" />
            Influencer do Projeto
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Users className="h-3.5 w-3.5" />
            Personas para Avaliação
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: Influencer do Projeto ═══ */}
        <TabsContent value="influencer" className="space-y-6">
          {hasMainInfluencer ? (
            /* Estado 3: Influencer aprovada */
            <div className="space-y-6">
              <div className="flex gap-6">
                <div className="shrink-0">
                  <div className="relative">
                    <img
                      src={mainInfluencer.final_render_url || ""}
                      alt="Influencer Principal"
                      className="w-48 h-48 object-cover rounded-2xl border-2 border-primary/30 shadow-lg"
                    />
                    <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground text-center font-medium">Influencer Principal</p>
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Gerar Variação</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Descreva uma nova cena para a mesma influencer
                    </p>
                    <Textarea
                      value={variationPrompt}
                      onChange={(e) => setVariationPrompt(e.target.value)}
                      placeholder="Ex: a mesma mulher, agora sorrindo e segurando um produto, em um estúdio com fundo rosa"
                      className="min-h-[80px] bg-secondary border-border text-sm"
                    />
                  </div>
                  <Button
                    onClick={handleGenerateVariation}
                    disabled={generatingVariation || !variationPrompt.trim()}
                    className="gap-2"
                  >
                    {generatingVariation ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {generatingVariation ? "Gerando variações..." : "Gerar Variação"}
                  </Button>
                </div>
              </div>

              {/* Galeria de variações */}
              {variations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Variações Geradas ({variations.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {variations.map((v: any) => (
                      <motion.div
                        key={v.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="group relative rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-all"
                      >
                        <img
                          src={v.final_render_url}
                          alt={v.title}
                          className="w-full aspect-square object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-[10px] text-white/80 truncate">{v.title}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trocar influencer */}
              <div className="pt-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    supabase.from("projects").update({ main_influencer_asset_id: null } as any).eq("id", activeProjectId!).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["project-persona", activeProjectId] });
                      toast.info("Influencer removida. Você pode gerar uma nova ou aprovar uma existente.");
                    });
                  }}
                  className="gap-2 text-xs"
                >
                  <RotateCcw className="h-3 w-3" />
                  Trocar Influencer
                </Button>
              </div>
            </div>
          ) : (
            /* Estado 1 & 2: Sem influencer ou com candidatas */
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Criar Influencer Virtual</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Descreva a influencer que você deseja criar. O sistema gerará 4 variações para você escolher.
                </p>
                <Textarea
                  value={basePrompt}
                  onChange={(e) => setBasePrompt(e.target.value)}
                  placeholder="Ex: mulher mística de 30 anos, pele morena, cabelos escuros longos, olhos verdes, para marca de tarot e espiritualidade"
                  className="min-h-[100px] bg-secondary border-border text-sm"
                />
                <Button onClick={handleGenerateBase} disabled={generating || !basePrompt.trim()} className="gap-2">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? "Gerando candidatas..." : "Gerar Influencer Base"}
                </Button>
              </div>

              {/* Candidatas */}
              {candidates.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Candidatas ({candidates.length}) — Clique para aprovar
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {candidates.map((c: any) => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative rounded-2xl overflow-hidden border border-border hover:border-primary/40 transition-all cursor-pointer"
                        onClick={() => handleApproveInfluencer(c.id)}
                      >
                        <img
                          src={c.final_render_url}
                          alt={c.title}
                          className="w-full aspect-[3/4] object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                          <div className="flex items-center gap-1.5 text-white text-xs font-medium">
                            <Check className="h-3.5 w-3.5" />
                            Aprovar como Principal
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ═══ TAB 2: Personas para Avaliação ═══ */}
        <TabsContent value="evaluation" className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Gerar Persona para Depoimento</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Crie personas realistas para uso em depoimentos, avaliações e provas sociais.
            </p>
            <Textarea
              value={evalPrompt}
              onChange={(e) => setEvalPrompt(e.target.value)}
              placeholder="Ex: homem de 50 anos, feliz, usando um chapéu, barba grisalha, sorriso largo"
              className="min-h-[80px] bg-secondary border-border text-sm"
            />
            <Button onClick={handleGenerateEval} disabled={generatingEval || !evalPrompt.trim()} className="gap-2">
              {generatingEval ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {generatingEval ? "Gerando..." : "Gerar Persona"}
            </Button>
          </div>

          {evalPersonas.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Personas Geradas ({evalPersonas.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {evalPersonas.map((p: any) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-all"
                  >
                    <img src={p.final_render_url} alt={p.title} className="w-full aspect-square object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-[10px] text-white/80 truncate">{p.title}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {evalPersonas.length === 0 && !generatingEval && (
            <div className="text-center py-16">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma persona gerada ainda</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Use o campo acima para criar sua primeira persona</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
