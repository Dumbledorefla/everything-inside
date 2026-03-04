import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Sparkles, Star, Loader2, Check, RotateCcw, ImagePlus, Users, Wand2, ChevronRight, ArrowLeft, Download, Copy } from "lucide-react";
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
const BODY_TYPE_OPTIONS = ["Atlético", "Médio", "Curvilíneo", "Robusto", "Magro"];
const EYE_COLOR_OPTIONS = ["Castanho", "Azul", "Verde", "Mel", "Cinza"];
const FACIAL_FEATURES_OPTIONS = ["Barba", "Bigode", "Sardas", "Óculos", "Tatuagem Facial", "Piercing"];

type CharacterAttributes = {
  ethnicity: string;
  apparentAge: string;
  hairColor: string;
  hairStyle: string;
  clothingStyle: string;
  bodyType: string;
  eyeColor: string;
  facialFeatures: string[];
};

const emptyAttributes = (): CharacterAttributes => ({
  ethnicity: "", apparentAge: "", hairColor: "", hairStyle: "", clothingStyle: "", bodyType: "", eyeColor: "", facialFeatures: [],
});

// ── Reusable Attribute Builder ──
function AttributeBuilder({ attributes, onChange }: { attributes: CharacterAttributes; onChange: (a: CharacterAttributes) => void }) {
  const set = (key: string, value: any) => onChange({ ...attributes, [key]: value });
  const selectFields = [
    { key: "ethnicity", label: "Etnia", options: ETHNICITY_OPTIONS },
    { key: "apparentAge", label: "Idade Aparente", options: AGE_OPTIONS },
    { key: "hairColor", label: "Cor do Cabelo", options: HAIR_COLOR_OPTIONS },
    { key: "hairStyle", label: "Estilo do Cabelo", options: HAIR_STYLE_OPTIONS },
    { key: "clothingStyle", label: "Estilo de Roupa", options: CLOTHING_OPTIONS },
    { key: "bodyType", label: "Tipo de Corpo", options: BODY_TYPE_OPTIONS },
    { key: "eyeColor", label: "Cor dos Olhos", options: EYE_COLOR_OPTIONS },
  ];

  const toggleFeature = (feature: string) => {
    const current = attributes.facialFeatures;
    const next = current.includes(feature) ? current.filter((f) => f !== feature) : [...current, feature];
    set("facialFeatures", next);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <User className="h-3 w-3 text-muted-foreground" />
        Construtor de Atributos
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {selectFields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
            <Select value={(attributes as any)[f.key]} onValueChange={(v) => set(f.key, v)}>
              <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {/* Facial features checkboxes */}
      <div className="space-y-2">
        <Label className="text-[10px] text-muted-foreground">Características Faciais</Label>
        <div className="flex flex-wrap gap-2">
          {FACIAL_FEATURES_OPTIONS.map((feature) => (
            <label key={feature} className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-pointer border transition-all",
              attributes.facialFeatures.includes(feature)
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground hover:border-primary/20"
            )}>
              <input
                type="checkbox"
                checked={attributes.facialFeatures.includes(feature)}
                onChange={() => toggleFeature(feature)}
                className="sr-only"
              />
              {feature}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Character Card with hover overlay ──
function CharacterCard({ asset, onAction, actionLabel, actionIcon: ActionIcon }: {
  asset: any; onAction?: () => void; actionLabel?: string; actionIcon?: any;
}) {
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!asset.final_render_url) return;
    try {
      const res = await fetch(asset.final_render_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${asset.title || "character"}.png`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Erro ao baixar"); }
  };

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(asset.final_render_url || "");
    toast.success("URL copiada!");
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="group relative rounded-2xl overflow-hidden border border-border hover:border-primary/40 transition-all cursor-pointer"
      onClick={onAction}>
      <img src={asset.final_render_url} alt={asset.title} className="w-full aspect-[3/4] object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 gap-2">
        {actionLabel && (
          <div className="flex items-center gap-1.5 text-white text-xs font-medium">
            {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />} {actionLabel}
          </div>
        )}
        <div className="flex gap-1.5">
          <button onClick={handleDownload} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/20 backdrop-blur-sm text-white text-[10px] hover:bg-white/30 transition-colors">
            <Download className="h-3 w-3" /> Baixar
          </button>
          <button onClick={handleCopyUrl} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/20 backdrop-blur-sm text-white text-[10px] hover:bg-white/30 transition-colors">
            <Copy className="h-3 w-3" /> URL
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty state ──
function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="text-center py-16 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent rounded-2xl pointer-events-none" />
      <div className="relative">
        <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-8 w-8 text-primary/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

// ── Description + AI Suggestion block ──
function DescriptionBlock({ prompt, setPrompt, suggesting, onSuggest, placeholder }: {
  prompt: string; setPrompt: (v: string) => void; suggesting: boolean; onSuggest: () => void; placeholder: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Descreva o Personagem</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onSuggest} disabled={suggesting} className="gap-2 text-xs h-8">
          {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          Gerar Sugestão com IA
        </Button>
      </div>
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={placeholder}
        className="min-h-[100px] bg-secondary border-border text-sm" />
    </>
  );
}

export default function Characters() {
  const { activeProjectId } = useAssistant();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [basePrompt, setBasePrompt] = useState("");
  const [variationPrompt, setVariationPrompt] = useState("");
  const [evalPrompt, setEvalPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingVariation, setGeneratingVariation] = useState(false);
  const [generatingEval, setGeneratingEval] = useState(false);
  const [suggestingPrompt, setSuggestingPrompt] = useState(false);
  const [suggestingEvalPrompt, setSuggestingEvalPrompt] = useState(false);

  const [attributes, setAttributes] = useState<CharacterAttributes>(emptyAttributes());
  const [evalAttributes, setEvalAttributes] = useState<CharacterAttributes>(emptyAttributes());

  // ── Queries ──
  const { data: project } = useQuery({
    queryKey: ["project-character", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name, main_influencer_asset_id").eq("id", activeProjectId!).single();
      return data;
    },
    enabled: !!activeProjectId,
  });

  const { data: mainInfluencer } = useQuery({
    queryKey: ["main-influencer", project?.main_influencer_asset_id],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("id, title, final_render_url").eq("id", project!.main_influencer_asset_id!).single();
      return data;
    },
    enabled: !!project?.main_influencer_asset_id,
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["character-candidates", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("id, title, final_render_url, persona_type, created_at")
        .eq("project_id", activeProjectId!).in("persona_type", ["character_candidate", "persona_candidate"]).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const { data: variations = [] } = useQuery({
    queryKey: ["character-variations", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("id, title, final_render_url, persona_type, created_at")
        .eq("project_id", activeProjectId!).in("persona_type", ["character_variation", "persona_variation"]).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const { data: evalCharacters = [] } = useQuery({
    queryKey: ["character-evaluations", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("id, title, final_render_url, persona_type, created_at")
        .eq("project_id", activeProjectId!).in("persona_type", ["character_evaluation", "persona_evaluation"]).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const hasMainInfluencer = !!project?.main_influencer_asset_id && !!mainInfluencer;
  const effectiveStep = hasMainInfluencer ? 3 : (candidates.length > 0 && step < 2) ? 1 : step;

  // ── Handlers ──
  const handleSuggestPrompt = async (target: "base" | "eval") => {
    if (!activeProjectId) return;
    const setter = target === "base" ? setSuggestingPrompt : setSuggestingEvalPrompt;
    setter(true);
    try {
      const { data, error } = await supabase.functions.invoke("character-generate", {
        body: { mode: "generate_prompt_suggestion", project_id: activeProjectId },
      });
      if (error) throw error;
      if (data?.suggestion) {
        if (target === "base") setBasePrompt(data.suggestion);
        else setEvalPrompt(data.suggestion);
        toast.success("Sugestão gerada com base no DNA do projeto!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar sugestão");
    } finally {
      setter(false);
    }
  };

  const handleGenerateBase = async () => {
    if (!basePrompt.trim() || !activeProjectId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("character-generate", {
        body: { mode: "generate_base", project_id: activeProjectId, prompt: basePrompt, num_variations: 4, character_attributes: attributes },
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
      const { error } = await supabase.from("projects").update({ main_influencer_asset_id: assetId } as any).eq("id", activeProjectId);
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
        body: { mode: "generate_variation", project_id: activeProjectId, prompt: variationPrompt, reference_image_url: mainInfluencer.final_render_url, num_variations: 4 },
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
        body: { mode: "generate_evaluation", project_id: activeProjectId, prompt: evalPrompt, num_variations: 2, character_attributes: evalAttributes },
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
    toast.info("Personagem removido.");
    setStep(1);
  };

  // ── Step Indicator ──
  const StepIndicator = () => (
    <div className="flex items-center gap-1 mb-6">
      {[
        { n: 1, label: "Descrever" },
        { n: 2, label: "Aprovar" },
        { n: 3, label: "Variações" },
      ].map((s, i) => (
        <div key={s.n} className="flex items-center gap-1">
          {i > 0 && <div className={cn("h-px w-8 transition-colors", effectiveStep > i ? "bg-primary/50" : "bg-border")} />}
          <div className={cn(
            "flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-bold transition-all",
            effectiveStep === s.n ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
              : effectiveStep > s.n ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
          )}>
            {effectiveStep > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
          </div>
          <span className={cn("text-[11px] font-medium hidden sm:inline", effectiveStep === s.n ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
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
            <Star className="h-3.5 w-3.5" /> Personagem do Projeto
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Users className="h-3.5 w-3.5" /> Personagens para Avaliação
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: Influencer ═══ */}
        <TabsContent value="influencer" className="space-y-6">
          <StepIndicator />
          <AnimatePresence mode="wait">
            {effectiveStep === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                  <DescriptionBlock prompt={basePrompt} setPrompt={setBasePrompt} suggesting={suggestingPrompt}
                    onSuggest={() => handleSuggestPrompt("base")}
                    placeholder="Ex: mulher mística de 30 anos, pele morena, cabelos escuros longos, olhos verdes, para marca de tarot" />
                  <AttributeBuilder attributes={attributes} onChange={setAttributes} />
                  <Button onClick={handleGenerateBase} disabled={generating || !basePrompt.trim()} className="gap-2 h-10">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {generating ? "Gerando candidatos..." : "Gerar Candidatos"}
                  </Button>
                </div>
                {candidates.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">Candidatos Anteriores ({candidates.length})</h3>
                      <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="gap-1 text-xs text-primary">
                        Ver todos <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {candidates.slice(0, 4).map((c: any) => (
                        <CharacterCard key={c.id} asset={c} onAction={() => handleApproveInfluencer(c.id)} actionLabel="Aprovar" actionIcon={Check} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

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
                        <CharacterCard key={c.id} asset={c} onAction={() => handleApproveInfluencer(c.id)} actionLabel="Aprovar como Principal" actionIcon={Check} />
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

            {effectiveStep === 3 && hasMainInfluencer && (
              <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                <div className="flex gap-6">
                  <div className="shrink-0">
                    <div className="relative">
                      <img src={mainInfluencer!.final_render_url || ""} alt="Personagem Principal" className="w-48 h-48 object-cover rounded-2xl border-2 border-primary/30 shadow-lg" />
                      <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground text-center font-medium">Personagem Principal</p>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">Gerar Variação</h3>
                      <p className="text-xs text-muted-foreground mb-3">Descreva uma nova cena para o mesmo personagem</p>
                      <Textarea value={variationPrompt} onChange={(e) => setVariationPrompt(e.target.value)}
                        placeholder="Ex: o mesmo personagem, agora sorrindo e segurando um produto, em um estúdio com fundo rosa"
                        className="min-h-[80px] bg-secondary border-border text-sm" />
                    </div>
                    <Button onClick={handleGenerateVariation} disabled={generatingVariation || !variationPrompt.trim()} className="gap-2 h-10">
                      {generatingVariation ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {generatingVariation ? "Gerando variações..." : "Gerar Variação"}
                    </Button>
                  </div>
                </div>
                {variations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Variações Geradas ({variations.length})</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {variations.map((v: any) => <CharacterCard key={v.id} asset={v} />)}
                    </div>
                  </div>
                )}
                <div className="pt-4 border-t border-border">
                  <Button variant="outline" size="sm" onClick={handleResetInfluencer} className="gap-2 text-xs">
                    <RotateCcw className="h-3 w-3" /> Trocar Personagem
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ═══ TAB 2: Avaliação ═══ */}
        <TabsContent value="evaluation" className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Gerar Personagem para Depoimento</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Crie personagens realistas para uso em depoimentos, avaliações e provas sociais.
            </p>
            <DescriptionBlock prompt={evalPrompt} setPrompt={setEvalPrompt} suggesting={suggestingEvalPrompt}
              onSuggest={() => handleSuggestPrompt("eval")}
              placeholder="Ex: homem de 50 anos, feliz, barba grisalha, sorriso largo, cliente satisfeito" />
            <AttributeBuilder attributes={evalAttributes} onChange={setEvalAttributes} />
            <Button onClick={handleGenerateEval} disabled={generatingEval || !evalPrompt.trim()} className="gap-2 h-10">
              {generatingEval ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {generatingEval ? "Gerando..." : "Gerar Personagem para Avaliação"}
            </Button>
          </div>

          {evalCharacters.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Personagens Gerados ({evalCharacters.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {evalCharacters.map((p: any) => <CharacterCard key={p.id} asset={p} />)}
              </div>
            </div>
          )}

          {evalCharacters.length === 0 && !generatingEval && (
            <EmptyState icon={Users} title="Nenhum personagem de avaliação gerado" subtitle="Descreva acima, configure os atributos e clique em gerar" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
