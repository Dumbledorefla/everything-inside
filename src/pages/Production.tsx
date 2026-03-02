import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Image, Type, FileText, Sparkles, Layers,
  LayoutGrid, Rows3, Loader2, GalleryHorizontalEnd,
  Check, RotateCcw, ChevronRight,
} from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LayerEditor, { type TextLayer } from "@/components/creative/LayerEditor";
import OperationModeSelector, { MODE_PIECE_TYPES, MODE_RATIOS, type OperationMode } from "@/components/production/OperationModeSelector";
import SmartPromptInput from "@/components/production/SmartPromptInput";
import CanvasOverlay from "@/components/production/CanvasOverlay";
import HistoryPanel from "@/components/production/HistoryPanel";
import ShimmerCanvas from "@/components/production/ShimmerCanvas";
import { useBatchGenerate, type BatchResult } from "@/hooks/useBatchGenerate";
import { useCarouselGenerate } from "@/hooks/useCarouselGenerate";
import { cn } from "@/lib/utils";

const PIECE_ICONS: Record<string, React.ElementType> = {
  post: LayoutGrid, banner: Rows3, story: FileText, ad: Sparkles,
  thumbnail: Image, vsl: Type, carousel: GalleryHorizontalEnd,
  logo: Sparkles, palette: Sparkles, typography: Type, brand_manual: FileText,
  highlight: Image, hero_banner: Rows3, ecommerce_banner: LayoutGrid, lp_section: Layers,
};

const profileLabels: Record<string, string> = {
  economy: "Economia", standard: "Padrão", quality: "Qualidade",
};

const profileColors: Record<string, string> = {
  economy: "bg-cos-warning/10 text-cos-warning border-cos-warning/20",
  standard: "bg-primary/10 text-primary border-primary/20",
  quality: "bg-cos-purple/10 text-cos-purple border-cos-purple/20",
};

const roleLabels: Record<string, string> = {
  hook: "🎣 Gancho", problem: "😰 Problema", agitation: "🔥 Agitação",
  solution: "💡 Solução", benefit: "✨ Benefício", content: "📖 Conteúdo",
  recap: "📋 Resumo", conflict: "⚔️ Conflito", epiphany: "💎 Epifania",
  proof: "📊 Prova", cta: "🎯 CTA",
};

const formulaOptions = [
  { id: "pas" as const, label: "PAS", desc: "Dor → Solução", icon: "🔥" },
  { id: "tutorial" as const, label: "Tutorial", desc: "Lista/Dicas", icon: "📚" },
  { id: "hero_journey" as const, label: "Jornada", desc: "Storytelling", icon: "🦸" },
];

const MODE_LABELS: Record<OperationMode, string> = {
  foundation: "Fundação", social: "Social", performance: "Performance",
};

const TEXT_PROVIDER_OPTIONS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini Flash" },
  { value: "google/gemini-2.5-pro", label: "Gemini Pro" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini Lite" },
];

const IMAGE_PROVIDER_OPTIONS = [
  { value: "google/gemini-2.5-flash-image", label: "Nano Banana" },
  { value: "google/gemini-3-pro-image-preview", label: "Nano Banana Pro" },
];

export default function Production() {
  const { spec, setSpec, selectAsset, activeProjectId } = useAssistant();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { results, progress, generate, cancel } = useBatchGenerate();
  const carousel = useCarouselGenerate();
  const [userPrompt, setUserPrompt] = useState("");
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [carouselTopic, setCarouselTopic] = useState("");
  const [carouselSlideCount, setCarouselSlideCount] = useState(5);
  const [activeEditorSlide, setActiveEditorSlide] = useState<number | null>(null);
  const [carouselLayerStyles, setCarouselLayerStyles] = useState<Record<number, TextLayer[]>>({});
  const [refining, setRefining] = useState(false);

  const [operationMode, setOperationModeLocal] = useState<OperationMode>("social");

  const { data: projectData } = useQuery({
    queryKey: ["project-mode", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("operation_mode, niche")
        .eq("id", activeProjectId!)
        .single();
      return data;
    },
    enabled: !!activeProjectId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (projectData?.operation_mode) {
      setOperationModeLocal(projectData.operation_mode as OperationMode);
    }
  }, [projectData]);

  const modeMutation = useMutation({
    mutationFn: async (mode: OperationMode) => {
      await supabase.from("projects").update({ operation_mode: mode }).eq("id", activeProjectId!);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-mode", activeProjectId] }),
  });

  const setOperationMode = (mode: OperationMode) => {
    setOperationModeLocal(mode);
    if (activeProjectId) modeMutation.mutate(mode);
    const firstPiece = MODE_PIECE_TYPES[mode][0];
    if (firstPiece) setSpec({ pieceType: firstPiece.id });
  };

  const availablePieceTypes = MODE_PIECE_TYPES[operationMode];
  const availableRatios = MODE_RATIOS[operationMode];
  const isCarousel = spec.pieceType === "carousel";

  const providerOptions = spec.output === "text"
    ? TEXT_PROVIDER_OPTIONS
    : spec.output === "image"
      ? IMAGE_PROVIDER_OPTIONS
      : [];

  useEffect(() => {
    const invalidForCurrentOutput =
      (spec.output === "both" && spec.provider !== "Auto") ||
      ((spec.output === "image" || spec.output === "both") && TEXT_PROVIDER_OPTIONS.some((p) => p.value === spec.provider));

    if (invalidForCurrentOutput) {
      setSpec({ provider: "Auto" });
    }
  }, [spec.output, spec.provider, setSpec]);

  useEffect(() => {
    if (!availableRatios.includes(spec.ratio)) {
      setSpec({ ratio: availableRatios[0] });
    }
  }, [operationMode]);

  // Auto-select latest result for canvas
  useEffect(() => {
    if (results.length > 0 && !selectedResultId) {
      setSelectedResultId(results[0].id);
    }
  }, [results]);

  const selectedResult = results.find((r) => r.id === selectedResultId) || null;

  const handleApplyToAll = useCallback((layers: TextLayer[]) => {
    if (!carousel.slides.length) return;
    const styleMap: Record<number, TextLayer[]> = {};
    for (const slide of carousel.slides) {
      const existing = carouselLayerStyles[slide.slideNumber];
      styleMap[slide.slideNumber] = layers.map((l) => {
        const match = existing?.find((e) => e.type === l.type);
        return { ...l, content: match?.content || l.content, x: match?.x ?? l.x, y: match?.y ?? l.y };
      });
    }
    setCarouselLayerStyles(styleMap);
    toast.success(`Estilo aplicado a ${carousel.slides.length} slides!`);
  }, [carousel.slides, carouselLayerStyles]);

  const { data: projectDna } = useQuery({
    queryKey: ["project-dna-canvas", activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const [{ data: project }, { data: dna }] = await Promise.all([
        supabase.from("projects").select("niche").eq("id", activeProjectId).single(),
        supabase.from("project_dna").select("visual").eq("project_id", activeProjectId)
          .order("version", { ascending: false }).limit(1).single(),
      ]);
      const visual = dna?.visual as any;
      return {
        niche: project?.niche || null,
        logoUrl: visual?.logo_url || null,
        brandColors: visual?.cores ? { primary: visual.cores.split(",")[0]?.trim() } : null,
      };
    },
    enabled: !!activeProjectId,
    staleTime: 60_000,
  });

  const { data: references } = useQuery({
    queryKey: ["references-for-production", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reference_analyses")
        .select("id, visual_archetype, emotional_tone, image_url")
        .eq("project_id", activeProjectId!)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  const [selectedReferenceId, setSelectedReferenceId] = useState<string | undefined>();

  const currentPieceLabel = availablePieceTypes.find((t) => t.id === spec.pieceType)?.label || spec.pieceType;

  const handleRefinePrompt = async () => {
    if (!userPrompt.trim()) return;
    setRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke("cos-chat", {
        body: {
          messages: [
            { role: "system", content: "Você é um especialista em prompts de imagem. Receba um prompt simples e expanda com termos técnicos de fotografia, iluminação, composição e estilo visual. Responda APENAS com o prompt expandido, sem explicações." },
            { role: "user", content: userPrompt },
          ],
          projectId: activeProjectId,
        },
      });
      if (data?.reply) setUserPrompt(data.reply);
    } catch {
      toast.error("Erro ao refinar prompt");
    } finally {
      setRefining(false);
    }
  };

  const handleGenerate = async () => {
    if (!activeProjectId || !session) {
      toast.error("Você precisa estar logado em um projeto.");
      return;
    }
    setSelectedResultId(null);
    await generate({
      projectId: activeProjectId,
      mode: spec.mode,
      output: spec.output,
      pieceType: spec.pieceType,
      quantity: spec.quantity,
      profile: spec.profile,
      provider: spec.provider,
      destination: spec.destination,
      ratio: spec.ratio,
      intensity: spec.intensity,
      useModel: spec.useModel,
      useVisualProfile: spec.useVisualProfile,
      userPrompt: userPrompt || undefined,
      operationMode,
      formatLabel: currentPieceLabel,
    } as any);
  };

  const handleCarouselStoryline = async () => {
    if (!activeProjectId || !session) {
      toast.error("Você precisa estar logado em um projeto.");
      return;
    }
    await carousel.generateStoryline({
      projectId: activeProjectId,
      referenceId: selectedReferenceId,
      slideCount: carouselSlideCount,
      topic: carouselTopic || undefined,
      profile: spec.profile,
      ratio: spec.ratio,
    });
  };

  const handleCarouselGenerate = async () => {
    if (!activeProjectId) return;
    await carousel.generateSlides({
      projectId: activeProjectId,
      referenceId: selectedReferenceId,
      profile: spec.profile,
      ratio: spec.ratio,
    });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ═══════ LEFT PANEL — Config (20%) ═══════ */}
      <div className="w-[260px] shrink-0 border-r border-border/15 bg-card/10 backdrop-blur-sm overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Mode selector */}
          <OperationModeSelector mode={operationMode} onChange={setOperationMode} />

          {/* Piece type */}
          <div>
            <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-2 block">
              Formato · <span className="text-primary">{MODE_LABELS[operationMode]}</span>
            </label>
            <div className="grid grid-cols-3 gap-1">
              {availablePieceTypes.map((t) => {
                const Icon = PIECE_ICONS[t.id] || Sparkles;
                return (
                  <button key={t.id} onClick={() => { setSpec({ pieceType: t.id }); if (t.id !== "carousel") carousel.reset(); }}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-xl border py-2 text-[9px] transition-all",
                      spec.pieceType === t.id
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/15 text-muted-foreground/50 hover:border-primary/20 hover:text-foreground"
                    )}>
                    <Icon className="h-3 w-3" />{t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ratio */}
          <div>
            <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5 block">Proporção</label>
            <div className="flex gap-1 rounded-xl bg-background/30 p-0.5">
              {availableRatios.map((r) => (
                <button key={r} onClick={() => setSpec({ ratio: r })}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-[10px] font-mono-brand transition-all",
                    spec.ratio === r
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground/40 hover:text-foreground"
                  )}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Carousel-specific controls */}
          {isCarousel ? (
            <>
              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5 block">
                  Slides: <span className="text-primary font-semibold">{carouselSlideCount}</span>
                </label>
                <input type="range" min={3} max={10} value={carouselSlideCount}
                  onChange={(e) => setCarouselSlideCount(+e.target.value)}
                  className="w-full accent-primary h-1 rounded-full" />
              </div>

              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5 block">Tema</label>
                <textarea value={carouselTopic} onChange={(e) => setCarouselTopic(e.target.value)}
                  placeholder="Ex: 5 erros ao investir..."
                  rows={2} className="w-full rounded-xl border border-border/15 bg-background/30 px-3 py-2 text-xs placeholder:text-muted-foreground/30 focus:border-primary/40 focus:outline-none resize-none" />
              </div>

              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5 block">Fórmula</label>
                <div className="space-y-1">
                  {formulaOptions.map((f) => (
                    <button key={f.id} onClick={() => carousel.setFormula(f.id)}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all",
                        carousel.formula === f.id
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/15 text-muted-foreground/50 hover:border-primary/20"
                      )}>
                      <span className="text-sm">{f.icon}</span>
                      <div>
                        <p className="text-[10px] font-semibold leading-tight">{f.label}</p>
                        <p className="text-[8px] text-muted-foreground/40">{f.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {references && references.length > 0 && (
                <div>
                  <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5 block">Referência</label>
                  <select value={selectedReferenceId || ""} onChange={(e) => setSelectedReferenceId(e.target.value || undefined)}
                    className="w-full rounded-xl border border-border/15 bg-background/30 px-3 py-2 text-xs text-foreground focus:border-primary/40 focus:outline-none">
                    <option value="">Nenhuma</option>
                    {references.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.visual_archetype} — {r.emotional_tone}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Output type */}
              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5 block">Saída</label>
                <div className="flex gap-1">
                  {([
                    { id: "text" as const, label: "Texto", icon: Type },
                    { id: "image" as const, label: "Imagem", icon: Image },
                    { id: "both" as const, label: "Ambos", icon: Zap },
                  ]).map((o) => (
                    <button key={o.id} onClick={() => setSpec({ output: o.id })}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-0.5 rounded-xl border py-2 text-[9px] transition-all",
                        spec.output === o.id
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/15 text-muted-foreground/50 hover:border-primary/20"
                      )}>
                      <o.icon className="h-3 w-3" />{o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5 block">
                  Variações: <span className="text-primary font-semibold">{spec.quantity}</span>
                </label>
                <input type="range" min={1} max={50} value={spec.quantity} onChange={(e) => setSpec({ quantity: +e.target.value })}
                  className="w-full accent-primary h-1 rounded-full" />
              </div>

              {/* Profile */}
              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5 block">Perfil</label>
                <div className="flex gap-1 rounded-xl bg-background/30 p-0.5">
                  {(["economy", "standard", "quality"] as const).map((p) => (
                    <button key={p} onClick={() => setSpec({ profile: p })}
                      className={cn(
                        "flex-1 rounded-lg py-1.5 text-[10px] transition-all",
                        spec.profile === p
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-muted-foreground/40 hover:text-foreground"
                      )}>
                      {profileLabels[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider */}
              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1.5 block">
                  Provedor {spec.output === "image" ? "(imagem)" : spec.output === "text" ? "(texto)" : "(automático)"}
                </label>
                <select value={spec.provider} onChange={(e) => setSpec({ provider: e.target.value })}
                  className="w-full rounded-xl border border-border/15 bg-background/30 px-3 py-2 text-xs text-foreground focus:border-primary/40 focus:outline-none">
                  <option value="Auto">Auto (Fallback)</option>
                  {providerOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between rounded-xl border border-border/15 bg-background/30 px-3 py-2 text-[10px] text-muted-foreground/60 cursor-pointer hover:border-primary/15 transition-all">
                  Usar Modelo
                  <input type="checkbox" checked={spec.useModel} onChange={(e) => setSpec({ useModel: e.target.checked })} className="accent-primary" />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-border/15 bg-background/30 px-3 py-2 text-[10px] text-muted-foreground/60 cursor-pointer hover:border-primary/15 transition-all">
                  Perfil Visual
                  <input type="checkbox" checked={spec.useVisualProfile} onChange={(e) => setSpec({ useVisualProfile: e.target.checked })} className="accent-primary" />
                </label>
              </div>
            </>
          )}

          {/* Smart Prompt */}
          {!isCarousel && (
            <SmartPromptInput
              value={userPrompt}
              onChange={setUserPrompt}
              disabled={progress.running}
              onRefine={handleRefinePrompt}
              refining={refining}
            />
          )}

          {/* Generate button */}
          {isCarousel ? (
            <div className="space-y-2">
              {carousel.step === "idle" && (
                <motion.button onClick={handleCarouselStoryline}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                  <GalleryHorizontalEnd className="h-4 w-4" /> Gerar Roteiro
                </motion.button>
              )}
              {carousel.step === "generating-storyline" && (
                <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/50 py-2.5 text-sm text-primary-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Criando roteiro...
                </div>
              )}
              {carousel.step === "reviewing" && (
                <>
                  <motion.button onClick={handleCarouselGenerate}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                    <Check className="h-4 w-4" /> Aprovar e Gerar
                  </motion.button>
                  <button onClick={carousel.reset}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/15 py-2 text-[10px] text-muted-foreground/50 hover:text-foreground transition-all">
                    <RotateCcw className="h-3 w-3" /> Refazer
                  </button>
                </>
              )}
              {carousel.step === "generating-slides" && (
                <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/50 py-2.5 text-sm text-primary-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando slides...
                </div>
              )}
              {carousel.step === "done" && (
                <button onClick={carousel.reset}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/15 py-2 text-[10px] text-muted-foreground/50 hover:text-foreground transition-all">
                  <RotateCcw className="h-3 w-3" /> Novo Carrossel
                </button>
              )}
            </div>
          ) : (
            <motion.button onClick={handleGenerate} disabled={progress.running}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50">
              {progress.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {progress.running ? `${progress.completed}/${progress.total}` : "Gerar"}
            </motion.button>
          )}
        </div>
      </div>

      {/* ═══════ CENTER PANEL — Canvas (60%) ═══════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 h-10 border-b border-border/10 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/40">
              {MODE_LABELS[operationMode]}
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/20" />
            <span className="text-[10px] font-mono-brand text-foreground/70">{currentPieceLabel}</span>
            <span className="text-[10px] font-mono-brand text-muted-foreground/30 ml-1">{spec.ratio}</span>
          </div>
          {selectedResult && (
            <div className="flex items-center gap-2">
              <span className={cn("rounded-lg border px-2 py-0.5 text-[9px] font-mono-brand", profileColors[selectedResult.profile] || "")}>
                {profileLabels[selectedResult.profile] || selectedResult.profile}
              </span>
              <span className="text-[9px] font-mono-brand text-muted-foreground/30">{selectedResult.creditCost}cr</span>
            </div>
          )}
        </div>

        {/* Main canvas area */}
        <div className="flex-1 overflow-y-auto p-6">
          {isCarousel ? (
            <CarouselView
              carousel={carousel}
              spec={spec}
              roleLabels={roleLabels}
              projectDna={projectDna}
              carouselLayerStyles={carouselLayerStyles}
              setCarouselLayerStyles={setCarouselLayerStyles}
              activeEditorSlide={activeEditorSlide}
              setActiveEditorSlide={setActiveEditorSlide}
              handleApplyToAll={handleApplyToAll}
            />
          ) : (
            <>
              {progress.running ? (
                <ShimmerCanvas ratio={spec.ratio} progress={{ completed: progress.completed, total: progress.total }} />
              ) : showEditor && selectedResult ? (
                <div className="max-w-[600px] mx-auto">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/40">Editor de Camadas</p>
                    <button onClick={() => setShowEditor(false)} className="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors">
                      Fechar editor
                    </button>
                  </div>
                  <LayerEditor
                    imageUrl={selectedResult.imageUrl}
                    headline={selectedResult.headline}
                    body={selectedResult.body}
                    cta={selectedResult.cta}
                    ratio={spec.ratio}
                    niche={projectDna?.niche}
                    logoUrl={projectDna?.logoUrl}
                    brandColors={projectDna?.brandColors}
                  />
                </div>
              ) : (
                <CanvasOverlay
                  imageUrl={selectedResult?.imageUrl || null}
                  headline={selectedResult?.headline}
                  body={selectedResult?.body}
                  cta={selectedResult?.cta}
                  ratio={spec.ratio}
                  onEditText={() => setShowEditor(true)}
                  onVary={handleGenerate}
                  onExport={() => {}}
                />
              )}

              {/* Selected result text below canvas */}
              {selectedResult && !showEditor && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-[600px] mx-auto mt-4 rounded-2xl border border-border/15 bg-card/20 p-4 space-y-2"
                >
                  <h3 className="text-sm font-semibold">{selectedResult.headline}</h3>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">{selectedResult.body}</p>
                  {selectedResult.cta && <p className="text-xs font-medium text-primary">{selectedResult.cta}</p>}
                  {selectedResult.fallbackEvents && selectedResult.fallbackEvents.length > 0 && (
                    <p className="text-[10px] text-cos-warning">⚠ Fallback: {selectedResult.fallbackEvents[0]}</p>
                  )}
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══════ RIGHT PANEL — History (20%) ═══════ */}
      {!isCarousel && (
        <div className="w-[200px] shrink-0 border-l border-border/15 bg-card/10 backdrop-blur-sm overflow-hidden">
          <HistoryPanel
            results={results}
            selectedId={selectedResultId}
            onSelect={(id) => {
              setSelectedResultId(id);
              setShowEditor(false);
              const r = results.find((x) => x.id === id);
              if (r) selectAsset({ id: r.id, title: r.headline, type: spec.pieceType, status: r.status, profile: profileLabels[r.profile] || r.profile, provider: r.provider });
            }}
            profileLabels={profileLabels}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════ Carousel sub-view (unchanged logic, extracted for readability) ═══════ */
function CarouselView({
  carousel, spec, roleLabels, projectDna, carouselLayerStyles, setCarouselLayerStyles,
  activeEditorSlide, setActiveEditorSlide, handleApplyToAll,
}: any) {
  return (
    <>
      <div className="mb-4">
        <h2 className="text-sm font-semibold font-mono-brand tracking-tight flex items-center gap-2">
          <GalleryHorizontalEnd className="h-4 w-4 text-primary" /> Carrossel Estratégico
          {carousel.step !== "idle" && (
            <span className="rounded-lg bg-primary/10 text-primary text-[10px] font-mono-brand px-2 py-0.5 ml-auto">
              {carousel.activeFormula === "pas" ? "🔥 PAS" : carousel.activeFormula === "tutorial" ? "📚 Tutorial" : "🦸 Jornada"}
            </span>
          )}
        </h2>
      </div>

      {/* Storyline Review */}
      {(carousel.step === "reviewing" || carousel.step === "generating-slides") && carousel.storyline.length > 0 && (
        <div className="space-y-3 max-w-2xl mx-auto">
          {carousel.styleAnchor && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-4">
              <p className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/50 mb-1">Âncora Visual</p>
              <p className="text-xs text-foreground/80">{carousel.styleAnchor}</p>
            </div>
          )}
          {carousel.storyline.map((slide: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-border/15 bg-card/20 p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="rounded-lg bg-primary/10 text-primary text-xs font-mono-brand font-bold w-6 h-6 flex items-center justify-center">
                  {slide.slideNumber}
                </span>
                <span className="text-xs font-medium">{roleLabels[slide.role] || slide.role}</span>
              </div>
              <input value={slide.headline} onChange={(e: any) => carousel.updateSlide(i, { headline: e.target.value })}
                className="w-full text-sm font-semibold bg-transparent border-b border-border/15 pb-1 mb-2 focus:outline-none focus:border-primary/30"
                disabled={carousel.step === "generating-slides"} />
              {slide.body && (
                <textarea value={slide.body} onChange={(e: any) => carousel.updateSlide(i, { body: e.target.value })}
                  rows={2} className="w-full text-xs text-muted-foreground/70 bg-transparent border-b border-border/10 pb-1 mb-2 focus:outline-none resize-none"
                  disabled={carousel.step === "generating-slides"} />
              )}
              <p className="text-[10px] text-muted-foreground/50 italic">{slide.visualDirection}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Generated Slides */}
      {carousel.step === "done" && carousel.slides.length > 0 && (
        <div className="space-y-4">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {carousel.slides.map((slide: any, i: number) => (
              <motion.button key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => setActiveEditorSlide(activeEditorSlide === slide.slideNumber ? null : slide.slideNumber)}
                className={cn(
                  "shrink-0 w-20 rounded-xl border overflow-hidden transition-all",
                  activeEditorSlide === slide.slideNumber
                    ? "border-primary/50 ring-2 ring-primary/20"
                    : "border-border/15 hover:border-primary/20"
                )}>
                {slide.imageUrl ? (
                  <img src={slide.imageUrl} alt={slide.headline} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-card/20 flex items-center justify-center">
                    <Image className="h-4 w-4 text-muted-foreground/15" />
                  </div>
                )}
                <div className="p-1 text-center">
                  <span className="text-[8px] font-mono-brand text-muted-foreground/50">
                    {slide.slideNumber}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>

          {activeEditorSlide !== null && (() => {
            const slide = carousel.slides.find((s: any) => s.slideNumber === activeEditorSlide);
            if (!slide) return null;
            return (
              <motion.div key={slide.slideNumber} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="max-w-[600px] mx-auto">
                <LayerEditor
                  imageUrl={slide.imageUrl}
                  headline={slide.headline}
                  body={slide.body}
                  cta={slide.role === "cta" ? slide.headline : undefined}
                  ratio={spec.ratio}
                  niche={projectDna?.niche}
                  logoUrl={projectDna?.logoUrl}
                  brandColors={projectDna?.brandColors}
                  copyPlacement={slide.copyPlacement}
                  showApplyToAll={carousel.slides.length > 1}
                  onApplyToAll={handleApplyToAll}
                  onLayersChange={(layers: any) => setCarouselLayerStyles((prev: any) => ({ ...prev, [slide.slideNumber]: layers }))}
                />
              </motion.div>
            );
          })()}

          {activeEditorSlide === null && (
            <p className="text-center text-[10px] text-muted-foreground/30 py-4">
              Clique em um slide para editar
            </p>
          )}
        </div>
      )}

      {carousel.step === "idle" && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
            <GalleryHorizontalEnd className="h-7 w-7 text-primary/20" />
          </div>
          <p className="text-xs text-muted-foreground/40">Configure e gere o roteiro</p>
        </motion.div>
      )}
    </>
  );
}
