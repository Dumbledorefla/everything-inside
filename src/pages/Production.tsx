import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Image, Type, FileText, Sparkles,
  LayoutGrid, Rows3, Loader2, Eye, GalleryHorizontalEnd,
  Check, Pencil, RotateCcw, ChevronRight,
} from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CreativeCanvas from "@/components/creative/CreativeCanvas";
import BatchProgressBar from "@/components/production/BatchProgressBar";
import { useBatchGenerate, type BatchResult } from "@/hooks/useBatchGenerate";
import { useCarouselGenerate } from "@/hooks/useCarouselGenerate";
import { cn } from "@/lib/utils";

const pieceTypes = [
  { id: "post", label: "Post", icon: LayoutGrid },
  { id: "banner", label: "Banner", icon: Rows3 },
  { id: "story", label: "Story", icon: FileText },
  { id: "ad", label: "Ad", icon: Sparkles },
  { id: "thumbnail", label: "Thumb", icon: Image },
  { id: "vsl", label: "VSL", icon: Type },
  { id: "carousel", label: "Carrossel", icon: GalleryHorizontalEnd },
];

const profileLabels: Record<string, string> = {
  economy: "Economia",
  standard: "Padrão",
  quality: "Qualidade",
};

const profileColors: Record<string, string> = {
  economy: "bg-cos-warning/10 text-cos-warning border-cos-warning/20",
  standard: "bg-primary/10 text-primary border-primary/20",
  quality: "bg-cos-purple/10 text-cos-purple border-cos-purple/20",
};

const roleLabels: Record<string, string> = {
  hook: "🎣 Gancho",
  problem: "😰 Problema",
  agitation: "🔥 Agitação",
  solution: "💡 Solução",
  benefit: "✨ Benefício",
  content: "📖 Conteúdo",
  recap: "📋 Resumo",
  conflict: "⚔️ Conflito",
  epiphany: "💎 Epifania",
  proof: "📊 Prova",
  cta: "🎯 CTA",
};

const formulaOptions = [
  { id: "pas" as const, label: "PAS", desc: "Dor → Solução", icon: "🔥" },
  { id: "tutorial" as const, label: "Tutorial", desc: "Lista/Dicas", icon: "📚" },
  { id: "hero_journey" as const, label: "Jornada", desc: "Storytelling", icon: "🦸" },
];

export default function Production() {
  const { spec, setSpec, selectAsset, activeProjectId } = useAssistant();
  const { session } = useAuth();
  const { results, progress, generate, cancel } = useBatchGenerate();
  const carousel = useCarouselGenerate();
  const [userPrompt, setUserPrompt] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [carouselTopic, setCarouselTopic] = useState("");
  const [carouselSlideCount, setCarouselSlideCount] = useState(5);

  const isCarousel = spec.pieceType === "carousel";

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

  // Fetch references for carousel reference selector
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

  const handleGenerate = async () => {
    if (!activeProjectId || !session) {
      toast.error("Você precisa estar logado em um projeto.");
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
    });
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
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left panel — Controls */}
      <div className="w-72 shrink-0 border-r border-border/20 bg-card/20 backdrop-blur-sm overflow-y-auto p-5 space-y-5">
        {/* Mode selector */}
        <div>
          <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Modo</label>
          <div className="flex gap-1 rounded-xl bg-background/40 p-1">
            {(["rapido", "orientado", "sprint"] as const).map((m) => (
              <button key={m} onClick={() => setSpec({ mode: m })}
                className={cn(
                  "flex-1 rounded-lg py-2 text-[10px] font-medium uppercase tracking-wider transition-all",
                  spec.mode === m
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-card/40"
                )}>
                {m === "rapido" ? "Rápido" : m === "orientado" ? "Orientado" : "Sprint"}
              </button>
            ))}
          </div>
        </div>

        {/* Piece type */}
        <div>
          <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Tipo de Peça</label>
          <div className="grid grid-cols-3 gap-1.5">
            {pieceTypes.map((t) => (
              <button key={t.id} onClick={() => { setSpec({ pieceType: t.id }); if (t.id !== "carousel") carousel.reset(); }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] transition-all",
                  spec.pieceType === t.id
                    ? "border-primary/40 bg-primary/10 text-primary shadow-sm shadow-primary/10"
                    : "border-border/20 text-muted-foreground/60 hover:border-primary/20 hover:text-foreground hover:bg-card/30"
                )}>
                <t.icon className={cn("h-3.5 w-3.5", spec.pieceType === t.id && "drop-shadow-[0_0_4px_hsl(var(--primary)/0.4)]")} />{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Carousel-specific controls */}
        {isCarousel ? (
          <>
            <div>
              <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">
                Slides: <span className="text-primary font-semibold">{carouselSlideCount}</span>
              </label>
              <input type="range" min={3} max={10} value={carouselSlideCount}
                onChange={(e) => setCarouselSlideCount(+e.target.value)}
                className="w-full accent-primary h-1.5 rounded-full" />
              <div className="flex justify-between text-[9px] text-muted-foreground/40 font-mono-brand mt-1">
                <span>3</span><span>10</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Tema do Carrossel</label>
              <textarea value={carouselTopic} onChange={(e) => setCarouselTopic(e.target.value)}
                placeholder="Ex: 5 erros que iniciantes cometem ao investir..."
                rows={2} className="w-full rounded-xl border border-border/20 bg-background/40 px-3.5 py-2.5 text-xs placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none" />
            </div>

            {/* Formula selector */}
            <div>
              <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Fórmula Narrativa</label>
              <div className="space-y-1.5">
                {formulaOptions.map((f) => (
                  <button key={f.id} onClick={() => carousel.setFormula(f.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all",
                      carousel.formula === f.id
                        ? "border-primary/40 bg-primary/10 text-primary shadow-sm shadow-primary/10"
                        : "border-border/20 text-muted-foreground/60 hover:border-primary/20 hover:text-foreground hover:bg-card/30"
                    )}>
                    <span className="text-sm">{f.icon}</span>
                    <div>
                      <p className="text-[11px] font-semibold leading-tight">{f.label}</p>
                      <p className="text-[9px] text-muted-foreground/50">{f.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Reference selector */}
            {references && references.length > 0 && (
              <div>
                <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Referência Visual</label>
                <select value={selectedReferenceId || ""} onChange={(e) => setSelectedReferenceId(e.target.value || undefined)}
                  className="w-full rounded-xl border border-border/20 bg-background/40 px-3 py-2.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
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
            {/* Output */}
            <div>
              <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Saída</label>
              <div className="flex gap-1.5">
                {([
                  { id: "text" as const, label: "Texto", icon: Type },
                  { id: "image" as const, label: "Imagem", icon: Image },
                  { id: "both" as const, label: "Ambos", icon: Zap },
                ]).map((o) => (
                  <button key={o.id} onClick={() => setSpec({ output: o.id })}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] transition-all",
                      spec.output === o.id
                        ? "border-primary/40 bg-primary/10 text-primary shadow-sm shadow-primary/10"
                        : "border-border/20 text-muted-foreground/60 hover:border-primary/20 hover:text-foreground"
                    )}>
                    <o.icon className="h-3.5 w-3.5" />{o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">
                Variações: <span className="text-primary font-semibold">{spec.quantity}</span>
              </label>
              <input type="range" min={1} max={50} value={spec.quantity} onChange={(e) => setSpec({ quantity: +e.target.value })}
                className="w-full accent-primary h-1.5 rounded-full" />
              <div className="flex justify-between text-[9px] text-muted-foreground/40 font-mono-brand mt-1">
                <span>1</span><span>50</span>
              </div>
            </div>
          </>
        )}

        {/* Ratio */}
        <div>
          <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Proporção</label>
          <div className="flex gap-1 rounded-xl bg-background/40 p-1">
            {["1:1", "4:5", "9:16", "16:9"].map((r) => (
              <button key={r} onClick={() => setSpec({ ratio: r })}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-[10px] font-mono-brand transition-all",
                  spec.ratio === r
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground/50 hover:text-foreground"
                )}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Profile */}
        <div>
          <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Perfil</label>
          <div className="flex gap-1 rounded-xl bg-background/40 p-1">
            {(["economy", "standard", "quality"] as const).map((p) => (
              <button key={p} onClick={() => setSpec({ profile: p })}
                className={cn(
                  "flex-1 rounded-lg py-2 text-[10px] transition-all",
                  spec.profile === p
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground/50 hover:text-foreground"
                )}>
                {profileLabels[p]}
              </button>
            ))}
          </div>
        </div>

        {!isCarousel && (
          <>
            {/* Provider */}
            <div>
              <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Provedor</label>
              <select value={spec.provider} onChange={(e) => setSpec({ provider: e.target.value })}
                className="w-full rounded-xl border border-border/20 bg-background/40 px-3 py-2.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                <option value="Auto">Auto (Fallback)</option>
                <option value="google/gemini-3-flash-preview">Gemini Flash</option>
                <option value="google/gemini-2.5-pro">Gemini Pro</option>
                <option value="google/gemini-2.5-flash-lite">Gemini Lite</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <label className="flex items-center justify-between rounded-xl border border-border/20 bg-background/40 px-3.5 py-2.5 text-xs text-muted-foreground/70 cursor-pointer hover:border-primary/20 hover:bg-card/30 transition-all">
                Usar Modelo
                <input type="checkbox" checked={spec.useModel} onChange={(e) => setSpec({ useModel: e.target.checked })} className="accent-primary" />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-border/20 bg-background/40 px-3.5 py-2.5 text-xs text-muted-foreground/70 cursor-pointer hover:border-primary/20 hover:bg-card/30 transition-all">
                Usar Perfil Visual
                <input type="checkbox" checked={spec.useVisualProfile} onChange={(e) => setSpec({ useVisualProfile: e.target.checked })} className="accent-primary" />
              </label>
            </div>

            {/* Prompt */}
            <div>
              <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">Prompt (opcional)</label>
              <textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="Ex: Foco em urgência e escassez..."
                rows={3} className="w-full rounded-xl border border-border/20 bg-background/40 px-3.5 py-2.5 text-xs placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none" />
            </div>
          </>
        )}

        {/* Generate button */}
        {isCarousel ? (
          <div className="space-y-2">
            {carousel.step === "idle" && (
              <motion.button onClick={handleCarouselStoryline}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all glow-cyan">
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
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all glow-cyan">
                  <Check className="h-4 w-4" /> Aprovar e Gerar Imagens
                </motion.button>
                <button onClick={carousel.reset}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/20 py-2.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-card/30 transition-all">
                  <RotateCcw className="h-3.5 w-3.5" /> Refazer Roteiro
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
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/20 py-2.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-card/30 transition-all">
                <RotateCcw className="h-3.5 w-3.5" /> Novo Carrossel
              </button>
            )}
          </div>
        ) : (
          <motion.button onClick={handleGenerate} disabled={progress.running}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all glow-cyan disabled:opacity-50 disabled:cursor-not-allowed">
            {progress.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {progress.running ? `Gerando ${progress.completed}/${progress.total}...` : "Gerar"}
          </motion.button>
        )}
      </div>

      {/* Center — Results */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isCarousel ? (
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
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {carousel.step === "idle" ? "Configure e gere o roteiro do carrossel" :
                 carousel.step === "reviewing" ? "Revise e edite o roteiro antes de gerar as imagens" :
                 carousel.step === "done" ? `${carousel.slides.length} slides gerados` :
                 "Processando..."}
              </p>
            </div>

            {/* Storyline Review */}
            {(carousel.step === "reviewing" || carousel.step === "generating-slides") && carousel.storyline.length > 0 && (
              <div className="space-y-3">
                {carousel.styleAnchor && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-4">
                    <p className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 mb-1">Âncora Visual (Consistência)</p>
                    <p className="text-xs text-foreground/80">{carousel.styleAnchor}</p>
                  </div>
                )}
                {carousel.storyline.map((slide, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="rounded-lg bg-primary/10 text-primary text-xs font-mono-brand font-bold w-7 h-7 flex items-center justify-center">
                        {slide.slideNumber}
                      </span>
                      <span className="text-xs font-medium">{roleLabels[slide.role] || slide.role}</span>
                      <span className="text-[10px] text-muted-foreground/40 ml-auto">{slide.copyPlacement}</span>
                    </div>
                    <input
                      value={slide.headline}
                      onChange={(e) => carousel.updateSlide(i, { headline: e.target.value })}
                      className="w-full text-sm font-semibold bg-transparent border-b border-border/20 pb-1 mb-2 focus:outline-none focus:border-primary/40"
                      disabled={carousel.step === "generating-slides"}
                    />
                    {slide.body && (
                      <textarea
                        value={slide.body}
                        onChange={(e) => carousel.updateSlide(i, { body: e.target.value })}
                        rows={2}
                        className="w-full text-xs text-muted-foreground/80 bg-transparent border-b border-border/10 pb-1 mb-2 focus:outline-none focus:border-primary/30 resize-none"
                        disabled={carousel.step === "generating-slides"}
                      />
                    )}
                    <p className="text-xs text-muted-foreground/60 italic">{slide.visualDirection}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Generated Slides */}
            {carousel.step === "done" && carousel.slides.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {carousel.slides.map((slide, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="rounded-2xl border border-border/20 bg-card/30 overflow-hidden">
                    {slide.imageUrl ? (
                      <img src={slide.imageUrl} alt={slide.headline} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-card/20 flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded bg-primary/10 text-primary text-[10px] font-mono-brand px-1.5 py-0.5">{slide.slideNumber}</span>
                        <span className="text-[10px] text-muted-foreground/50">{roleLabels[slide.role] || slide.role}</span>
                      </div>
                      <p className="text-xs font-medium truncate">{slide.headline}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {carousel.step === "idle" && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-cos-purple/10 flex items-center justify-center animate-float">
                  <GalleryHorizontalEnd className="h-8 w-8 text-primary/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground/60">Gerador de Carrosséis</p>
                <p className="text-xs text-muted-foreground/40 max-w-sm text-center">
                  Defina o tema, número de slides e referência visual. A IA criará um roteiro narrativo antes de gerar as imagens com consistência visual.
                </p>
              </motion.div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4">
              <h2 className="text-sm font-semibold font-mono-brand tracking-tight">Resultados</h2>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {results.length > 0
                  ? `${results.length} variações geradas — ${spec.pieceType} ${spec.destination} ${spec.ratio}`
                  : "Configure os parâmetros e clique em Gerar"}
              </p>
            </div>

            <BatchProgressBar progress={progress} onCancel={cancel} />

            {!progress.running && results.length === 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-cos-purple/10 flex items-center justify-center animate-float">
                  <Zap className="h-8 w-8 text-primary/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground/60">Nenhum resultado ainda</p>
                <p className="text-xs text-muted-foreground/40">Configure os parâmetros e clique em Gerar</p>
              </motion.div>
            )}

            {results.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.5) }}
                onClick={() => selectAsset({ id: r.id, title: r.headline, type: spec.pieceType, status: r.status, profile: profileLabels[r.profile] || r.profile, provider: r.provider })}
                className="group rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm p-5 hover:border-primary/20 hover:bg-card/50 transition-all duration-300 cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-sm">{r.headline}</h3>
                    <p className="text-sm text-muted-foreground/70 leading-relaxed">{r.body}</p>
                    {r.cta && <p className="text-sm font-medium text-primary">{r.cta}</p>}
                    {r.fallbackEvents && r.fallbackEvents.length > 0 && (
                      <p className="text-[10px] text-cos-warning mt-1">⚠ Fallback: {r.fallbackEvents[0]}</p>
                    )}
                  </div>
                  {r.imageUrl ? (
                    <div className="shrink-0 space-y-1.5">
                      <img src={r.imageUrl} alt={r.headline} className="w-32 h-32 rounded-xl object-cover border border-border/20 shadow-sm" />
                      <button onClick={(e) => { e.stopPropagation(); setPreviewId(previewId === r.id ? null : r.id); }}
                        className="w-full flex items-center justify-center gap-1 rounded-lg bg-card/50 border border-border/20 px-2 py-1 text-[10px] text-muted-foreground/60 hover:text-foreground hover:border-primary/20 transition-all">
                        <Eye className="h-3 w-3" />Canvas
                      </button>
                    </div>
                  ) : (
                    <div className="shrink-0 w-32 h-32 rounded-xl bg-card/30 border border-border/20 flex items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground/20" />
                    </div>
                  )}
                </div>

                {previewId === r.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 pt-4 border-t border-border/20">
                    <p className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-2">Preview do Criativo ({spec.ratio})</p>
                    <CreativeCanvas
                      imageUrl={r.imageUrl} headline={r.headline} body={r.body} cta={r.cta}
                      ratio={spec.ratio} niche={projectDna?.niche} logoUrl={projectDna?.logoUrl} brandColors={projectDna?.brandColors}
                    />
                  </motion.div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-card/50 border border-border/15 px-2 py-0.5 text-[10px] font-mono-brand text-muted-foreground/50">{r.provider}</span>
                    <span className={cn("rounded-lg border px-2 py-0.5 text-[10px] font-mono-brand", profileColors[r.profile] || "bg-card/50 text-muted-foreground/50 border-border/15")}>
                      {profileLabels[r.profile] || r.profile}
                    </span>
                    <span className="rounded-lg bg-card/50 border border-border/15 px-2 py-0.5 text-[10px] font-mono-brand text-muted-foreground/50">{spec.ratio}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/40 font-mono-brand">{r.creditCost} créditos</span>
                </div>
              </motion.div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
