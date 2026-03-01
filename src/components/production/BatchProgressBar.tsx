import { Progress } from "@/components/ui/progress";
import { Loader2, X } from "lucide-react";
import type { BatchProgress } from "@/hooks/useBatchGenerate";

interface Props {
  progress: BatchProgress;
  onCancel: () => void;
}

export default function BatchProgressBar({ progress, onCancel }: Props) {
  if (!progress.running && progress.total === 0) return null;

  const pct = progress.total > 0
    ? Math.round(((progress.completed + progress.failed) / progress.total) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {progress.running && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
          <span>
            {progress.completed}/{progress.total} geradas
            {progress.failed > 0 && <span className="text-destructive ml-1">({progress.failed} falhas)</span>}
          </span>
        </div>
        {progress.running && (
          <button onClick={onCancel} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Progress value={pct} className="h-2" />
      {!progress.running && progress.completed > 0 && (
        <p className="text-[10px] text-muted-foreground">
          ✓ Concluído — {progress.completed} variações salvas como rascunho em Exploração
        </p>
      )}
    </div>
  );
}
