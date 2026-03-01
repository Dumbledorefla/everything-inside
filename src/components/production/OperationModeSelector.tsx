import { cn } from "@/lib/utils";
import { Palette, Share2, Target } from "lucide-react";

export type OperationMode = "foundation" | "social" | "performance";

interface ModeConfig {
  id: OperationMode;
  label: string;
  icon: React.ElementType;
  desc: string;
}

export const OPERATION_MODES: ModeConfig[] = [
  { id: "foundation", label: "Fundação", icon: Palette, desc: "Branding & Identidade" },
  { id: "social", label: "Social", icon: Share2, desc: "Conteúdo & Engajamento" },
  { id: "performance", label: "Performance", icon: Target, desc: "Vendas & Anúncios" },
];

export const MODE_PIECE_TYPES: Record<OperationMode, { id: string; label: string }[]> = {
  foundation: [
    { id: "logo", label: "Logo" },
    { id: "palette", label: "Paleta" },
    { id: "typography", label: "Tipografia" },
    { id: "brand_manual", label: "Manual" },
  ],
  social: [
    { id: "post", label: "Feed" },
    { id: "story", label: "Story" },
    { id: "carousel", label: "Carrossel" },
    { id: "highlight", label: "Destaque" },
    { id: "thumbnail", label: "Thumb" },
  ],
  performance: [
    { id: "ad", label: "Ad" },
    { id: "hero_banner", label: "Hero Banner" },
    { id: "ecommerce_banner", label: "E-commerce" },
    { id: "lp_section", label: "Seção LP" },
    { id: "vsl", label: "VSL" },
  ],
};

export const MODE_RATIOS: Record<OperationMode, string[]> = {
  foundation: ["1:1", "16:9"],
  social: ["1:1", "4:5", "9:16"],
  performance: ["1:1", "4:5", "9:16", "16:9"],
};

interface Props {
  mode: OperationMode;
  onChange: (mode: OperationMode) => void;
}

export default function OperationModeSelector({ mode, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 block">
        Foco de Operação
      </label>
      <div className="space-y-1.5">
        {OPERATION_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all",
              mode === m.id
                ? "border-primary/40 bg-primary/10 text-primary shadow-sm shadow-primary/10"
                : "border-border/20 text-muted-foreground/60 hover:border-primary/20 hover:text-foreground hover:bg-card/30"
            )}
          >
            <m.icon className={cn("h-4 w-4 shrink-0", mode === m.id && "drop-shadow-[0_0_4px_hsl(var(--primary)/0.4)]")} />
            <div>
              <p className="text-[11px] font-semibold leading-tight">{m.label}</p>
              <p className="text-[9px] text-muted-foreground/50">{m.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
