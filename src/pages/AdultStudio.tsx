import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame, Type, User, Layers, Cpu, Upload, X, Plus, Loader2,
  Sparkles, Star, Zap, Crown, ChevronDown, ChevronUp, Image, AlertCircle,
  CheckCircle2, Lock, ExternalLink, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type StudioMode = "text2img" | "ip_adapter" | "controlnet" | "lora";
type Ratio = "1:1" | "9:16" | "16:9";

interface ModelOption {
  id: string;
  name: string;
  provider: "together" | "fal";
  cost: "pago" | "premium";
  quality: "boa" | "ótima" | "máxima";
  description: string;
  requiresTraining?: boolean;
}

const MODELS: Record<StudioMode, ModelOption[]> = {
  text2img: [
    { id: "together/black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell", provider: "together", cost: "pago", quality: "boa", description: "Rápido, sem filtros. Ideal para testes e iterações rápidas." },
    { id: "together/black-forest-labs/FLUX.1-krea-dev", name: "FLUX.1 Krea Dev", provider: "together", cost: "pago", quality: "ótima", description: "Mais detalhado e realista. Melhor equilíbrio custo/qualidade." },
    { id: "together/black-forest-labs/FLUX.2-dev", name: "FLUX.2 Dev", provider: "together", cost: "premium", quality: "máxima", description: "Última geração FLUX. Qualidade máxima, sem nenhum filtro." },
  ],
  ip_adapter: [
    { id: "fal-ai/ip-adapter-face-id", name: "IP-Adapter Face ID", provider: "fal", cost: "pago", quality: "ótima", description: "Preserva sua identidade facial com alta fidelidade. Recomendado para retratos." },
    { id: "fal-ai/flux/dev/image-to-image", name: "FLUX img2img", provider: "fal", cost: "pago", quality: "boa", description: "Usa sua foto como base e transforma a cena mantendo elementos visuais." },
  ],
  controlnet: [
    { id: "fal-ai/flux-controlnet", name: "FLUX ControlNet", provider: "fal", cost: "pago", quality: "ótima", description: "FLUX com preservação de pose. Replica a posição do corpo com alta qualidade." },
    { id: "fal-ai/controlnet-union-sdxl", name: "ControlNet SDXL", provider: "fal", cost: "pago", quality: "boa", description: "Preserva a pose do corpo. Boa opção para replicar posições específicas." },
  ],
  lora: [
    { id: "fal-ai/flux-lora", name: "FLUX LoRA (fal.ai)", provider: "fal", cost: "premium", quality: "máxima", description: "Treina o modelo com suas fotos. Identidade 100% fiel, sem filtros.", requiresTraining: true },
    { id: "together/lora", name: "Together LoRA", provider: "together", cost: "premium", quality: "máxima", description: "LoRA na together.ai. Sem filtros, identidade completa e consistente.", requiresTraining: true },
  ],
};

const MODE_INFO: Record<StudioMode, { label: string; icon: any; description: string; requiresPhoto: boolean }> = {
  text2img: { label: "Texto → Imagem", icon: Type, description: "Descreva a cena em texto. Sem filtros, sem restrições.", requiresPhoto: false },
  ip_adapter: { label: "IP-Adapter", icon: User, description: "Envie uma foto sua. O modelo preserva sua identidade facial na imagem gerada.", requiresPhoto: true },
  controlnet: { label: "ControlNet", icon: Layers, description: "Envie uma foto com a pose desejada. O modelo replica a posição do corpo.", requiresPhoto: true },
  lora: { label: "LoRA Treinado", icon: Cpu, description: "Treina o modelo com suas fotos para identidade 100% fiel. Melhor opção para conteúdo explícito.", requiresPhoto: false },
};

// ── Componentes auxiliares ────────────────────────────────────────────────────
function QualityBadge({ quality }: { quality: "boa" | "ótima" | "máxima" }) {
  const map = {
    boa: { label: "Boa", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    ótima: { label: "Ótima", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    máxima: { label: "Máxima", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  };
  const { label, color } = map[quality];
  return <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", color)}>{label}</span>;
}

function CostBadge({ cost }: { cost: "pago" | "premium" }) {
  if (cost === "premium") return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
      <Crown className="h-2.5 w-2.5" /> Premium
    </span>
  );
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-zinc-700/50 text-zinc-400 border-zinc-600/30">
      Pago
    </span>
  );
}

function ProviderBadge({ provider }: { provider: "together" | "fal" }) {
  if (provider === "together") return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">together.ai</span>
  );
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">fal.ai</span>
  );
}

function ResultCard({ url, onDownload }: { url: string; onDownload: (url: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative group rounded-xl overflow-hidden border border-white/10 bg-zinc-900"
    >
      <img src={url} alt="Resultado gerado" className="w-full h-auto object-cover" />
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => onDownload(url)}>
          <Download className="h-4 w-4 mr-1" /> Baixar
        </Button>
      </div>
    </motion.div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdultStudio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Estado global
  const [activeMode, setActiveMode] = useState<StudioMode>("text2img");
  const [selectedModel, setSelectedModel] = useState<string>(MODELS.text2img[0].id);
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [numVariations, setNumVariations] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  // Foto de referência
  const [referencePhoto, setReferencePhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // LoRA
  const [loraModelId, setLoraModelId] = useState("");

  // Projeto ativo
  const activeProjectId = localStorage.getItem("activeProjectId");

  // Quando muda de modo, seleciona o primeiro modelo do novo modo
  const handleModeChange = (mode: StudioMode) => {
    setActiveMode(mode);
    setSelectedModel(MODELS[mode][0].id);
    setResults([]);
  };

  // Upload de foto de referência
  const handlePhotoUpload = useCallback(async (file: File) => {
    if (!user || !activeProjectId) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `reference-photos/${activeProjectId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(path);
      setReferencePhoto(publicUrl);
      toast.success("Foto carregada com sucesso");
    } catch (err) {
      toast.error("Erro ao fazer upload da foto");
      console.error(err);
    } finally {
      setUploadingPhoto(false);
    }
  }, [user, activeProjectId]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handlePhotoUpload(file);
  }, [handlePhotoUpload]);

  // Geração
  const handleGenerate = async () => {
    if (!user || !activeProjectId) {
      toast.error("Selecione um projeto primeiro");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Escreva um prompt antes de gerar");
      return;
    }
    if (MODE_INFO[activeMode].requiresPhoto && !referencePhoto) {
      toast.error("Envie uma foto de referência para este modo");
      return;
    }
    if (activeMode === "lora" && !loraModelId.trim()) {
      toast.error("Informe o ID do modelo LoRA treinado");
      return;
    }

    setIsGenerating(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("adult-studio", {
        body: {
          project_id: activeProjectId,
          user_id: user.id,
          mode: activeMode,
          model_id: selectedModel,
          prompt: prompt.trim(),
          reference_photo_url: referencePhoto,
          lora_model_id: loraModelId || null,
          ratio,
          num_variations: numVariations,
        },
      });

      if (error) throw error;

      const urls = (data?.results ?? [])
        .filter((r: any) => r.status === "completed" && r.url)
        .map((r: any) => r.url);

      if (urls.length > 0) {
        setResults(urls);
        toast.success(`${urls.length} imagem(ns) gerada(s) com sucesso`);
      } else {
        const firstError = data?.results?.[0]?.error ?? "Nenhuma imagem foi gerada";
        toast.error(firstError);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao gerar imagens");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `studio-adulto-${Date.now()}.png`;
    a.target = "_blank";
    a.click();
  };

  const currentModels = MODELS[activeMode];
  const currentModeInfo = MODE_INFO[activeMode];

  if (!activeProjectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <Flame className="h-12 w-12 text-red-500/50" />
        <p className="text-muted-foreground">Selecione um projeto para usar o Studio Adulto.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <Flame className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Studio Adulto</h1>
          <p className="text-xs text-muted-foreground">Geração sem filtros — conteúdo explícito e personalizado</p>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/5 text-xs">
            +18
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Painel esquerdo — configurações */}
        <div className="w-80 flex-shrink-0 border-r border-border/50 overflow-y-auto p-4 space-y-5">

          {/* Seletor de modo */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Modo de Geração</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(MODE_INFO) as [StudioMode, typeof MODE_INFO[StudioMode]][]).map(([mode, info]) => {
                const Icon = info.icon;
                const isActive = activeMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all",
                      isActive
                        ? "border-red-500/50 bg-red-500/10 text-red-300"
                        : "border-border/50 bg-secondary/30 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium leading-tight">{info.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{currentModeInfo.description}</p>
          </div>

          {/* Seletor de modelo */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Modelo</Label>
            <div className="space-y-2">
              {currentModels.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <button
                    key={model.id}
                    onClick={() => !model.requiresTraining && setSelectedModel(model.id)}
                    className={cn(
                      "w-full flex flex-col gap-1.5 p-3 rounded-lg border text-left transition-all",
                      isSelected
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-border/50 bg-secondary/30 hover:border-border",
                      model.requiresTraining && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{model.name}</span>
                      {model.requiresTraining && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{model.description}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <QualityBadge quality={model.quality} />
                      <CostBadge cost={model.cost} />
                      <ProviderBadge provider={model.provider} />
                    </div>
                    {model.requiresTraining && (
                      <span className="text-[10px] text-amber-400/80 flex items-center gap-1 mt-0.5">
                        <Lock className="h-2.5 w-2.5" /> Requer treino de LoRA
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload de foto (se necessário) */}
          {currentModeInfo.requiresPhoto && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Foto de Referência</Label>
              {referencePhoto ? (
                <div className="relative rounded-lg overflow-hidden border border-border/50">
                  <img src={referencePhoto} alt="Referência" className="w-full h-40 object-cover" />
                  <button
                    onClick={() => setReferencePhoto(null)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border/50 rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-red-500/40 hover:bg-red-500/5 transition-all"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground text-center">Arraste ou clique para enviar</p>
                      <p className="text-[10px] text-muted-foreground/60">JPG, PNG, WEBP</p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                }}
              />
            </div>
          )}

          {/* Campo LoRA ID */}
          {activeMode === "lora" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">ID do Modelo LoRA</Label>
              <input
                type="text"
                value={loraModelId}
                onChange={(e) => setLoraModelId(e.target.value)}
                placeholder="Ex: https://huggingface.co/seu-lora"
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500/50"
              />
              <p className="text-[10px] text-muted-foreground">
                Cole o URL do modelo LoRA treinado (HuggingFace, fal.ai, etc.)
              </p>
            </div>
          )}

          {/* Ratio */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Proporção</Label>
            <div className="flex gap-2">
              {(["1:1", "9:16", "16:9"] as Ratio[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRatio(r)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    ratio === r
                      ? "border-red-500/50 bg-red-500/10 text-red-300"
                      : "border-border/50 bg-secondary/30 text-muted-foreground hover:border-border"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Variações */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Variações</Label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNumVariations(Math.max(1, numVariations - 1))}
                className="p-1.5 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary text-muted-foreground"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <span className="text-sm font-bold text-foreground w-6 text-center">{numVariations}</span>
              <button
                onClick={() => setNumVariations(Math.min(4, numVariations + 1))}
                className="p-1.5 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary text-muted-foreground"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Painel direito — prompt e resultados */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Área de prompt */}
          <div className="p-4 border-b border-border/50 space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva a cena em detalhes. Seja específico sobre aparência, ambiente, posição, iluminação..."
              className="min-h-[100px] bg-secondary/30 border-border/50 resize-none text-sm focus:border-red-500/50"
            />
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Flame className="h-4 w-4 mr-2" />
                  Gerar {numVariations > 1 ? `${numVariations} variações` : "imagem"}
                </>
              )}
            </Button>
          </div>

          {/* Resultados */}
          <div className="flex-1 overflow-y-auto p-4">
            {results.length === 0 && !isGenerating && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                  <Flame className="h-10 w-10 text-red-500/30" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhuma imagem gerada ainda</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Configure o modo, escolha o modelo e escreva o prompt</p>
                </div>

                {/* Guia de custos */}
                <div className="mt-4 w-full max-w-sm bg-secondary/30 rounded-xl border border-border/50 p-4 text-left space-y-3">
                  <p className="text-xs font-semibold text-foreground">Guia de Custos</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Zap className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] font-medium text-foreground">FLUX.1 Schnell</p>
                        <p className="text-[10px] text-muted-foreground">~$0.003/imagem (together.ai)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Star className="h-3.5 w-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] font-medium text-foreground">IP-Adapter / ControlNet</p>
                        <p className="text-[10px] text-muted-foreground">~$0.005-0.01/imagem (fal.ai)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Crown className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] font-medium text-foreground">LoRA (treino)</p>
                        <p className="text-[10px] text-muted-foreground">~$0.50-2.00 por treino único (fal.ai)</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground">
                      Certifique-se de ter saldo em{" "}
                      <a href="https://api.together.ai" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">together.ai</a>
                      {" "}e{" "}
                      <a href="https://fal.ai/dashboard/billing" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">fal.ai</a>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-2 border-red-500/20 border-t-red-500 animate-spin" />
                  <Flame className="absolute inset-0 m-auto h-6 w-6 text-red-400" />
                </div>
                <p className="text-sm text-muted-foreground">Gerando com {currentModels.find(m => m.id === selectedModel)?.name}...</p>
              </div>
            )}

            {results.length > 0 && (
              <div className={cn(
                "grid gap-4",
                results.length === 1 ? "grid-cols-1 max-w-lg mx-auto" : "grid-cols-2"
              )}>
                {results.map((url, i) => (
                  <ResultCard key={i} url={url} onDownload={handleDownload} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
