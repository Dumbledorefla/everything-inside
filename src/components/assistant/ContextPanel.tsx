import { useAssistant } from "@/contexts/AssistantContext";
import { Layers, Image, Type, Zap, Target, Gauge, Cpu, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const profileLabels = { economy: "Economia", standard: "Padrão", quality: "Qualidade" };
const profileColors = { economy: "text-cos-warning", standard: "text-primary", quality: "text-cos-purple" };

export default function ContextPanel() {
  const { spec, selectedAsset, activeProjectId } = useAssistant();

  return (
    <div className="overflow-y-auto p-3 space-y-4">
      {/* Project */}
      <Section title="Projeto" icon={Layers}>
        <InfoRow label="ID" value={activeProjectId?.slice(0, 8) + "…"} />
      </Section>

      {/* Generation Spec */}
      <Section title="Spec de Geração" icon={Zap}>
        <InfoRow label="Modo" value={spec.mode === "rapido" ? "Rápido" : spec.mode === "orientado" ? "Orientado" : "Sprint"} />
        <InfoRow label="Saída" value={spec.output === "both" ? "Texto + Imagem" : spec.output === "text" ? "Texto" : "Imagem"} />
        <InfoRow label="Peça" value={spec.pieceType} />
        <InfoRow label="Variações" value={String(spec.quantity)} />
        <InfoRow label="Proporção" value={spec.ratio} />
        <InfoRow label="Destino" value={spec.destination} />
        <InfoRow label="Intensidade" value={spec.intensity} />
        <InfoRow
          label="Perfil"
          value={profileLabels[spec.profile]}
          valueClassName={profileColors[spec.profile]}
        />
        <InfoRow label="Provedor" value={spec.provider} />
      </Section>

      {/* Selected Asset */}
      {selectedAsset && (
        <Section title="Ativo Selecionado" icon={Image}>
          <InfoRow label="Título" value={selectedAsset.title} />
          <InfoRow label="Tipo" value={selectedAsset.type} />
          <InfoRow label="Status" value={selectedAsset.status} />
          {selectedAsset.profile && <InfoRow label="Perfil" value={selectedAsset.profile} />}
          {selectedAsset.provider && <InfoRow label="Provedor" value={selectedAsset.provider} />}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium truncate max-w-[180px]", valueClassName)}>{value}</span>
    </div>
  );
}
