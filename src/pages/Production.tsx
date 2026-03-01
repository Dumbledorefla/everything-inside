import { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap, Image, Type, FileText, Sparkles,
  LayoutGrid, Rows3, Loader2, Eye
} from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CreativeCanvas from "@/components/creative/CreativeCanvas";
import BatchProgressBar from "@/components/production/BatchProgressBar";
import { useBatchGenerate, type BatchResult } from "@/hooks/useBatchGenerate";

const pieceTypes = [
  { id: "post", label: "Post", icon: LayoutGrid },
  { id: "banner", label: "Banner", icon: Rows3 },
  { id: "story", label: "Story", icon: FileText },
  { id: "ad", label: "Ad", icon: Sparkles },
  { id: "thumbnail", label: "Thumb", icon: Image },
  { id: "vsl", label: "VSL", icon: Type },
];

const profileLabels: Record<string, string> = {
  economy: "Economia",
  standard: "Padrão",
  quality: "Qualidade",
};

const profileColors: Record<string, string> = {
  economy: "bg-cos-warning/10 text-cos-warning",
  standard: "bg-primary/10 text-primary",
  quality: "bg-cos-purple/10 text-cos-purple",
};

export default function Production() {
  const { spec, setSpec, selectAsset, activeProjectId } = useAssistant();
  const { session } = useAuth();
  const { results, progress, generate, cancel } = useBatchGenerate();
  const [userPrompt, setUserPrompt] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Fetch project niche & visual DNA for canvas styling
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left panel — Controls */}
      <div className="w-64 shrink-0 border-r border-border bg-card overflow-y-auto p-4 space-y-5">
        {/* Mode selector */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Modo</label>
          <div className="flex gap-1">
            {(["rapido", "orientado", "sprint"] as const).map((m) => (
              <button key={m} onClick={() => setSpec({ mode: m })}
                className={`flex-1 rounded-md py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all ${spec.mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {m === "rapido" ? "Rápido" : m === "orientado" ? "Orientado" : "Sprint"}
              </button>
            ))}
          </div>
        </div>

        {/* Piece type */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Tipo de Peça</label>
          <div className="grid grid-cols-3 gap-1.5">
            {pieceTypes.map((t) => (
              <button key={t.id} onClick={() => setSpec({ pieceType: t.id })}
                className={`flex flex-col items-center gap-1 rounded-md border py-2 text-[10px] transition-all ${spec.pieceType === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Output */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Saída</label>
          <div className="flex gap-1">
            {([
              { id: "text" as const, label: "Texto", icon: Type },
              { id: "image" as const, label: "Imagem", icon: Image },
              { id: "both" as const, label: "Ambos", icon: Zap },
            ]).map((o) => (
              <button key={o.id} onClick={() => setSpec({ output: o.id })}
                className={`flex-1 flex flex-col items-center gap-1 rounded-md border py-2 text-[10px] transition-all ${spec.output === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                <o.icon className="h-3.5 w-3.5" />{o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ratio */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Proporção</label>
          <div className="flex gap-1">
            {["1:1", "4:5", "9:16", "16:9"].map((r) => (
              <button key={r} onClick={() => setSpec({ ratio: r })}
                className={`flex-1 rounded-md border py-1.5 text-[10px] transition-all ${spec.ratio === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity — increased max to 50 */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Variações: {spec.quantity}</label>
          <input type="range" min={1} max={50} value={spec.quantity} onChange={(e) => setSpec({ quantity: +e.target.value })} className="w-full accent-primary" />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
            <span>1</span>
            <span>50</span>
          </div>
        </div>

        {/* Profile */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Perfil</label>
          <div className="flex gap-1">
            {(["economy", "standard", "quality"] as const).map((p) => (
              <button key={p} onClick={() => setSpec({ profile: p })}
                className={`flex-1 rounded-md border py-1.5 text-[10px] transition-all ${spec.profile === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                {profileLabels[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Provider */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Provedor</label>
          <select value={spec.provider} onChange={(e) => setSpec({ provider: e.target.value })}
            className="w-full rounded-md border border-border bg-secondary/50 px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none">
            <option value="Auto">Auto (Fallback)</option>
            <option value="google/gemini-3-flash-preview">Gemini Flash</option>
            <option value="google/gemini-2.5-pro">Gemini Pro</option>
            <option value="google/gemini-2.5-flash-lite">Gemini Lite</option>
          </select>
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:border-foreground/20 transition-colors">
            Usar Modelo
            <input type="checkbox" checked={spec.useModel} onChange={(e) => setSpec({ useModel: e.target.checked })} className="accent-primary" />
          </label>
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:border-foreground/20 transition-colors">
            Usar Perfil Visual
            <input type="checkbox" checked={spec.useVisualProfile} onChange={(e) => setSpec({ useVisualProfile: e.target.checked })} className="accent-primary" />
          </label>
        </div>

        {/* Prompt */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Prompt (opcional)</label>
          <textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="Ex: Foco em urgência e escassez..."
            rows={3} className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none" />
        </div>

        <button onClick={handleGenerate} disabled={progress.running}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {progress.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {progress.running ? `Gerando ${progress.completed}/${progress.total}...` : "Gerar"}
        </button>
      </div>

      {/* Center — Results */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Resultados</h2>
          <p className="text-xs text-muted-foreground">
            {results.length > 0
              ? `${results.length} variações geradas — ${spec.pieceType} ${spec.destination} ${spec.ratio}`
              : "Clique em Gerar para criar conteúdo com IA"}
          </p>
        </div>

        {/* Batch progress bar */}
        <BatchProgressBar progress={progress} onCancel={cancel} />

        {!progress.running && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <Zap className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm">Nenhum resultado ainda</p>
            <p className="text-xs">Configure os parâmetros e clique em Gerar</p>
          </div>
        )}

        {results.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.5) }}
            onClick={() => selectAsset({ id: r.id, title: r.headline, type: spec.pieceType, status: r.status, profile: profileLabels[r.profile] || r.profile, provider: r.provider })}
            className="rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-sm">{r.headline}</h3>
                <p className="text-sm text-muted-foreground">{r.body}</p>
                {r.cta && <p className="text-sm font-medium text-primary">{r.cta}</p>}
                {r.fallbackEvents && r.fallbackEvents.length > 0 && (
                  <p className="text-[10px] text-cos-warning mt-1">⚠ Fallback: {r.fallbackEvents[0]}</p>
                )}
              </div>
              {r.imageUrl ? (
                <div className="shrink-0 space-y-1">
                  <img src={r.imageUrl} alt={r.headline} className="w-32 h-32 rounded-md object-cover border border-border" />
                  <button onClick={(e) => { e.stopPropagation(); setPreviewId(previewId === r.id ? null : r.id); }}
                    className="w-full flex items-center justify-center gap-1 rounded-md bg-secondary/80 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    <Eye className="h-3 w-3" />Canvas
                  </button>
                </div>
              ) : (
                <div className="shrink-0 w-32 h-32 rounded-md bg-secondary border border-border flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {previewId === r.id && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 pt-4 border-t border-border">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Preview do Criativo ({spec.ratio})</p>
                <CreativeCanvas
                  imageUrl={r.imageUrl}
                  headline={r.headline}
                  body={r.body}
                  cta={r.cta}
                  ratio={spec.ratio}
                  niche={projectDna?.niche}
                  logoUrl={projectDna?.logoUrl}
                  brandColors={projectDna?.brandColors}
                />
              </motion.div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{r.provider}</span>
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono ${profileColors[r.profile] || "bg-secondary text-muted-foreground"}`}>
                  {profileLabels[r.profile] || r.profile}
                </span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{spec.ratio}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{r.creditCost} créditos</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
