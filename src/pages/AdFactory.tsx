import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Zap, Loader2, ChevronRight, Check, Target, Users, Tag, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface AdAngle {
  title: string;
  approach: string;
  hook: string;
  copy: string;
  visualDirection: string;
}

interface AdResult {
  id: string;
  platform: string;
  format: string;
  ratio: string;
  imageUrl: string;
  headline: string;
  angle: string;
}

const PLATFORMS = [
  { id: "Facebook/Instagram Feed", label: "Feed FB/IG", icon: "📱" },
  { id: "Instagram Stories / Reels", label: "Stories/Reels", icon: "🎬" },
  { id: "Google Display", label: "Google Display", icon: "🖥️" },
];

const PROFILES = [
  { id: "economy", label: "Econômico" },
  { id: "standard", label: "Padrão" },
  { id: "quality", label: "Qualidade" },
];

type Step = "briefing" | "angles" | "generate" | "results";

export default function AdFactory() {
  const { projectId } = useParams();
  const [step, setStep] = useState<Step>("briefing");

  const [campaignGoal, setCampaignGoal] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [offer, setOffer] = useState("");

  const [angles, setAngles] = useState<AdAngle[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<AdAngle | null>(null);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["Facebook/Instagram Feed"]);
  const [quantity, setQuantity] = useState(1);
  const [profile, setProfile] = useState<"economy" | "standard" | "quality">("standard");

  const [results, setResults] = useState<AdResult[]>([]);

  const { mutate: generateAngles, isPending: loadingAngles } = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ad-factory", {
        body: { projectId, mode: "angles", campaignGoal, targetAudience, offer, profile },
      });
      if (error) throw new Error(error.message);
      if (!data.angles) throw new Error("Nenhum ângulo retornado.");
      return data.angles;
    },
    onSuccess: (data) => {
      setAngles(data);
      setStep("angles");
      toast.success("5 ângulos de campanha gerados!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { mutate: generateAds, isPending: loadingAds } = useMutation({
    mutationFn: async () => {
      if (!selectedAngle) throw new Error("Selecione um ângulo.");
      if (selectedPlatforms.length === 0) throw new Error("Selecione ao menos uma plataforma.");
      const { data, error } = await supabase.functions.invoke("ad-factory", {
        body: { projectId, mode: "generate", selectedAngle, platforms: selectedPlatforms, quantity, profile },
      });
      if (error) throw new Error(error.message);
      return data.results;
    },
    onSuccess: (data) => {
      setResults(data);
      setStep("results");
      toast.success(`${data.length} anúncios gerados com sucesso!`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const reset = () => {
    setStep("briefing");
    setAngles([]);
    setSelectedAngle(null);
    setResults([]);
  };

  const formatCountMap: Record<string, number> = {
    "Facebook/Instagram Feed": 2,
    "Instagram Stories / Reels": 1,
    "Google Display": 2,
  };

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Zap className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono-brand">Ad Factory</h1>
            <p className="text-xs text-muted-foreground">Fábrica de Anúncios em Massa</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4">
          {(["briefing", "angles", "generate", "results"] as Step[]).map((s, i) => {
            const steps: Step[] = ["briefing", "angles", "generate", "results"];
            const currentIdx = steps.indexOf(step);
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all",
                  step === s ? "bg-primary border-primary text-primary-foreground" :
                  currentIdx > i ? "bg-primary/20 border-primary/40 text-primary" :
                  "bg-muted border-border text-muted-foreground"
                )}>
                  {currentIdx > i ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className={cn("text-[11px] font-mono-brand", step === s ? "text-foreground" : "text-muted-foreground/50")}>
                  {s === "briefing" ? "Briefing" : s === "angles" ? "Ângulos" : s === "generate" ? "Produção" : "Resultados"}
                </span>
                {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: BRIEFING */}
        {step === "briefing" && (
          <motion.div key="briefing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="rounded-xl border border-border/20 bg-card/50 p-6 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Briefing da Campanha</h2>
              <p className="text-xs text-muted-foreground">Preencha os campos abaixo. A IA usará o DNA do projeto como base.</p>

              <div className="space-y-1">
                <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60">Objetivo da Campanha</label>
                <Input value={campaignGoal} onChange={e => setCampaignGoal(e.target.value)}
                  placeholder="Ex: Vender o curso de Tarot por R$97, gerar leads..." className="text-sm" />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1"><Users className="h-3 w-3" /> Público-Alvo Específico (opcional)</label>
                <Input value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
                  placeholder="Ex: Mulheres 25-40 anos interessadas em espiritualidade..." className="text-sm" />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1"><Tag className="h-3 w-3" /> Oferta / Produto</label>
                <Textarea value={offer} onChange={e => setOffer(e.target.value)} rows={2}
                  placeholder="Ex: E-book 'Tarot para Iniciantes' por R$47..." className="text-sm resize-none" />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60">Perfil de Qualidade</label>
                <div className="flex gap-2">
                  {PROFILES.map(p => (
                    <button key={p.id} onClick={() => setProfile(p.id as any)}
                      className={cn("flex-1 rounded-xl border py-2 text-xs transition-all",
                        profile === p.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border/15 text-muted-foreground/50 hover:border-primary/20")}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={() => generateAngles()} disabled={loadingAngles} className="w-full gap-2 py-3">
              {loadingAngles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {loadingAngles ? "Gerando ângulos estratégicos..." : "Gerar Ângulos de Campanha"}
            </Button>
          </motion.div>
        )}

        {/* STEP 2: ANGLES */}
        {step === "angles" && (
          <motion.div key="angles" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Escolha um Ângulo de Campanha</h2>
              <Button variant="ghost" size="sm" onClick={() => setStep("briefing")} className="gap-1 text-xs">
                <RefreshCw className="h-3 w-3" /> Refazer Briefing
              </Button>
            </div>

            <div className="grid gap-3">
              {angles.map((angle, i) => (
                <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedAngle(angle)}
                  className={cn(
                    "w-full text-left rounded-xl border p-4 transition-all",
                    selectedAngle?.title === angle.title
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/15 bg-card/30 hover:border-primary/20"
                  )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[10px] font-mono-brand px-2 py-0.5 rounded-full border",
                          selectedAngle?.title === angle.title ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground")}>
                          {angle.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">{angle.approach}</span>
                      </div>
                      <p className="font-semibold text-sm mb-1">"{angle.hook}"</p>
                      <p className="text-xs text-muted-foreground/70 line-clamp-2">{angle.copy}</p>
                    </div>
                    {selectedAngle?.title === angle.title && (
                      <Check className="h-4 w-4 text-primary shrink-0 mt-1" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>

            <Button onClick={() => setStep("generate")} disabled={!selectedAngle} className="w-full gap-2">
              <ChevronRight className="h-4 w-4" /> Configurar Produção
            </Button>
          </motion.div>
        )}

        {/* STEP 3: GENERATE */}
        {step === "generate" && selectedAngle && (
          <motion.div key="generate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-[10px] font-mono-brand uppercase tracking-wider text-muted-foreground/50 mb-1">Ângulo Selecionado</p>
              <p className="font-semibold text-sm">"{selectedAngle.hook}"</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{selectedAngle.title} — {selectedAngle.approach}</p>
            </div>

            <div className="rounded-xl border border-border/20 bg-card/50 p-6 space-y-4">
              <h2 className="text-sm font-semibold">Configurar Produção em Massa</h2>

              <div className="space-y-2">
                <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60">Plataformas</label>
                <div className="space-y-2">
                  {PLATFORMS.map(p => (
                    <button key={p.id} onClick={() => togglePlatform(p.id)}
                      className={cn("w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all",
                        selectedPlatforms.includes(p.id)
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/15 text-muted-foreground/50 hover:border-primary/20")}>
                      <span className="text-lg">{p.icon}</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium">{p.label}</p>
                        <p className="text-[10px] text-muted-foreground/50">{p.id}</p>
                      </div>
                      {selectedPlatforms.includes(p.id) && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60">
                  Variações por Formato: <span className="text-primary font-bold">{quantity}</span>
                </label>
                <input type="range" min={1} max={3} value={quantity} onChange={e => setQuantity(+e.target.value)}
                  className="w-full accent-[hsl(var(--primary))] h-1 rounded-full" />
                <p className="text-[10px] text-muted-foreground/40">
                  Total estimado: {selectedPlatforms.reduce((acc, p) => acc + (formatCountMap[p] || 1) * quantity, 0)} anúncios
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("angles")} className="gap-2">
                <ChevronRight className="h-4 w-4 rotate-180" /> Voltar
              </Button>
              <Button onClick={() => generateAds()} disabled={loadingAds || selectedPlatforms.length === 0} className="flex-1 gap-2">
                {loadingAds ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {loadingAds ? "Gerando anúncios..." : "Gerar Anúncios"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: RESULTS */}
        {step === "results" && (
          <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{results.length} Anúncios Gerados</h2>
              <Button variant="outline" size="sm" onClick={reset} className="gap-1 text-xs">
                <RefreshCw className="h-3 w-3" /> Nova Campanha
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {results.map((result, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border/15 bg-card/30 overflow-hidden">
                  {result.imageUrl && (
                    <img src={result.imageUrl} alt={result.headline} className="w-full h-auto object-contain bg-black/20" />
                  )}
                  <div className="p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono-brand px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">{result.platform}</span>
                      <span className="text-[9px] font-mono-brand text-muted-foreground/50">{result.format} · {result.ratio}</span>
                    </div>
                    <p className="text-xs font-medium line-clamp-1">{result.headline}</p>
                    <a href={result.imageUrl} download={`ad-${result.id}.png`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="w-full gap-1 text-[10px] h-7 mt-1">
                        <Download className="h-3 w-3" /> Baixar
                      </Button>
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
