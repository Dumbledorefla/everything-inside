import { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap, Image, Type, FileText, Sparkles,
  LayoutGrid, Rows3, Loader2
} from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const pieceTypes = [
  { id: "post", label: "Post", icon: LayoutGrid },
  { id: "banner", label: "Banner", icon: Rows3 },
  { id: "story", label: "Story", icon: FileText },
  { id: "ad", label: "Ad", icon: Sparkles },
  { id: "thumbnail", label: "Thumb", icon: Image },
  { id: "vsl", label: "VSL", icon: Type },
];

const profileColors: Record<string, string> = {
  economy: "bg-cos-warning/10 text-cos-warning",
  standard: "bg-primary/10 text-primary",
  quality: "bg-cos-purple/10 text-cos-purple",
};

const profileLabels: Record<string, string> = {
  economy: "Economia",
  standard: "Padrão",
  quality: "Qualidade",
};

interface GeneratedResult {
  id: string;
  headline: string;
  body: string;
  cta: string;
  imageUrl: string | null;
  provider: string;
  profile: string;
  status: string;
  creditCost: number;
}

export default function Production() {
  const { spec, setSpec, selectAsset, activeProjectId } = useAssistant();
  const { session } = useAuth();
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");

  const handleGenerate = async () => {
    if (!activeProjectId || !session) {
      toast.error("Você precisa estar logado em um projeto.");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("cos-generate", {
        body: {
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
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResults(data.results || []);
      const totalCredits = (data.results || []).reduce((s: number, r: GeneratedResult) => s + r.creditCost, 0);
      toast.success(`${data.results?.length || 0} variações geradas (${totalCredits} créditos)`);
    } catch (e: any) {
      console.error("Generate error:", e);
      toast.error(e.message || "Erro ao gerar conteúdo.");
    } finally {
      setLoading(false);
    }
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
              <button
                key={m}
                onClick={() => setSpec({ mode: m })}
                className={`flex-1 rounded-md py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all ${
                  spec.mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
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
              <button
                key={t.id}
                onClick={() => setSpec({ pieceType: t.id })}
                className={`flex flex-col items-center gap-1 rounded-md border py-2 text-[10px] transition-all ${
                  spec.pieceType === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
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
              <button
                key={o.id}
                onClick={() => setSpec({ output: o.id })}
                className={`flex-1 flex flex-col items-center gap-1 rounded-md border py-2 text-[10px] transition-all ${
                  spec.output === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                <o.icon className="h-3.5 w-3.5" />
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">
            Variações: {spec.quantity}
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={spec.quantity}
            onChange={(e) => setSpec({ quantity: +e.target.value })}
            className="w-full accent-primary"
          />
        </div>

        {/* Profile */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Perfil</label>
          <div className="flex gap-1">
            {([
              { id: "economy" as const, label: "Economia" },
              { id: "standard" as const, label: "Padrão" },
              { id: "quality" as const, label: "Qualidade" },
            ]).map((p) => (
              <button
                key={p.id}
                onClick={() => setSpec({ profile: p.id })}
                className={`flex-1 rounded-md border py-1.5 text-[10px] transition-all ${
                  spec.profile === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Provider */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Provedor</label>
          <select
            value={spec.provider}
            onChange={(e) => setSpec({ provider: e.target.value })}
            className="w-full rounded-md border border-border bg-secondary/50 px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
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

        {/* Prompt rápido */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Prompt (opcional)</label>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Ex: Foco em urgência e escassez..."
            rows={3}
            className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {loading ? "Gerando..." : "Gerar"}
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

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Gerando {spec.quantity} variações com perfil {profileLabels[spec.profile]}...</p>
            <p className="text-xs text-muted-foreground">Injetando DNA do projeto • Router {spec.provider}</p>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <Zap className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm">Nenhum resultado ainda</p>
            <p className="text-xs">Configure os parâmetros e clique em Gerar</p>
          </div>
        )}

        {results.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => {
              selectAsset({
                id: r.id,
                title: r.headline,
                type: spec.pieceType,
                status: r.status,
                profile: profileLabels[r.profile] || r.profile,
                provider: r.provider,
              });
            }}
            className="rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-sm">{r.headline}</h3>
                <p className="text-sm text-muted-foreground">{r.body}</p>
                {r.cta && <p className="text-sm font-medium text-primary">{r.cta}</p>}
              </div>
              {r.imageUrl ? (
                <img
                  src={r.imageUrl}
                  alt={r.headline}
                  className="shrink-0 w-32 h-32 rounded-md object-cover border border-border"
                />
              ) : (
                <div className="shrink-0 w-32 h-32 rounded-md bg-secondary border border-border flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{r.provider}</span>
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono ${profileColors[r.profile] || "bg-secondary text-muted-foreground"}`}>
                  {profileLabels[r.profile] || r.profile}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">{r.creditCost} créditos</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
