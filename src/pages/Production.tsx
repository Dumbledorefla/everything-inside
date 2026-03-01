import { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap, Image, Type, FileText, Send, Settings2, Wand2, Sparkles,
  LayoutGrid, Rows3, SlidersHorizontal
} from "lucide-react";

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
  Padrão: "bg-cos-cyan/10 text-cos-cyan",
  Qualidade: "bg-cos-purple/10 text-cos-purple",
};

export default function Production() {
  const [selectedType, setSelectedType] = useState("post");
  const [mode, setMode] = useState<"rapido" | "orientado" | "sprint">("rapido");
  const [output, setOutput] = useState<"text" | "image" | "both">("both");
  const [quantity, setQuantity] = useState(3);
  const [chatInput, setChatInput] = useState("");

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
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all ${
                  mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
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
                onClick={() => setSelectedType(t.id)}
                className={`flex flex-col items-center gap-1 rounded-md border py-2 text-[10px] transition-all ${
                  selectedType === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
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
                onClick={() => setOutput(o.id)}
                className={`flex-1 flex flex-col items-center gap-1 rounded-md border py-2 text-[10px] transition-all ${
                  output === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
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
            Variações: {quantity}
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={quantity}
            onChange={(e) => setQuantity(+e.target.value)}
            className="w-full accent-primary"
          />
        </div>

        {/* Profile */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Perfil</label>
          <div className="flex gap-1">
            {["Economia", "Padrão", "Qualidade"].map((p) => (
              <button key={p} className="flex-1 rounded-md border border-border py-1.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-all">
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          {["Usar Modelo", "Usar Perfil Visual"].map((t) => (
            <label key={t} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:border-foreground/20 transition-colors">
              {t}
              <input type="checkbox" className="accent-primary" />
            </label>
          ))}
        </div>

        {/* Generate button */}
        <button className="w-full flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors glow-cyan animate-pulse-glow">
          <Zap className="h-4 w-4" />
          Gerar
        </button>
      </div>

      {/* Center — Chat + Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Results */}
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
              className="rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-sm">{r.headline}</h3>
                  <p className="text-sm text-muted-foreground">{r.body}</p>
                  <p className="text-sm font-medium text-primary">{r.cta}</p>
                </div>
                {/* Placeholder image */}
                <div className="shrink-0 w-32 h-32 rounded-md bg-secondary border border-border flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground/30" />
                </div>
              </div>
              {/* Meta + Actions */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{r.provider}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono ${profileColors[r.profile]}`}>{r.profile}</span>
                </div>
                <div className="flex gap-1">
                  {["Aprovar", "Editar", "Regerar", "Arquivar"].map((a) => (
                    <button
                      key={a}
                      className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                        a === "Aprovar"
                          ? "bg-cos-success/10 text-cos-success hover:bg-cos-success/20"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Chat input */}
        <div className="border-t border-border bg-card p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Descreva o que quer gerar ou refinar..."
              className="flex-1 rounded-md border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
            <button className="rounded-md bg-primary px-4 text-primary-foreground hover:bg-primary/90 transition-colors">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right panel — Parameters */}
      <div className="w-56 shrink-0 border-l border-border bg-card overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Parâmetros</span>
        </div>

        {[
          { label: "Proporção", options: ["1:1", "4:5", "9:16"] },
          { label: "Destino", options: ["Feed", "Story", "Ads"] },
          { label: "Intensidade", options: ["Conservador", "Equilibrado", "Disruptivo"] },
        ].map((param) => (
          <div key={param.label}>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">{param.label}</label>
            <div className="space-y-1">
              {param.options.map((opt) => (
                <button
                  key={opt}
                  className="w-full rounded-md border border-border px-3 py-1.5 text-left text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">Provedor</label>
          <select className="w-full rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs text-foreground">
            <option>Auto</option>
            <option>Nano Banana 2</option>
            <option>Nano Banana Pro</option>
            <option>Nano Banana 2.5</option>
          </select>
        </div>
      </div>
    </div>
  );
}
