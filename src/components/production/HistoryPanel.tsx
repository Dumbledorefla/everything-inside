import { motion } from "framer-motion";
import { Image, Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BatchResult } from "@/hooks/useBatchGenerate";

interface HistoryPanelProps {
  results: BatchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  profileLabels: Record<string, string>;
}

export default function HistoryPanel({ results, selectedId, onSelect, profileLabels }: HistoryPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border/15">
        <h3 className="text-[10px] font-mono-brand uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-1.5">
          <Clock className="h-3 w-3" /> Histórico
        </h3>
        <p className="text-[9px] text-muted-foreground/35 mt-0.5">
          {results.length} {results.length === 1 ? "variação" : "variações"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/20">
            <Image className="h-8 w-8 mb-2" />
            <p className="text-[10px]">Sem gerações ainda</p>
          </div>
        )}

        {results.map((r, i) => (
          <motion.button
            key={r.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.3) }}
            onClick={() => onSelect(r.id)}
            className={cn(
              "w-full rounded-xl border overflow-hidden transition-all text-left group",
              selectedId === r.id
                ? "border-primary/40 ring-2 ring-primary/20 shadow-md shadow-primary/5"
                : "border-border/15 hover:border-primary/20 hover:bg-card/20"
            )}
          >
            {r.imageUrl ? (
              <img
                src={r.imageUrl}
                alt={r.headline}
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square bg-card/20 flex items-center justify-center">
                <Image className="h-6 w-6 text-muted-foreground/15" />
              </div>
            )}
            <div className="p-2 space-y-1">
              <p className="text-[10px] font-medium leading-tight truncate text-foreground/80">
                {r.headline}
              </p>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono-brand text-muted-foreground/40">
                  {profileLabels[r.profile] || r.profile}
                </span>
                <span className="text-[9px] text-muted-foreground/25">·</span>
                <span className="text-[9px] font-mono-brand text-muted-foreground/40">
                  {r.creditCost}cr
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
