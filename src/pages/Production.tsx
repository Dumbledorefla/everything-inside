import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Image, Type, FileText, Sparkles, Layers,
  LayoutGrid, Rows3, Loader2, GalleryHorizontalEnd,
  Check, RotateCcw, ChevronRight, ChevronDown, Lightbulb, Film,
  Minus, Plus, User,
} from "lucide-react";
import { AnimateVideoModal } from "@/components/creative/AnimateVideoModal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { IdeaGenerator } from "@/components/creative/IdeaGenerator";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  { value: "fal-ai/flux/schnell", label: "FLUX Schnell" },
  { value: "fal-ai/flux/dev", label: "FLUX Dev" },
  { value: "fal-ai/flux-pro/v1.1", label: "FLUX Pro" },
  { value: "fal-ai/ideogram/v2", label: "Ideogram V2" },
];

/* ── Collapsible Section helper ── */
function ConfigSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between py-1.5 group">
        <span className="text-[11px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground font-medium group-hover:text-foreground transition-colors">{title}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function Production() {
  const { spec, setSpec, selectAsset, activeProjectId } = useAssistant();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { results, progress, generate, cancel, setResults } = useBatchGenerate();
  const carousel = useCarouselGenerate();
  const [userPrompt, setUserPrompt] = useState("");
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [carouselTopic, setCarouselTopic] = useState("");
  const [carouselSlideCount, setCarouselSlideCount] = useState(5);
  const [activeEditorSlide, setActiveEditorSlide] = useState<number | null>(null);
  const [carouselLayerStyles, setCarouselLayerStyles] = useState<Record<number, TextLayer[]>>({});
  const [refining, setRefining] = useState(false);
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [showIdeaGenerator, setShowIdeaGenerator] = useState(false);
  const [showAnimateModal, setShowAnimateModal] = useState(false);
  const [useInfluencer, setUseInfluencer] = useState(false);
  const [useInfluencerForCarousel, setUseInfluencerForCarousel] = useState(false);

  const handleIdeaSelected = (idea: { headline: string; body: string }) => {
    setUserPrompt(idea.headline + ": " + idea.body);
    setShowIdeaGenerator(false);
    toast.info("Ideia aplicada ao prompt. Clique em 'Gerar' para criar.");
  };

  const [operationMode, setOperationModeLocal] = useState<OperationMode>("social");

  const { data: projectData } = useQuery({
    queryKey: ["project-mode", activeProjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("operation_mode, niche, main_influencer_asset_id")
        .eq("id", activeProjectId!)
        .single();
      return data;
    },
    enabled: !!activeProjectId,
    staleTime: 60_000,
  });

  // Fetch main influencer image URL when needed
  const { data: mainInfluencerAsset } = useQuery({
    queryKey: ["main-influencer-production", (projectData as any)?.main_influencer_asset_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, final_render_url")
        .eq("id", (projectData as any)!.main_influencer_asset_id!)
        .single();
      return data;
    },
    enabled: !!(projectData as any)?.main_influencer_asset_id,
  });

  const hasInfluencer = !!(projectData as any)?.main_influencer_asset_id && !!mainInfluencerAsset;


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
      : [...TEXT_PROVIDER_OPTIONS, ...IMAGE_PROVIDER_OPTIONS];

  useEffect(() => {
    const isTextProvider = TEXT_PROVIDER_OPTIONS.some((p) => p.value === spec.provider);
    const isImageProvider = IMAGE_PROVIDER_OPTIONS.some((p) => p.value === spec.provider);
    const invalidForCurrentOutput =
      (spec.output === "image" && isTextProvider) ||
      (spec.output === "text" && isImageProvider);
    if (invalidForCurrentOutput) {
      setSpec({ provider: "Auto" });
    }
  }, [spec.output, spec.provider, setSpec]);

  useEffect(() => {
    if (!availableRatios.includes(spec.ratio)) {
      setSpec({ ratio: availableRatios[0] });
    }
  }, [operationMode]);

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

    // If character mode is active, use character-generate variation (async jobs)
    if (useInfluencer && hasInfluencer && mainInfluencerAsset?.final_render_url) {
      try {
        toast.info("Iniciando geração com personagem...");
        const { data, error } = await supabase.functions.invoke("character-generate", {
          body: {
            mode: "generate_variation",
            project_id: activeProjectId,
            prompt: userPrompt || "A mesma pessoa em um cenário de marketing profissional",
            reference_image_url: mainInfluencerAsset.final_render_url,
            num_variations: spec.quantity,
          },
        });
        if (error) throw error;
        if (!data?.job_ids?.length) throw new Error("Nenhum job criado");

        const jobIds: string[] = data.job_ids;
        toast.info(`${jobIds.length} variações em processamento...`);

        // Trigger job-processor
        supabase.functions.invoke("job-processor", { body: {} }).catch(() => {});

        // Poll for completed jobs
        const pollResults = async (): Promise<void> => {
          const maxAttempts = 36; // 3 minutes
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, 5000));

            // Trigger processor again
            if (i % 2 === 0) {
              supabase.functions.invoke("job-processor", { body: {} }).catch(() => {});
            }

            const { data: jobs } = await supabase
              .from("generation_jobs")
              .select("id, status, asset_id")
              .in("id", jobIds);

            if (!jobs) continue;

            const completed = jobs.filter((j) => j.status === "completed" && j.asset_id);
            const failed = jobs.filter((j) => j.status === "failed");

            if (completed.length > 0) {
              const assetIds = completed.map((j) => j.asset_id!);
              const { data: assets } = await supabase
                .from("assets")
                .select("id, title, final_render_url")
                .in("id", assetIds);

              if (assets?.length) {
                const mapped = assets.map((a) => ({
                  id: a.id,
                  headline: a.title || "",
                  body: "",
                  cta: "",
                  imageUrl: a.final_render_url,
                  provider: "character-generate",
                  profile: spec.profile,
                  status: "draft",
                  creditCost: 10,
                }));
                setResults(mapped);
              }
            }

            if (completed.length + failed.length >= jobIds.length) {
              if (completed.length > 0) {
                toast.success(`${completed.length} variações com personagem geradas!`);
              }
              if (failed.length > 0) {
                toast.error(`${failed.length} variações falharam`);
              }
              return;
            }
          }
          toast.error("Tempo limite atingido. Verifique a biblioteca.");
        };

        await pollResults();
      } catch (err: any) {
        toast.error(err.message || "Erro ao gerar com influencer");
      }
      return;
    }

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
      useCharacter: useInfluencerForCarousel && hasInfluencer,
      characterImageUrl: mainInfluencerAsset?.final_render_url,
    });
  };

  const handleCarouselGenerate = async () => {
    if (!activeProjectId) return;
    await carousel.generateSlides({
      projectId: activeProjectId,
      referenceId: selectedReferenceId,
      profile: spec.profile,
      ratio: spec.ratio,
      useCharacter: useInfluencerForCarousel && hasInfluencer,
      characterImageUrl: mainInfluencerAsset?.final_render_url,
    });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ═══════ LEFT PANEL — Config (sticky with internal scroll) ═══════ */}
      <div className="w-[280px] shrink-0 border-r border-border bg-card flex flex-col" style={{ maxHeight: "100%" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Mode selector */}
          <OperationModeSelector mode={operationMode} onChange={setOperationMode} />

          {/* ── Section: Focus & Format ── */}
          <ConfigSection title="Foco e Formato" defaultOpen={true}>
            {/* Piece type */}
            <div>
              <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-2 block">
                Formato · <span className="text-primary">{MODE_LABELS[operationMode]}</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {availablePieceTypes.map((t) => {
                  const Icon = PIECE_ICONS[t.id] || Sparkles;
                  return (
                    <button key={t.id} onClick={() => { setSpec({ pieceType: t.id }); if (t.id !== "carousel") carousel.reset(); }}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] transition-all",
                        spec.pieceType === t.id
                          ? "border-primary/40 bg-primary/10 text-primary font-medium"
                          : "border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"
                      )}>
                      <Icon className="h-4 w-4" />{t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ratio */}
            <div>
              <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-1.5 block">Proporção</label>
              <div className="flex gap-1 rounded-xl bg-secondary p-0.5">
                {availableRatios.map((r) => (
                  <button key={r} onClick={() => setSpec({ ratio: r })}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-[10px] font-mono-brand transition-all",
                      spec.ratio === r
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </ConfigSection>

          {/* Carousel-specific controls */}
          {isCarousel ? (
            <ConfigSection title="Carrossel" defaultOpen={true}>
              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-1.5 block">
                  Slides: <span className="text-primary font-semibold">{carouselSlideCount}</span>
                </label>
                <input type="range" min={3} max={10} value={carouselSlideCount}
                  onChange={(e) => setCarouselSlideCount(+e.target.value)}
                  className="w-full accent-primary h-1 rounded-full" />
              </div>

              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-1.5 block">Tema</label>
                <textarea value={carouselTopic} onChange={(e) => setCarouselTopic(e.target.value)}
                  placeholder="Ex: 5 erros ao investir..."
                  rows={2} className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none resize-none" />
              </div>

              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-1.5 block">Fórmula</label>
                <div className="space-y-1">
                  {formulaOptions.map((f) => (
                    <button key={f.id} onClick={() => carousel.setFormula(f.id)}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all",
                        carousel.formula === f.id
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/20"
                      )}>
                      <span className="text-sm">{f.icon}</span>
                      <div>
                        <p className="text-[10px] font-semibold leading-tight">{f.label}</p>
                        <p className="text-[8px] text-muted-foreground">{f.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {references && references.length > 0 && (
                <div>
                  <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-1.5 block">Referência</label>
                  <select value={selectedReferenceId || ""} onChange={(e) => setSelectedReferenceId(e.target.value || undefined)}
                    className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground focus:border-primary/40 focus:outline-none">
                    <option value="">Nenhuma</option>
                    {references.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.visual_archetype} — {r.emotional_tone}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Character toggle for carousel */}
              {hasInfluencer ? (
                <label className={cn(
                  "flex items-center justify-between rounded-xl border px-3 py-2 text-[10px] cursor-pointer transition-all",
                  useInfluencerForCarousel
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-secondary text-muted-foreground hover:border-primary/15"
                )}>
                  <span className="flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    Usar Personagem
                  </span>
                  <input
                    type="checkbox"
                    checked={useInfluencerForCarousel}
                    onChange={(e) => setUseInfluencerForCarousel(e.target.checked)}
                    className="accent-primary"
                  />
                </label>
              ) : null}
            </ConfigSection>
          ) : (
            <>
              {/* ── Section: Style & Variations ── */}
              <ConfigSection title="Estilo e Variações" defaultOpen={true}>
                {/* Output type */}
                <div>
                  <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-1.5 block">Saída</label>
                  <div className="flex gap-1">
                    {([
                      { id: "text" as const, label: "Texto", icon: Type },
                      { id: "image" as const, label: "Imagem", icon: Image },
                      { id: "both" as const, label: "Ambos", icon: Zap },
                    ]).map((o) => (
                      <button key={o.id} onClick={() => setSpec({ output: o.id })}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] transition-all",
                          spec.output === o.id
                            ? "border-primary/30 bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:border-primary/20"
                        )}>
                        <o.icon className="h-4 w-4" />{o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity — numeric input with +/- */}
                <div>
                  <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-1.5 block">
                    Variações
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSpec({ quantity: Math.max(1, spec.quantity - 1) })}
                      className="rounded-lg border border-border bg-secondary p-1.5 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={spec.quantity}
                      onChange={(e) => setSpec({ quantity: Math.min(50, Math.max(1, +e.target.value)) })}
                      className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2 text-center text-sm font-mono-brand text-foreground focus:border-primary/40 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => setSpec({ quantity: Math.min(50, spec.quantity + 1) })}
                      className="rounded-lg border border-border bg-secondary p-1.5 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Profile */}
                <div>
                  <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-1.5 block">Perfil</label>
                  <div className="flex gap-1 rounded-xl bg-secondary p-0.5">
                    {(["economy", "standard", "quality"] as const).map((p) => (
                      <button key={p} onClick={() => setSpec({ profile: p })}
                        className={cn(
                          "flex-1 rounded-lg py-1.5 text-[10px] transition-all",
                          spec.profile === p
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}>
                        {profileLabels[p]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Provider */}
                <div>
                  <label className="text-[10px] font-mono-brand uppercase tracking-[0.12em] text-muted-foreground mb-1.5 block">
                    Provedor {spec.output === "image" ? "(imagem)" : spec.output === "text" ? "(texto)" : "(automático)"}
                  </label>
                  <select value={spec.provider} onChange={(e) => setSpec({ provider: e.target.value })}
                    className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-foreground focus:border-primary/40 focus:outline-none">
                    <option value="Auto">Auto (Fallback)</option>
                    {providerOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {/* Toggles */}
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between rounded-xl border border-border bg-secondary px-3 py-2 text-[10px] text-muted-foreground cursor-pointer hover:border-primary/15 transition-all">
                    Usar Modelo
                    <input type="checkbox" checked={spec.useModel} onChange={(e) => setSpec({ useModel: e.target.checked })} className="accent-primary" />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-border bg-secondary px-3 py-2 text-[10px] text-muted-foreground cursor-pointer hover:border-primary/15 transition-all">
                    Perfil Visual
                    <input type="checkbox" checked={spec.useVisualProfile} onChange={(e) => setSpec({ useVisualProfile: e.target.checked })} className="accent-primary" />
                  </label>
                  {/* Influencer Toggle */}
                  {hasInfluencer ? (
                    <label className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-[10px] cursor-pointer transition-all",
                      useInfluencer
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:border-primary/15"
                    )}>
                      <span className="flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        Usar Personagem
                      </span>
                      <input
                        type="checkbox"
                        checked={useInfluencer}
                        onChange={(e) => setUseInfluencer(e.target.checked)}
                        className="accent-primary"
                      />
                    </label>
                  ) : (
                    <Link to={`/project/${activeProjectId}/characters`}>
                      <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-secondary px-3 py-2 text-[10px] text-muted-foreground cursor-pointer hover:border-primary/30 hover:text-primary transition-all">
                        <span className="flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          Criar Personagem Virtual
                        </span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </Link>
                  )}
                </div>
              </ConfigSection>

              {/* ── Section: Prompt & Generation ── */}
              <ConfigSection title="Prompt e Geração" defaultOpen={true}>
                {/* Idea Generator - opens as modal via button */}
                <div className="flex gap-2">
                  <Dialog open={showIdeaGenerator} onOpenChange={setShowIdeaGenerator}>
                    <Button variant="outline" onClick={() => setShowIdeaGenerator(true)} className="flex-1 gap-2 border-cos-orange/20 text-cos-orange hover:bg-cos-orange/10 hover:text-cos-orange">
                      <Lightbulb className="h-4 w-4" />
                      Gerador de Ideias
                    </Button>
                    <DialogContent className="max-w-md">
                      {activeProjectId && (
                        <IdeaGenerator
                          projectId={activeProjectId}
                          pieceType={spec.pieceType}
                          onIdeaSelected={(idea) => {
                            handleIdeaSelected(idea);
                            setShowIdeaGenerator(false);
                          }}
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Smart Prompt — taller */}
                <SmartPromptInput
                  value={userPrompt}
                  onChange={setUserPrompt}
                  disabled={progress.running}
                  onRefine={handleRefinePrompt}
                  refining={refining}
                />
              </ConfigSection>
            </>
          )}
        </div>

        {/* ═══ Fixed Generate button at bottom ═══ */}
        <div className="shrink-0 border-t border-border p-3 bg-card">
          {isCarousel ? (
            <div className="space-y-2">
              {carousel.step === "idle" && (
                <motion.button onClick={handleCarouselStoryline}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                  <GalleryHorizontalEnd className="h-4 w-4" /> Gerar Roteiro
                </motion.button>
              )}
              {carousel.step === "generating-storyline" && (
                <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/50 py-3 text-sm text-primary-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Criando roteiro...
                </div>
              )}
              {carousel.step === "reviewing" && (
                <>
                  <motion.button onClick={handleCarouselGenerate}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                    <Check className="h-4 w-4" /> Aprovar e Gerar
                  </motion.button>
                  <button onClick={carousel.reset}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-[10px] text-muted-foreground hover:text-foreground transition-all">
                    <RotateCcw className="h-3 w-3" /> Refazer
                  </button>
                </>
              )}
              {carousel.step === "generating-slides" && (
                <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/50 py-3 text-sm text-primary-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando slides...
                </div>
              )}
              {carousel.step === "done" && (
                <button onClick={carousel.reset}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-[10px] text-muted-foreground hover:text-foreground transition-all">
                  <RotateCcw className="h-3 w-3" /> Novo Carrossel
                </button>
              )}
            </div>
          ) : (
            <motion.button onClick={handleGenerate} disabled={progress.running}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 glow-cyan">
              {progress.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {progress.running ? `${progress.completed}/${progress.total}` : "Gerar"}
            </motion.button>
          )}
        </div>
      </div>

      {/* ═══════ CENTER PANEL — Canvas ═══════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar — bigger tabs with better contrast */}
        <div className="shrink-0 h-12 border-b border-border flex items-center justify-between px-4 bg-card/50">
          <div className="flex items-center gap-1">
            <span className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold font-mono-brand uppercase tracking-wider text-primary">
              {MODE_LABELS[operationMode]}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="rounded-lg bg-secondary border border-border px-3 py-1.5 text-xs font-semibold font-mono-brand text-foreground">
              {currentPieceLabel} {spec.ratio}
            </span>
          </div>
          {selectedResult && (
            <div className="flex items-center gap-2">
              <span className={cn("rounded-lg border px-2.5 py-1 text-[10px] font-mono-brand font-medium", profileColors[selectedResult.profile] || "")}>
                {profileLabels[selectedResult.profile] || selectedResult.profile}
              </span>
              <span className="text-[10px] font-mono-brand text-muted-foreground">{selectedResult.creditCost}cr</span>
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
              activeProjectId={activeProjectId}
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
              ) : selectedResult ? (
                <div className="max-w-[600px] mx-auto">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground">
                      <Layers className="inline h-3 w-3 mr-1" />{isEditorMode ? "Smart Canvas" : "Resultado Final"}
                    </p>
                    {selectedResult.imageUrl && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowAnimateModal(true)}
                          className="text-[10px] font-mono-brand uppercase tracking-wider px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center gap-1.5"
                        >
                          <Film className="h-3 w-3" /> Animar
                        </button>
                        <button
                          onClick={() => setIsEditorMode(!isEditorMode)}
                          className="text-[10px] font-mono-brand uppercase tracking-wider px-3 py-1 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                        >
                          {isEditorMode ? "← Ver Resultado" : "Editar Camadas"}
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditorMode ? (
                    <LayerEditor
                      imageUrl={selectedResult.imageUrl}
                      headline={selectedResult.headline}
                      body={selectedResult.body}
                      cta={selectedResult.cta}
                      ratio={spec.ratio}
                      niche={projectDna?.niche}
                      projectId={activeProjectId}
                      logoUrl={projectDna?.logoUrl}
                      brandColors={projectDna?.brandColors}
                      onAiRendered={(renderedUrl) => {
                        setResults(prev => prev.map(r => 
                          r.id === selectedResultId 
                            ? { ...r, imageUrl: renderedUrl, status: "review" } 
                            : r
                        ));
                        setIsEditorMode(false);
                        toast.success("Imagem renderizada substituída com sucesso!");
                      }}
                    />
                  ) : selectedResult.imageUrl ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative rounded-2xl overflow-hidden border border-border bg-secondary"
                    >
                      <img
                        src={selectedResult.imageUrl}
                        alt={selectedResult.headline || "Resultado gerado"}
                        className="w-full h-auto object-contain"
                      />
                    </motion.div>
                  ) : null}
                </div>
              ) : (
                /* ── Enhanced empty state ── */
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-24 h-24 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-6"
                  >
                    <Sparkles className="h-12 w-12 text-primary/30" />
                  </motion.div>
                  <h3 className="text-lg font-semibold font-mono-brand mb-2 text-foreground">
                    Seu próximo criativo genial começa aqui
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                    Configure as opções à esquerda — escolha o formato, estilo e escreva um prompt — depois clique em <span className="text-primary font-medium">Gerar</span>.
                  </p>
                </div>
              )}

              {/* Text-only output: show text below */}
              {selectedResult && spec.output === "text" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-[600px] mx-auto mt-4 rounded-2xl border border-border bg-card p-4 space-y-2"
                >
                  <h3 className="text-sm font-semibold">{selectedResult.headline}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{selectedResult.body}</p>
                  {selectedResult.cta && <p className="text-xs font-medium text-primary">{selectedResult.cta}</p>}
                </motion.div>
              )}
              {selectedResult?.fallbackEvents && selectedResult.fallbackEvents.length > 0 && (
                <p className="text-[10px] text-cos-warning text-center mt-2">⚠ Fallback: {selectedResult.fallbackEvents[0]}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══════ RIGHT PANEL — History ═══════ */}
      {!isCarousel && (
        <div className="w-[220px] shrink-0 border-l border-border bg-card overflow-hidden">
          <HistoryPanel
            results={results}
            selectedId={selectedResultId}
            onSelect={(id) => {
              setSelectedResultId(id);
              const r = results.find((x) => x.id === id);
              if (r) selectAsset({ id: r.id, title: r.headline, type: spec.pieceType, status: r.status, profile: profileLabels[r.profile] || r.profile, provider: r.provider });
            }}
            onDelete={(id) => {
              setResults(prev => prev.filter(r => r.id !== id));
              if (selectedResultId === id) setSelectedResultId(null);
            }}
            onClearAll={() => {
              setResults([]);
              setSelectedResultId(null);
            }}
            profileLabels={profileLabels}
          />
        </div>
      )}

      {/* Video Animate Modal */}
      {selectedResult?.imageUrl && (
        <Dialog open={showAnimateModal} onOpenChange={setShowAnimateModal}>
          <DialogContent className="max-w-md p-0">
            <AnimateVideoModal
              assetId={selectedResult.id}
              imageUrl={selectedResult.imageUrl}
              onClose={() => setShowAnimateModal(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ═══════ Carousel sub-view ═══════ */
function CarouselView({
  carousel, spec, roleLabels, projectDna, activeProjectId, carouselLayerStyles, setCarouselLayerStyles,
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
              <p className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground mb-1">Âncora Visual</p>
              <p className="text-xs text-foreground/80">{carousel.styleAnchor}</p>
            </div>
          )}
          {carousel.storyline.map((slide: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="rounded-lg bg-primary/10 text-primary text-xs font-mono-brand font-bold w-6 h-6 flex items-center justify-center">
                  {slide.slideNumber}
                </span>
                <span className="text-xs font-medium">{roleLabels[slide.role] || slide.role}</span>
              </div>
              <input value={slide.headline} onChange={(e: any) => carousel.updateSlide(i, { headline: e.target.value })}
                className="w-full bg-transparent border-b border-border text-sm font-medium mb-1.5 pb-1 focus:outline-none focus:border-primary/40" />
              <textarea value={slide.body} onChange={(e: any) => carousel.updateSlide(i, { body: e.target.value })}
                rows={2} className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none resize-none" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Generated Slides */}
      {carousel.step === "done" && carousel.slides.length > 0 && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {carousel.slides.map((slide: any) => (
              <motion.div key={slide.slideNumber} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: slide.slideNumber * 0.05 }}
                onClick={() => setActiveEditorSlide(slide.slideNumber)}
                className={cn(
                  "rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-lg",
                  activeEditorSlide === slide.slideNumber ? "border-primary ring-2 ring-primary/20" : "border-border"
                )}>
                {slide.imageUrl && <img src={slide.imageUrl} alt={`Slide ${slide.slideNumber}`} className="w-full aspect-square object-cover" />}
                <div className="p-2">
                  <p className="text-[10px] font-mono-brand text-primary">Slide {slide.slideNumber}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{slide.headline}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {activeEditorSlide !== null && (() => {
            const slide = carousel.slides.find((s: any) => s.slideNumber === activeEditorSlide);
            if (!slide) return null;
            return (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono-brand text-primary font-semibold">Editando Slide {slide.slideNumber}</span>
                  <span className="text-[10px] text-muted-foreground">{roleLabels[slide.role] || slide.role}</span>
                </div>
                <LayerEditor
                  imageUrl={slide.imageUrl}
                  headline={slide.headline}
                  body={slide.body}
                  cta={slide.cta}
                  ratio={spec.ratio}
                  niche={projectDna?.niche}
                  projectId={activeProjectId}
                  logoUrl={projectDna?.logoUrl}
                  brandColors={projectDna?.brandColors}
                  onLayersChange={(layers: TextLayer[]) => {
                    setCarouselLayerStyles((prev: Record<number, TextLayer[]>) => ({ ...prev, [slide.slideNumber]: layers }));
                  }}
                  onApplyToAll={handleApplyToAll}
                  showApplyToAll={true}
                />
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
