import { useAssistant } from "@/contexts/AssistantContext";
import { Check, Star, Archive, RefreshCw, Sparkles, Save, CalendarPlus, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionDef {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  requiresAsset: boolean;
  action: (ctx: ReturnType<typeof useAssistant>) => void;
}

const actions: ActionDef[] = [
  {
    id: "approve",
    label: "Aprovar Ativo",
    icon: Check,
    color: "text-cos-success bg-cos-success/10 hover:bg-cos-success/20",
    requiresAsset: true,
    action: (ctx) => ctx.selectedAsset && ctx.approveAsset(ctx.selectedAsset.id),
  },
  {
    id: "promote",
    label: "Promover a Oficial",
    icon: Star,
    color: "text-cos-cyan bg-cos-cyan/10 hover:bg-cos-cyan/20",
    requiresAsset: true,
    action: (ctx) => ctx.selectedAsset && ctx.promoteAsset(ctx.selectedAsset.id),
  },
  {
    id: "archive",
    label: "Arquivar",
    icon: Archive,
    color: "text-muted-foreground bg-secondary hover:bg-secondary/80",
    requiresAsset: true,
    action: (ctx) => ctx.selectedAsset && ctx.archiveAsset(ctx.selectedAsset.id),
  },
  {
    id: "regenerate",
    label: "Regerar",
    icon: RefreshCw,
    color: "text-foreground bg-secondary hover:bg-secondary/80",
    requiresAsset: true,
    action: (ctx) => ctx.selectedAsset && ctx.regenerateAsset(ctx.selectedAsset.id),
  },
  {
    id: "regen-quality",
    label: "Regerar com Qualidade",
    icon: Sparkles,
    color: "text-cos-purple bg-cos-purple/10 hover:bg-cos-purple/20",
    requiresAsset: true,
    action: (ctx) => ctx.selectedAsset && ctx.regenerateWithQuality(ctx.selectedAsset.id),
  },
];

const quickPrompts = [
  { label: "Gerar 5 criativos topo de funil", message: "Gere 5 criativos de topo de funil para o projeto atual" },
  { label: "Planejar 7 dias", message: "Crie um plano de conteúdo para os próximos 7 dias" },
  { label: "Sprint de ads 4:5", message: "Crie um sprint de ads com formato 4:5 para Instagram" },
];

export default function QuickActions() {
  const ctx = useAssistant();

  return (
    <div className="overflow-y-auto p-3 space-y-4">
      {/* Asset actions */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Ações do Ativo
        </p>
        {!ctx.selectedAsset && (
          <p className="text-xs text-muted-foreground/60 italic">Selecione um ativo na Biblioteca para ver ações.</p>
        )}
        <div className="space-y-1">
          {actions.map((a) => (
            <button
              key={a.id}
              disabled={a.requiresAsset && !ctx.selectedAsset}
              onClick={() => a.action(ctx)}
              className={cn(
                "w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                a.color
              )}
            >
              <a.icon className="h-3.5 w-3.5" />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick prompts */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Atalhos Rápidos
        </p>
        <div className="space-y-1">
          {quickPrompts.map((q) => (
            <button
              key={q.label}
              onClick={() => ctx.sendMessage(q.message)}
              className="w-full text-left rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
