import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, Upload, Loader2, Link, Brain, Sparkles, X, Copy, Check,
  Target, Heart, Layers, Type, Users, Lightbulb, Wand2, ChevronDown,
  Sun, Palette,
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

export default function ProjectReferences() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [refUrl, setRefUrl] = useState("");
  const [humanContext, setHumanContext] = useState("");
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

  const analyzeMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const { data, error } = await supabase.functions.invoke("reference-analyze", {
        body: { imageUrl, projectId, projectNiche: project?.niche || "", humanContext: humanContext.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.analysis;
    },
    onSuccess: (analysis) => {
      queryClient.invalidateQueries({ queryKey: ["reference-analyses", projectId] });
      setSelectedRef(analysis);
      setHumanContext("");
      toast.success("Análise semântica concluída!");
    },
    onError: (e: any) => toast.error(e.message || "Erro na análise"),
  });

  const handleUrlSubmit = () => {
    if (!refUrl.trim()) return;
    analyzeMutation.mutate(refUrl.trim());
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
      analyzeMutation.mutate(urlData.publicUrl);
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

  const isAnalyzing = analyzeMutation.isPending || uploadingRef;

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
            Análise semântica e psicológica de referências visuais
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="mb-8 rounded-2xl border border-primary/20 bg-card/30 backdrop-blur-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold font-mono-brand">Enviar Referência</h2>
        </div>
        <p className="text-xs text-muted-foreground/50 mb-5">
          Envie uma imagem e a IA extrairá arquétipo visual, tom emocional, composição, contexto humano e gerará um prompt de produção.
        </p>

        {/* URL input */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input type="url" value={refUrl} onChange={(e) => setRefUrl(e.target.value)}
              placeholder="https://exemplo.com/referencia.jpg"
              onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              className="w-full rounded-xl border border-border/20 bg-background/40 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
          </div>
          <button onClick={handleUrlSubmit} disabled={!refUrl.trim() || isAnalyzing}
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all">
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Human context */}
        <div className="mb-3">
          <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/50 mb-1 block">
            Contexto Adicional (opcional)
          </label>
          <input type="text" value={humanContext} onChange={(e) => setHumanContext(e.target.value)}
            placeholder="Ex: Esta referência é de um concorrente direto no nicho de coaching"
            className="w-full rounded-xl border border-border/20 bg-background/40 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>

        {/* File upload */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing}
          className="w-full rounded-xl border border-dashed border-border/20 p-4 text-center hover:bg-card/30 hover:border-primary/20 transition-all disabled:opacity-40">
          {isAnalyzing ? (
            <div className="flex items-center justify-center gap-2 text-xs text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Executando análise semântica profunda...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload de imagem para análise</span>
            </div>
          )}
        </button>
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
          {references.map((ref: any) => (
            <motion.div key={ref.id} layout
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              onClick={() => setSelectedRef(ref)}
              className="group cursor-pointer rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm overflow-hidden hover:border-primary/30 hover:bg-card/30 transition-all">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img src={ref.image_url} alt="Reference" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] font-mono-brand text-primary truncate">{ref.visual_archetype}</p>
                  <p className="text-[10px] text-foreground/70 truncate">{ref.emotional_tone}</p>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono-brand text-primary">{ref.visual_archetype}</span>
                  <span className="text-[10px] font-mono-brand text-cos-warning">{ref.sophistication_level}/10</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 line-clamp-2">{ref.emotional_tone}</p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Eye className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/40 font-mono-brand">Nenhuma referência analisada</p>
          <p className="text-xs text-muted-foreground/30 mt-1">Envie uma imagem acima para iniciar a análise profunda</p>
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
                  <span className="text-sm font-semibold font-mono-brand truncate max-w-[280px]">
                    {selectedRef.visual_archetype}
                  </span>
                </div>
                <button onClick={() => setSelectedRef(null)} className="rounded-lg p-2 hover:bg-secondary transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Image */}
              <div className="p-6 pb-0">
                <img src={selectedRef.image_url} alt="Reference"
                  className="w-full rounded-2xl border border-border/20" />
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

                {/* Composition */}
                <AnalysisSection icon={Layers} label="Engenharia de Composição" text={selectedRef.composition_intent} />

                {/* Focus Narrative */}
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

                {/* Human Context */}
                {selectedRef.human_context && (
                  <AnalysisSection icon={Users} label="Contexto Humano" text={selectedRef.human_context} />
                )}

                {/* Strategic Why */}
                <AnalysisSection icon={Lightbulb} label="Por que Funciona" text={selectedRef.strategic_why} highlight />

                {/* Visual DNA: Palette, Lighting, Grain */}
                {(() => {
                  const raw = selectedRef.raw_analysis || {};
                  const hasDna = raw.palette?.length || raw.lighting_type || raw.grain_level || raw.color_temperature;
                  if (!hasDna) return null;
                  return (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-mono-brand uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                        <Sun className="h-3.5 w-3.5" /> DNA Visual Profundo
                      </h3>
                      {raw.palette?.length > 0 && (
                        <div className="rounded-xl bg-secondary/30 p-4">
                          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Paleta Extraída</p>
                          <div className="flex gap-2">
                            {raw.palette.map((hex: string, i: number) => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div className="w-8 h-8 rounded-lg border border-border/20 shadow-sm" style={{ backgroundColor: hex }} />
                                <span className="text-[9px] font-mono-brand text-muted-foreground/50">{hex}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        {raw.lighting_type && (
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Luz</p>
                            <p className="text-xs font-mono-brand font-medium">{raw.lighting_type}</p>
                          </div>
                        )}
                        {raw.grain_level && (
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Grão</p>
                            <p className="text-xs font-mono-brand font-medium">{raw.grain_level}</p>
                          </div>
                        )}
                        {raw.color_temperature && (
                          <div className="rounded-xl bg-secondary/30 p-3">
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Temperatura</p>
                            <p className="text-xs font-mono-brand font-medium">{raw.color_temperature}</p>
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
                      <Wand2 className="h-3.5 w-3.5 text-primary" /> Prompt de Geração
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
