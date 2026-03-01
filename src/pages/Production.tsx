import { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap, Image, Type, FileText, Sparkles,
  LayoutGrid, Rows3
} from "lucide-react";
import { useAssistant } from "@/contexts/AssistantContext";

const pieceTypes = [
  { id: "post", label: "Post", icon: LayoutGrid },
  { id: "banner", label: "Banner", icon: Rows3 },
  { id: "story", label: "Story", icon: FileText },
  { id: "ad", label: "Ad", icon: Sparkles },
  { id: "thumbnail", label: "Thumb", icon: Image },
  { id: "vsl", label: "VSL", icon: Type },
];

const mockResults = [
  {
    id: 1,
    headline: "Transforme seu negócio digital em 90 dias",
    body: "Descubra o método que já ajudou mais de 5.000 empreendedores a faturar R$10k/mês com marketing digital.",
    cta: "Quero Começar Agora →",
    provider: "Gemini Pro",
    profile: "Padrão",
    status: "Rascunho",
  },
  {
    id: 2,
    headline: "De zero a R$10k: o caminho mais curto",
    body: "Pare de perder tempo com estratégias que não funcionam. O Expert Pro é o atalho que você precisava.",
    cta: "Garantir Minha Vaga",
    provider: "Gemini Flash",
    profile: "Economia",
    status: "Rascunho",
  },
  {
    id: 3,
    headline: "Seu faturamento merece um upgrade",
    body: "Com o Expert Pro, você aprende a criar campanhas que vendem no automático. Resultados desde a primeira semana.",
    cta: "Acessar o Método →",
    provider: "OpenAI",
    profile: "Qualidade",
    status: "Rascunho",
  },
];

const profileColors: Record<string, string> = {
  Economia: "bg-cos-warning/10 text-cos-warning",
  Padrão: "bg-primary/10 text-primary",
  Qualidade: "bg-cos-purple/10 text-cos-purple",
};

export default function Production() {
  const { spec, setSpec, selectAsset, openDock } = useAssistant();

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

        {/* Generate button */}
        <button className="w-full flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors glow-cyan animate-pulse-glow">
          <Zap className="h-4 w-4" />
          Gerar
        </button>
      </div>

      {/* Center — Results (full width, no right panel) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Resultados</h2>
          <p className="text-xs text-muted-foreground">3 variações geradas — Post Feed 1:1</p>
        </div>
        {mockResults.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => {
              selectAsset({
                id: String(r.id),
                title: r.headline,
                type: "Post",
                status: r.status,
                profile: r.profile,
                provider: r.provider,
              });
            }}
            className="rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-sm">{r.headline}</h3>
                <p className="text-sm text-muted-foreground">{r.body}</p>
                <p className="text-sm font-medium text-primary">{r.cta}</p>
              </div>
              <div className="shrink-0 w-32 h-32 rounded-md bg-secondary border border-border flex items-center justify-center">
                <Image className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{r.provider}</span>
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono ${profileColors[r.profile]}`}>{r.profile}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
