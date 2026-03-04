import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Sparkles, Star, Loader2, Check, RotateCcw, ImagePlus, Users, Wand2, ChevronRight, ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAssistant } from "@/contexts/AssistantContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ETHNICITY_OPTIONS = ["Caucasiano", "Asiático", "Afro-americano", "Hispânico", "Indígena", "Árabe", "Misto"];
const AGE_OPTIONS = ["18-24 anos", "25-30 anos", "30-40 anos", "40-50 anos", "50+ anos"];
const HAIR_COLOR_OPTIONS = ["Preto", "Castanho", "Loiro", "Ruivo", "Grisalho", "Colorido"];
const HAIR_STYLE_OPTIONS = ["Curto", "Médio", "Longo", "Cacheado", "Liso", "Ondulado", "Careca"];
const CLOTHING_OPTIONS = ["Moderno", "Casual", "Corporativo", "Fitness", "Místico", "Elegante", "Streetwear"];

export default function Characters() {
  const { activeProjectId } = useAssistant();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  // Wizard step: 1=describe, 2=approve, 3=variations
  const [step, setStep] = useState(1);
  const [basePrompt, setBasePrompt] = useState("");
  const [variationPrompt, setVariationPrompt] = useState("");
  const [evalPrompt, setEvalPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingVariation, setGeneratingVariation] = useState(false);
  const [generatingEval, setGeneratingEval] = useState(false);
  const [suggestingPrompt, setSuggestingPrompt] = useState(false);

  const [attributes, setAttributes] = useState({
    ethnicity: "",
    apparentAge: "",
    hairColor: "",
    hairStyle: "",
    clothingStyle: "",
  });

  const { data: project } = useQuery({
    queryKey: ["project-character", activeProjectId],
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

  const { data: candidates = [] } = useQuery({
    queryKey: ["character-candidates", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, final_render_url, persona_type, created_at")
        .eq("project_id", activeProjectId!)
        .in("persona_type", ["character_candidate", "persona_candidate"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const { data: variations = [] } = useQuery({
    queryKey: ["character-variations", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, final_render_url, persona_type, created_at")
        .eq("project_id", activeProjectId!)
        .in("persona_type", ["character_variation", "persona_variation"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const { data: evalCharacters = [] } = useQuery({
    queryKey: ["character-evaluations", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, final_render_url, persona_type, created_at")
        .eq("project_id", activeProjectId!)
        .in("persona_type", ["character_evaluation", "persona_evaluation"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const hasMainInfluencer = !!project?.main_influencer_asset_id && !!mainInfluencer;

  // Determine initial step based on state
  const effectiveStep = hasMainInfluencer ? 3 : (candidates.length > 0 && step < 2) ? 1 : step;

  const handleSuggestPrompt = async () => {
    if (!activeProjectId) return;
    setSuggestingPrompt(true);
    try {
      const { data, error } = await supabase.functions.invoke("character-generate", {
        body: { mode: "generate_prompt_suggestion", project_id: activeProjectId },
      });
      if (error) throw error;
      if (data?.suggestion) {
        setBasePrompt(data.suggestion);
        toast.success("Sugestão gerada com base no DNA do projeto!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar sugestão");
    } finally {
      setSuggestingPrompt(false);
    }
  };

  const handleGenerateBase = async () => {
    if (!basePrompt.trim() || !activeProjectId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("character-generate", {
        body: {
          mode: "generate_base",
          project_id: activeProjectId,
          prompt: basePrompt,
          num_variations: 4,
          character_attributes: attributes,
        },
      });
      if (error) throw error;
      toast.success(`${data.count} candidatos gerados!`);
      queryClient.invalidateQueries({ queryKey: ["character-candidates", activeProjectId] });
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar personagens");
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
      toast.success("Personagem aprovado como principal!");
      queryClient.invalidateQueries({ queryKey: ["project-character", activeProjectId] });
      queryClient.invalidateQueries({ queryKey: ["main-influencer"] });
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Erro ao aprovar");
    }
  };

  const handleGenerateVariation = async () => {
    if (!variationPrompt.trim() || !mainInfluencer?.final_render_url || !activeProjectId) return;
    setGeneratingVariation(true);
    try {
      const { data, error } = await supabase.functions.invoke("character-generate", {
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
      queryClient.invalidateQueries({ queryKey: ["character-variations", activeProjectId] });
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
      const { data, error } = await supabase.functions.invoke("character-generate", {
        body: { mode: "generate_evaluation", project_id: activeProjectId, prompt: evalPrompt, num_variations: 2 },
      });
      if (error) throw error;
      toast.success(`${data.count} personagens gerados!`);
      queryClient.invalidateQueries({ queryKey: ["character-evaluations", activeProjectId] });
      setEvalPrompt("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar personagem");
    } finally {
      setGeneratingEval(false);
    }
  };

  const handleResetInfluencer = async () => {
    if (!activeProjectId) return;
    await supabase.from("projects").update({ main_influencer_asset_id: null } as any).eq("id", activeProjectId);
    queryClient.invalidateQueries({ queryKey: ["project-character", activeProjectId] });
    toast.info("Personagem removido. Você pode gerar um novo ou aprovar um existente.");
    setStep(1);
  };

  // Step indicator
  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {[
        { n: 1, label: "Descrever" },
        { n: 2, label: "Aprovar" },
        { n: 3, label: "Variações" },
      ].map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          {i > 0 && <div className="h-px w-6 bg-border" />}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
            effectiveStep === s.n
              ? "bg-primary/10 text-primary border border-primary/30"
              : effectiveStep > s.n
                ? "bg-primary/5 text-primary/60"
                : "bg-secondary text-muted-foreground"
          )}>
            {effectiveStep > s.n ? <Check className="h-3 w-3" /> : <span className="text-[10px]">{s.n}</span>}
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Personagens</h1>
          <p className="text-xs text-muted-foreground">Influenciadores virtuais e personagens para avaliações</p>
        </div>
      </div>

      <Tabs defaultValue="influencer" className="space-y-6">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="influencer" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Star className="h-3.5 w-3.5" />
            Personagem do Projeto
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Users className="h-3.5 w-3.5" />
            Personagens para Avaliação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="influencer" className="space-y-6">
          <StepIndicator />

          <AnimatePresence mode="wait">
            {/* ═══ STEP 1: Describe Character ═══ */}
            {effectiveStep === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Descreva seu Personagem</h3>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleSuggestPrompt} disabled={suggestingPrompt} className="gap-2 text-xs">
                      {suggestingPrompt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                      Gerar Sugestão com IA
                    </Button>
                  </div>

                  <Textarea
                    value={basePrompt}
                    onChange={(e) => setBasePrompt(e.target.value)}
                    placeholder="Ex: mulher mística de 30 anos, pele morena, cabelos escuros longos, olhos verdes, para marca de tarot e espiritualidade"
                    className="min-h-[100px] bg-secondary border-border text-sm"
                  />

                  {/* Attribute Builder */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <User className="h-3 w-3 text-muted-foreground" />
                      Construtor de Atributos
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Etnia</Label>
                        <Select value={attributes.ethnicity} onValueChange={(v) => setAttributes((a) => ({ ...a, ethnicity: v }))}>
                          <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>{ETHNICITY_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Idade Aparente</Label>
                        <Select value={attributes.apparentAge} onValueChange={(v) => setAttributes((a) => ({ ...a, apparentAge: v }))}>
                          <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>{AGE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Cor do Cabelo</Label>
                        <Select value={attributes.hairColor} onValueChange={(v) => setAttributes((a) => ({ ...a, hairColor: v }))}>
                          <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>{HAIR_COLOR_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Estilo do Cabelo</Label>
                        <Select value={attributes.hairStyle} onValueChange={(v) => setAttributes((a) => ({ ...a, hairStyle: v }))}>
                          <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>{HAIR_STYLE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Estilo de Roupa</Label>
                        <Select value={attributes.clothingStyle} onValueChange={(v) => setAttributes((a) => ({ ...a, clothingStyle: v }))}>
                          <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>{CLOTHING_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleGenerateBase} disabled={generating || !basePrompt.trim()} className="gap-2">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {generating ? "Gerando candidatos..." : "Gerar Candidatos"}
                  </Button>
                </div>

                {/* Show existing candidates if any */}
                {candidates.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        Candidatos Anteriores ({candidates.length})
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="gap-1 text-xs text-primary">
                        Ver todos <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {candidates.slice(0, 4).map((c: any) => (
                        <div key={c.id} className="rounded-xl overflow-hidden border border-border cursor-pointer hover:border-primary/30 transition-all" onClick={() => handleApproveInfluencer(c.id)}>
                          <img src={c.final_render_url} alt={c.title} className="w-full aspect-[3/4] object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ STEP 2: Approve Candidate ═══ */}
            {effectiveStep === 2 && !hasMainInfluencer && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1 text-xs text-muted-foreground">
                  <ArrowLeft className="h-3 w-3" /> Voltar para descrição
                </Button>

                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Aprove o Melhor Candidato</h3>
                  <p className="text-xs text-muted-foreground mb-4">Clique no personagem que melhor representa sua marca</p>

                  {candidates.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {candidates.map((c: any) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="group relative rounded-2xl overflow-hidden border border-border hover:border-primary/40 transition-all cursor-pointer"
                          onClick={() => handleApproveInfluencer(c.id)}
                        >
                          <img src={c.final_render_url} alt={c.title} className="w-full aspect-[3/4] object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <div className="flex items-center gap-1.5 text-white text-xs font-medium">
                              <Check className="h-3.5 w-3.5" />
                              Aprovar como Principal
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Loader2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3 animate-spin" />
                      <p className="text-xs text-muted-foreground">Gerando candidatos...</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ═══ STEP 3: Variations ═══ */}
            {effectiveStep === 3 && hasMainInfluencer && (
              <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                <div className="flex gap-6">
                  <div className="shrink-0">
                    <div className="relative">
                      <img
                        src={mainInfluencer!.final_render_url || ""}
                        alt="Personagem Principal"
                        className="w-48 h-48 object-cover rounded-2xl border-2 border-primary/30 shadow-lg"
                      />
                      <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground text-center font-medium">Personagem Principal</p>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">Gerar Variação</h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Descreva uma nova cena para o mesmo personagem
                      </p>
                      <Textarea
                        value={variationPrompt}
                        onChange={(e) => setVariationPrompt(e.target.value)}
                        placeholder="Ex: o mesmo personagem, agora sorrindo e segurando um produto, em um estúdio com fundo rosa"
                        className="min-h-[80px] bg-secondary border-border text-sm"
                      />
                    </div>
                    <Button onClick={handleGenerateVariation} disabled={generatingVariation || !variationPrompt.trim()} className="gap-2">
                      {generatingVariation ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {generatingVariation ? "Gerando variações..." : "Gerar Variação"}
                    </Button>
                  </div>
                </div>

                {variations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Variações Geradas ({variations.length})</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {variations.map((v: any) => (
                        <motion.div key={v.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                          className="group relative rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-all">
                          <img src={v.final_render_url} alt={v.title} className="w-full aspect-square object-cover" />
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-[10px] text-white/80 truncate">{v.title}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <Button variant="outline" size="sm" onClick={handleResetInfluencer} className="gap-2 text-xs">
                    <RotateCcw className="h-3 w-3" />
                    Trocar Personagem
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ═══ TAB 2: Personagens para Avaliação ═══ */}
        <TabsContent value="evaluation" className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Gerar Personagem para Depoimento</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Crie personagens realistas para uso em depoimentos, avaliações e provas sociais.
            </p>
            <Textarea
              value={evalPrompt}
              onChange={(e) => setEvalPrompt(e.target.value)}
              placeholder="Ex: homem de 50 anos, feliz, usando um chapéu, barba grisalha, sorriso largo"
              className="min-h-[80px] bg-secondary border-border text-sm"
            />
            <Button onClick={handleGenerateEval} disabled={generatingEval || !evalPrompt.trim()} className="gap-2">
              {generatingEval ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {generatingEval ? "Gerando..." : "Gerar Personagem"}
            </Button>
          </div>

          {evalCharacters.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Personagens Gerados ({evalCharacters.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {evalCharacters.map((p: any) => (
                  <motion.div key={p.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="group relative rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-all">
                    <img src={p.final_render_url} alt={p.title} className="w-full aspect-square object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-[10px] text-white/80 truncate">{p.title}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {evalCharacters.length === 0 && !generatingEval && (
            <div className="text-center py-16">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum personagem de avaliação gerado</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Descreva acima e clique em gerar</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
