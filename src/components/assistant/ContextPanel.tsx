import { useAssistant } from "@/contexts/AssistantContext";
import { Layers, Image, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const profileLabels: Record<string, string> = { economy: "Economia", standard: "Padrão", quality: "Qualidade" };
const profileColors: Record<string, string> = { economy: "text-cos-warning", standard: "text-primary", quality: "text-cos-purple" };

export default function ContextPanel() {
  const { spec, selectedAsset, activeProjectId } = useAssistant();
  const { projectId } = useParams();
  const pid = activeProjectId || projectId;

  // Fetch live DNA for context display
  const { data: dna } = useQuery({
    queryKey: ["project-dna-context", pid],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_dna")
        .select("identity, audience, strategy, visual, version")
        .eq("project_id", pid!)
        .order("version", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!pid,
  });

  const identity = dna?.identity as any;
  const audience = dna?.audience as any;
  const strategy = dna?.strategy as any;

  const hasDNA = dna && (identity?.tom || audience?.dor_principal || strategy?.promessa);

  return (
    <div className="overflow-y-auto p-3 space-y-4">
      {/* DNA Summary */}
      <Section title={`DNA do Projeto${dna ? ` (v${dna.version})` : ""}`} icon={Layers}>
        {!hasDNA && (
          <div className="flex items-center gap-2 text-xs text-cos-warning">
            <AlertTriangle className="h-3 w-3" />
            <span>DNA não configurado. Configure na aba DNA.</span>
          </div>
        )}
        {identity?.tom && <InfoRow label="Tom" value={identity.tom} />}
        {identity?.personalidade && <InfoRow label="Personalidade" value={identity.personalidade} />}
        {audience?.dor_principal && <InfoRow label="Dor" value={audience.dor_principal} />}
        {audience?.publico_alvo && <InfoRow label="Público" value={audience.publico_alvo} />}
        {strategy?.promessa && <InfoRow label="Promessa" value={strategy.promessa} />}
        {strategy?.diferencial && <InfoRow label="Diferencial" value={strategy.diferencial} />}
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
