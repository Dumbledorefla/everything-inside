import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, Upload, Loader2, Link, Brain, Sparkles, X, Copy, Check,
  Target, Heart, Layers, Type, Users, Lightbulb, Wand2, ChevronDown,
  Sun, Palette, Instagram, ShoppingCart, Globe, Brush, FileText,
  LayoutList, Megaphone, Store, ExternalLink, Image as ImageIcon,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SOPHISTICATION_LABELS = [
  "", "Popular", "Acessível", "Mainstream", "Casual+", "Equilibrado",
  "Sofisticado", "Premium", "Alto Padrão", "Luxo", "Ultra-Luxo",
];

const REFERENCE_TYPES = [
  { id: "instagram", label: "Instagram", icon: Instagram, description: "Viralização e Retenção", color: "text-pink-500" },
  { id: "sales", label: "Venda", icon: ShoppingCart, description: "Conversão e Desejo", color: "text-cos-warning" },
  { id: "landing", label: "Landing Page", icon: Globe, description: "Estrutura e Escaneabilidade", color: "text-primary" },
  { id: "ecommerce", label: "E-commerce", icon: Store, description: "Catálogo e UX de Compra", color: "text-emerald-500" },
  { id: "brand", label: "Marca", icon: Brush, description: "Identidade e Tom de Voz", color: "text-cos-purple" },
];

const TYPE_BADGES: Record<string, { label: string; class: string }> = {
  instagram: { label: "Instagram", class: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  sales: { label: "Venda", class: "bg-cos-warning/10 text-cos-warning border-cos-warning/20" },
  landing: { label: "Landing", class: "bg-primary/10 text-primary border-primary/20" },
  ecommerce: { label: "E-commerce", class: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  brand: { label: "Marca", class: "bg-cos-purple/10 text-cos-purple border-cos-purple/20" },
};

type InputMode = "image" | "url";

export default function ProjectReferences() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [refUrl, setRefUrl] = useState("");
  const [humanContext, setHumanContext] = useState("");
  const [referenceType, setReferenceType] = useState("landing");
  const [uploadingRef, setUploadingRef] = useState(false);
  const [selectedRef, setSelectedRef] = useState<any>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", projectId!).single();
      return data;
    },
    enabled: !!projectId,
  });

  const { data: references, isLoading } = useQuery({
    queryKey: ["reference-analyses", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reference_analyses")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!projectId,
  });

  // Image analysis mutation (existing)
  const analyzeImageMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const { data, error } = await supabase.functions.invoke("reference-analyze", {
        body: { imageUrl, projectId, projectNiche: project?.niche || "", humanContext: humanContext.trim() || undefined, referenceType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.analysis;
    },
    onSuccess: (analysis) => {
      queryClient.invalidateQueries({ queryKey: ["reference-analyses", projectId] });
      setSelectedRef(analysis);
      setHumanContext("");
      toast.success("Análise semântica de imagem concluída!");
    },
    onError: (e: any) => toast.error(e.message || "Erro na análise"),
  });

  // URL/page analysis mutation (NEW)
  const analyzeUrlMutation = useMutation({
    mutationFn: async (pageUrl: string) => {
      const { data, error } = await supabase.functions.invoke("reference-url-analyze", {
        body: { pageUrl, projectId, projectNiche: project?.niche || "", humanContext: humanContext.trim() || undefined, referenceType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.analysis;
    },
    onSuccess: (analysis) => {
      queryClient.invalidateQueries({ queryKey: ["reference-analyses", projectId] });
      setSelectedRef(analysis);
      setHumanContext("");
      toast.success("Análise profunda de página concluída!");
    },
    onError: (e: any) => toast.error(e.message || "Erro na análise de página"),
  });

  const handleUrlSubmit = () => {
    if (!refUrl.trim()) return;
    if (inputMode === "url") {
      analyzeUrlMutation.mutate(refUrl.trim());
    } else {
      analyzeImageMutation.mutate(refUrl.trim());
    }
    setRefUrl("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingRef(true);
    try {
      const file = files[0];
      const ext = file.name.split(".").pop();
      const path = `references/${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      analyzeImageMutation.mutate(urlData.publicUrl);
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    } finally {
      setUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    toast.success("Prompt copiado!");
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const isAnalyzing = analyzeImageMutation.isPending || analyzeUrlMutation.isPending || uploadingRef;

  // Detect if reference has URL scrape data
  const isUrlRef = (ref: any) => ref?.raw_analysis?.source_type === "url_scrape";

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-cos-purple/20 to-primary/10 p-2.5">
          <Eye className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight font-mono-brand">Deep Perception</h1>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Análise profunda de referências visuais, páginas e perfis
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="mb-8 rounded-2xl border border-primary/20 bg-card/30 backdrop-blur-sm p-6">
        
        {/* Input Mode Toggle */}
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => setInputMode("url")}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-all",
              inputMode === "url"
                ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                : "border-border/20 text-muted-foreground/60 hover:border-primary/20"
            )}>
            <Globe className="h-3.5 w-3.5" />
            URL de Página
          </button>
          <button onClick={() => setInputMode("image")}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-medium transition-all",
              inputMode === "image"
                ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                : "border-border/20 text-muted-foreground/60 hover:border-primary/20"
            )}>
            <ImageIcon className="h-3.5 w-3.5" />
            Imagem
          </button>
        </div>

        {/* Description based on mode */}
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold font-mono-brand">
            {inputMode === "url" ? "Analisar Página Web" : "Analisar Imagem de Referência"}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground/50 mb-5">
          {inputMode === "url"
            ? "Cole a URL de uma landing page, e-commerce, Instagram ou site. A IA vai extrair copy, design, estrutura e persuasão."
            : "Envie uma imagem de referência para análise semiótica e psicológica profunda."
          }
        </p>

        {/* Reference Type Selector */}
        <div className="mb-4">
          <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-2 block">
            Tipo de Referência
          </label>
          <div className="grid grid-cols-5 gap-2">
            {REFERENCE_TYPES.map((t) => (
              <button key={t.id} onClick={() => setReferenceType(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 text-[10px] transition-all",
                  referenceType === t.id
                    ? "border-primary/40 bg-primary/10 text-primary shadow-sm shadow-primary/10"
                    : "border-border/20 text-muted-foreground/60 hover:border-primary/20 hover:text-foreground hover:bg-card/30"
                )}>
                <t.icon className={cn("h-4 w-4", referenceType === t.id ? t.color : "")} />
                <span className="font-medium">{t.label}</span>
                <span className="text-[8px] text-muted-foreground/40 text-center leading-tight">{t.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* URL input */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            {inputMode === "url" ? (
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            ) : (
              <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            )}
            <input type="url" value={refUrl} onChange={(e) => setRefUrl(e.target.value)}
              placeholder={inputMode === "url" 
                ? "https://exemplo.com (landing page, loja, perfil...)" 
                : "https://exemplo.com/referencia.jpg"
              }
              onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              className="w-full rounded-xl border border-border/20 bg-background/40 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
          </div>
          <button onClick={handleUrlSubmit} disabled={!refUrl.trim() || isAnalyzing}
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {inputMode === "url" ? "Analisar" : ""}
          </button>
        </div>

        {/* Human context */}
        <div className="mb-3">
          <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1 block">
            Contexto Adicional (opcional)
          </label>
          <input type="text" value={humanContext} onChange={(e) => setHumanContext(e.target.value)}
            placeholder="Ex: Este é o site do meu principal concorrente no nicho de coaching"
            className="w-full rounded-xl border border-border/20 bg-background/40 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>

        {/* File upload (image mode) */}
        {inputMode === "image" && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing}
              className="w-full rounded-xl border border-dashed border-border/20 p-4 text-center hover:bg-card/30 hover:border-primary/20 transition-all disabled:opacity-40">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload de imagem para análise</span>
              </div>
            </button>
          </>
        )}

        {/* Loading state */}
        {isAnalyzing && (
          <div className="mt-4 rounded-xl bg-primary/5 border border-primary/20 p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-xs font-medium text-primary">
                  {inputMode === "url" ? "Extraindo e analisando página..." : "Executando análise semântica..."}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {inputMode === "url" 
                    ? "Scraping da página → Extração de copy → Análise de design → Mapeamento de persuasão" 
                    : "Análise semiótica e psicológica profunda em andamento"
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Reference Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/10 bg-card/20 h-64 animate-pulse" />
          ))}
        </div>
      ) : references && references.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {references.map((ref: any) => {
            const badge = TYPE_BADGES[ref.reference_type] || TYPE_BADGES.landing;
            const isUrl = ref.raw_analysis?.source_type === "url_scrape";
            return (
              <motion.div key={ref.id} layout
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelectedRef(ref)}
                className="group cursor-pointer rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm overflow-hidden hover:border-primary/30 hover:bg-card/30 transition-all">
                <div className="relative aspect-[4/3] overflow-hidden bg-secondary/20">
                  <img src={ref.image_url} alt="Reference" className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className={cn("rounded-lg border px-2 py-0.5 text-[9px] font-mono-brand font-medium", badge.class)}>
                      {badge.label}
                    </span>
                    {isUrl && (
                      <span className="rounded-lg border border-foreground/10 bg-background/60 px-2 py-0.5 text-[9px] font-mono-brand text-foreground/60 backdrop-blur-sm">
                        <Globe className="inline h-2.5 w-2.5 mr-0.5" />URL
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] font-mono-brand text-primary truncate">{ref.visual_archetype}</p>
                    <p className="text-[10px] text-foreground/70 truncate">{ref.emotional_tone}</p>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono-brand text-primary truncate max-w-[70%]">{ref.visual_archetype}</span>
                    <span className="text-[10px] font-mono-brand text-cos-warning">{ref.sophistication_level}/10</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 line-clamp-2">{ref.emotional_tone}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <Eye className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/40 font-mono-brand">Nenhuma referência analisada</p>
          <p className="text-xs text-muted-foreground/30 mt-1">Envie uma URL ou imagem acima para iniciar a análise profunda</p>
        </div>
      )}

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedRef && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedRef(null)}
              className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm" />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-xl border-l border-border bg-card overflow-y-auto">
              
              {/* Drawer Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-xl px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-1.5">
                    <Eye className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold font-mono-brand truncate max-w-[240px] block">
                      {selectedRef.raw_analysis?.page_title || selectedRef.visual_archetype}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {(() => {
                        const badge = TYPE_BADGES[selectedRef.reference_type] || TYPE_BADGES.landing;
                        return (
                          <span className={cn("rounded-lg border px-2 py-0.5 text-[9px] font-mono-brand font-medium", badge.class)}>
                            {badge.label}
                          </span>
                        );
                      })()}
                      {isUrlRef(selectedRef) && (
                        <a href={selectedRef.raw_analysis?.source_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[9px] text-muted-foreground/50 hover:text-primary transition-colors">
                          <ExternalLink className="h-2.5 w-2.5" /> Abrir original
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedRef(null)} className="rounded-lg p-2 hover:bg-secondary transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Image */}
              <div className="p-6 pb-0">
                <img src={selectedRef.image_url} alt="Reference"
                  className="w-full rounded-2xl border border-border/20"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
              </div>

              {/* Analysis Content */}
              <div className="p-6 space-y-6">
                {/* Archetype + Tone + Sophistication */}
                <div className="grid grid-cols-2 gap-3">
                  <AnalysisCard icon={Target} label="Arquétipo Visual" value={selectedRef.visual_archetype} accent="primary" />
                  <AnalysisCard icon={Heart} label="Tom Emocional" value={selectedRef.emotional_tone} accent="cos-warning" />
                </div>

                {/* Sophistication Bar */}
                <div className="rounded-xl bg-secondary/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60">Nível de Sofisticação</span>
                    <span className="text-xs font-mono-brand text-primary font-bold">{selectedRef.sophistication_level}/10</span>
                  </div>
                  <div className="h-2 rounded-full bg-background/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(selectedRef.sophistication_level / 10) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-cos-warning via-primary to-cos-purple" />
                  </div>
                  <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-right font-mono-brand">
                    {SOPHISTICATION_LABELS[selectedRef.sophistication_level] || ""}
                  </p>
                </div>

                {/* URL-specific: Copy Analysis */}
                {isUrlRef(selectedRef) && selectedRef.raw_analysis?.copy_analysis && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                      <Megaphone className="h-3.5 w-3.5 text-pink-500" /> Análise de Copy e Persuasão
                    </h3>
                    <div className="rounded-xl bg-pink-500/5 border border-pink-500/20 p-4 space-y-3">
                      {selectedRef.raw_analysis.copy_analysis.main_headline && (
                        <div>
                          <p className="text-[10px] text-muted-foreground/50 uppercase mb-1">Headline Principal</p>
                          <p className="text-sm font-semibold">"{selectedRef.raw_analysis.copy_analysis.main_headline}"</p>
                        </div>
                      )}
                      {selectedRef.raw_analysis.copy_analysis.persuasion_type && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-muted-foreground/50 uppercase mb-0.5">Tipo de Persuasão</p>
                            <p className="text-xs font-medium">{selectedRef.raw_analysis.copy_analysis.persuasion_type}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground/50 uppercase mb-0.5">Tom de Voz</p>
                            <p className="text-xs font-medium">{selectedRef.raw_analysis.copy_analysis.tone_of_voice}</p>
                          </div>
                        </div>
                      )}
                      {selectedRef.raw_analysis.copy_analysis.argument_structure && (
                        <div>
                          <p className="text-[10px] text-muted-foreground/50 uppercase mb-0.5">Estrutura Argumentativa</p>
                          <p className="text-xs text-foreground/80">{selectedRef.raw_analysis.copy_analysis.argument_structure}</p>
                        </div>
                      )}
                      {selectedRef.raw_analysis.copy_analysis.psychological_triggers?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground/50 uppercase mb-1">Gatilhos Psicológicos</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedRef.raw_analysis.copy_analysis.psychological_triggers.map((t: string, i: number) => (
                              <span key={i} className="rounded-lg bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 text-[10px] text-pink-500">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedRef.raw_analysis.copy_analysis.ctas?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground/50 uppercase mb-1">CTAs Identificados</p>
                          <div className="space-y-1">
                            {selectedRef.raw_analysis.copy_analysis.ctas.map((cta: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="font-medium">"{cta.text}"</span>
                                <span className="text-[10px] text-muted-foreground/40">{cta.position}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* URL-specific: Structure Map */}
                {isUrlRef(selectedRef) && selectedRef.raw_analysis?.structure_map && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                      <LayoutList className="h-3.5 w-3.5" /> Mapa de Estrutura
                    </h3>
                    <div className="rounded-xl bg-secondary/30 p-4 space-y-3">
                      {selectedRef.raw_analysis.structure_map.sections?.length > 0 && (
                        <div className="space-y-1.5">
                          {selectedRef.raw_analysis.structure_map.sections.map((s: any, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-[10px] font-mono-brand text-primary mt-0.5 w-4 shrink-0">{i + 1}.</span>
                              <div>
                                <span className="text-xs font-medium">{s.name}</span>
                                <span className="text-[10px] text-muted-foreground/50 ml-2">{s.purpose}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedRef.raw_analysis.structure_map.reading_pattern && (
                        <div>
                          <p className="text-[10px] text-muted-foreground/50 uppercase mb-0.5">Padrão de Leitura</p>
                          <p className="text-xs font-medium">{selectedRef.raw_analysis.structure_map.reading_pattern}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* URL-specific: Audience & Positioning */}
                {isUrlRef(selectedRef) && selectedRef.raw_analysis?.audience_positioning && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" /> Público e Posicionamento
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(selectedRef.raw_analysis.audience_positioning).map(([key, val]) => (
                        <div key={key} className="rounded-xl bg-secondary/30 p-3">
                          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">
                            {key === "target_audience" ? "Público-alvo" : key === "awareness_level" ? "Nível de Consciência" : key === "market_position" ? "Posição de Mercado" : "Diferenciação"}
                          </p>
                          <p className="text-xs font-mono-brand font-medium">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* URL-specific: Strategic Lessons */}
                {isUrlRef(selectedRef) && selectedRef.raw_analysis?.strategic_lessons && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                      <Lightbulb className="h-3.5 w-3.5 text-cos-warning" /> Lições Estratégicas
                    </h3>
                    {selectedRef.raw_analysis.strategic_lessons.top_principles?.length > 0 && (
                      <div className="rounded-xl bg-cos-warning/5 border border-cos-warning/20 p-4">
                        <p className="text-[10px] text-muted-foreground/50 uppercase mb-2">Princípios para Adaptar</p>
                        <ul className="space-y-1.5">
                          {selectedRef.raw_analysis.strategic_lessons.top_principles.map((p: string, i: number) => (
                            <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                              <span className="text-cos-warning mt-0.5">✦</span> {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedRef.raw_analysis.strategic_lessons.what_not_to_do?.length > 0 && (
                      <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4">
                        <p className="text-[10px] text-muted-foreground/50 uppercase mb-2">O que NÃO Replicar</p>
                        <ul className="space-y-1.5">
                          {selectedRef.raw_analysis.strategic_lessons.what_not_to_do.map((p: string, i: number) => (
                            <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                              <span className="text-destructive mt-0.5">✕</span> {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <AnalysisSection icon={Layers} label="Engenharia de Composição" text={selectedRef.composition_intent} />
                <AnalysisSection icon={Target} label="Foco Narrativo" text={selectedRef.focus_narrative} />

                {/* Typography */}
                {selectedRef.typography_style && typeof selectedRef.typography_style === "object" && Object.keys(selectedRef.typography_style).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                      <Type className="h-3.5 w-3.5" /> Tipografia Detectada
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(selectedRef.typography_style).map(([key, val]) => (
                        <div key={key} className="rounded-xl bg-secondary/30 p-3">
                          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">{key}</p>
                          <p className="text-xs font-mono-brand font-medium">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Copy (image refs) */}
                {(() => {
                  const raw = selectedRef.raw_analysis || {};
                  if (!raw.extracted_copy) return null;
                  return (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                        <Type className="h-3.5 w-3.5 text-pink-500" /> Copy Extraída da Imagem
                      </h3>
                      <div className="rounded-xl bg-pink-500/5 border border-pink-500/20 p-4">
                        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap italic">"{raw.extracted_copy}"</p>
                      </div>
                    </div>
                  );
                })()}

                {selectedRef.human_context && (
                  <AnalysisSection icon={Users} label="Contexto Humano" text={selectedRef.human_context} />
                )}

                <AnalysisSection icon={Lightbulb} label="Por que Funciona" text={selectedRef.strategic_why} highlight />

                {/* Visual DNA */}
                {(() => {
                  const raw = selectedRef.raw_analysis || {};
                  const palette = raw.palette || raw.design_identity?.palette;
                  const lighting = raw.lighting_type;
                  const grain = raw.grain_level;
                  const temp = raw.color_temperature;
                  const hasDna = palette?.length || lighting || grain || temp;
                  if (!hasDna) return null;
                  return (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                        <Sun className="h-3.5 w-3.5" /> DNA Visual
                      </h3>
                      {palette?.length > 0 && (
                        <div className="rounded-xl bg-secondary/30 p-4">
                          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Paleta Extraída</p>
                          <div className="flex gap-2">
                            {palette.map((hex: string, i: number) => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div className="w-8 h-8 rounded-lg border border-border/20 shadow-sm" style={{ backgroundColor: hex }} />
                                <span className="text-[9px] font-mono-brand text-muted-foreground/50">{hex}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        {lighting && (
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Luz</p>
                            <p className="text-xs font-mono-brand font-medium">{lighting}</p>
                          </div>
                        )}
                        {grain && (
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Grão</p>
                            <p className="text-xs font-mono-brand font-medium">{grain}</p>
                          </div>
                        )}
                        {temp && (
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Temperatura</p>
                            <p className="text-xs font-mono-brand font-medium">{temp}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Generated Prompt */}
                {selectedRef.generated_prompt && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                      <Wand2 className="h-3.5 w-3.5 text-primary" /> Prompt de Recriação Estratégica
                    </h3>
                    <div className="relative rounded-xl bg-primary/5 border border-primary/20 p-4">
                      <p className="text-xs text-foreground/80 leading-relaxed pr-8">{selectedRef.generated_prompt}</p>
                      <button onClick={() => copyPrompt(selectedRef.generated_prompt)}
                        className="absolute top-3 right-3 rounded-lg p-1.5 hover:bg-primary/10 transition-colors">
                        {copiedPrompt ? <Check className="h-3.5 w-3.5 text-cos-success" /> : <Copy className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnalysisCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-secondary/30 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn("h-3.5 w-3.5", `text-${accent}`)} />
        <span className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60">{label}</span>
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function AnalysisSection({ icon: Icon, label, text, highlight }: { icon: any; label: string; text: string; highlight?: boolean }) {
  if (!text) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" /> {label}
      </h3>
      <div className={cn("rounded-xl p-4", highlight ? "bg-cos-warning/5 border border-cos-warning/20" : "bg-secondary/30")}>
        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
