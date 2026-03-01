import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const RATIO_CLASSES: Record<string, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

interface ShimmerCanvasProps {
  ratio: string;
  progress?: { completed: number; total: number };
}

export default function ShimmerCanvas({ ratio, progress }: ShimmerCanvasProps) {
  const aspectClass = RATIO_CLASSES[ratio] || "aspect-square";

  return (
    <div className={cn("relative w-full max-w-[600px] mx-auto rounded-2xl overflow-hidden border border-border/20", aspectClass)}>
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-card/30 via-card/10 to-card/30">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <motion.div
          className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        {progress && (
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/70">
              Gerando...
            </p>
            <p className="text-[10px] font-mono-brand text-muted-foreground/50 mt-1">
              {progress.completed}/{progress.total} variações
            </p>
            {/* Progress bar */}
            <div className="w-40 h-1 rounded-full bg-card/40 mt-2 overflow-hidden">
              <motion.div
                className="h-full bg-primary/60 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(progress.completed / progress.total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
