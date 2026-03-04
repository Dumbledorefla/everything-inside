import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Cpu, Palette, FileText, Hash, CreditCard, ChevronRight, Check, RefreshCw, Copy, MessageSquareText } from "lucide-react";
import AssetRating from "./AssetRating";
import { cn } from "@/lib/utils";

interface AssetDrawerProps {
  asset: any;
  onClose: () => void;
  onApprove: (id: string) => void;
}

const statusLabels: Record<string, string> = {
  draft: "Rascunho", review: "Revisão", approved: "Aprovado", official: "Oficial", archived: "Arquivado", error: "Erro",
};
const statusColors: Record<string, string> = {
  draft: "bg-cos-warning/10 text-cos-warning",
  approved: "bg-primary/10 text-primary",
  official: "bg-cos-success/10 text-cos-success",
  archived: "bg-muted text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
};

export default function AssetDrawer({ asset, onClose, onApprove }: AssetDrawerProps) {
  if (!asset) return null;

  const version = asset.asset_versions?.[0];
  const meta = version?.generation_metadata || {};

  return (
    <AnimatePresence>
      {asset && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-lg border-l border-border bg-card overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-xl px-6 py-4">
              <div className="flex items-center gap-3">
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-mono", statusColors[asset.status])}>
                  {statusLabels[asset.status]}
                </span>
                <span className="text-sm font-semibold truncate max-w-[200px]">
                  {version?.headline || asset.title || "Sem título"}
                </span>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 hover:bg-secondary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Image */}
            {version?.image_url && (
              <div className="p-6 pb-0">
                <img
                  src={version.image_url}
                  alt={version.headline || "Asset"}
                  className="w-full rounded-2xl border border-border elevation-clay"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Copy */}
              {(version?.headline || version?.body || version?.cta) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Conteúdo
                  </h3>
                  {version.headline && (
                    <p className="text-base font-semibold">{version.headline}</p>
                  )}
                  {version.body && (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{version.body}</p>
                  )}
                  {version.cta && (
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium">
                      <ChevronRight className="h-3 w-3" /> {version.cta}
                    </div>
                  )}
                </div>
              )}

              {/* Copy / Caption */}
              {version?.copy_text && (
                <CopyTextSection initialText={version.copy_text} />
              )}

              {/* Metadata Grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5" /> Metadados
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <MetaItem label="Tipo" value={asset.output} />
                  <MetaItem label="Perfil" value={asset.profile_used || "standard"} />
                  <MetaItem label="Provedor" value={asset.provider_used || "auto"} />
                  <MetaItem label="Destino" value={asset.destination || "feed"} />
                  <MetaItem label="Ratio" value={asset.preset || "1:1"} />
                  <MetaItem label="Tentativas" value={String(asset.attempts || 1)} />
                </div>
              </div>

              {/* Technical */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5" /> Técnico
                </h3>
                <div className="rounded-xl bg-secondary/30 p-4 space-y-2">
                  {meta.model && <TechRow label="Modelo" value={meta.model} />}
                  {meta.prompt && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Prompt</p>
                      <p className="text-xs text-foreground/80 bg-background/50 rounded-lg p-3 font-mono leading-relaxed max-h-32 overflow-y-auto">{meta.prompt}</p>
                    </div>
                  )}
                  <TechRow label="ID" value={asset.id.slice(0, 12) + "..."} />
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Histórico
                </h3>
                <div className="space-y-2">
                  <TimelineItem label="Criado" date={asset.created_at} />
                  <TimelineItem label="Atualizado" date={asset.updated_at} />
                </div>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Performance</h3>
                <AssetRating assetId={asset.id} currentRating={asset.rating ?? null} />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => onApprove(asset.id)}
                  disabled={asset.status === "approved" || asset.status === "official"}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-cos-success/10 text-cos-success py-2.5 text-sm font-medium hover:bg-cos-success/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Check className="h-4 w-4" /> Aprovar
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors">
                  <RefreshCw className="h-4 w-4" /> Regerar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CopyTextSection({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <MessageSquareText className="h-3.5 w-3.5" /> Legenda / Descrição
      </h3>
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground leading-relaxed resize-none focus:border-primary/40 focus:outline-none"
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            import("sonner").then(({ toast }) => toast.success("Legenda copiada!"));
          }}
          className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2 py-1 text-[10px] font-medium hover:bg-primary/20 transition-colors"
        >
          <Copy className="h-3 w-3" /> Copiar
        </button>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/30 p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs font-mono font-medium">{value}</p>
    </div>
  );
}

function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-xs font-mono text-foreground/80">{value}</span>
    </div>
  );
}

function TimelineItem({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-mono text-foreground/70 ml-auto">
        {new Date(date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}
