import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, Type, Shuffle, ArrowUpCircle, Download, Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasOverlayProps {
  imageUrl: string | null;
  headline?: string;
  body?: string;
  cta?: string;
  ratio: string;
  onVary?: () => void;
  onExport?: () => void;
  onEditText?: () => void;
  children?: React.ReactNode;
}

const RATIO_CLASSES: Record<string, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

const DEVICE_FRAMES = [
  { id: "none", icon: Maximize2, label: "Livre" },
  { id: "mobile", icon: Smartphone, label: "Mobile" },
  { id: "tablet", icon: Tablet, label: "Tablet" },
  { id: "desktop", icon: Monitor, label: "Desktop" },
];

export default function CanvasOverlay({
  imageUrl,
  headline,
  ratio,
  onVary,
  onExport,
  onEditText,
  children,
}: CanvasOverlayProps) {
  const [hovered, setHovered] = useState(false);
  const [deviceFrame, setDeviceFrame] = useState("none");

  const aspectClass = RATIO_CLASSES[ratio] || "aspect-square";

  return (
    <div className="flex flex-col items-center h-full">
      {/* Device frame selector */}
      <div className="flex items-center gap-1 mb-3">
        {DEVICE_FRAMES.map((d) => (
          <button
            key={d.id}
            onClick={() => setDeviceFrame(d.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all",
              deviceFrame === d.id
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground/40 hover:text-foreground hover:bg-card/30"
            )}
          >
            <d.icon className="h-3 w-3" />
            <span className="hidden sm:inline">{d.label}</span>
          </button>
        ))}
      </div>

      {/* Canvas area */}
      <div
        className={cn(
          "relative max-h-[calc(100%-80px)] w-full flex items-center justify-center flex-1",
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/20 bg-card/10 transition-all",
            deviceFrame === "mobile" && "max-w-[280px] rounded-[28px] border-[3px] border-muted-foreground/15 shadow-xl",
            deviceFrame === "tablet" && "max-w-[480px] rounded-[20px] border-[3px] border-muted-foreground/15 shadow-xl",
            deviceFrame === "desktop" && "max-w-full rounded-lg border-[3px] border-muted-foreground/15 shadow-xl",
            deviceFrame === "none" && "max-w-[600px]",
          )}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Device frame chrome */}
          {deviceFrame === "mobile" && (
            <div className="h-6 bg-muted-foreground/5 flex items-center justify-center">
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/10" />
            </div>
          )}
          {deviceFrame === "desktop" && (
            <div className="h-8 bg-muted-foreground/5 flex items-center gap-1.5 px-3">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-cos-warning/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-cos-success/30" />
              <div className="flex-1 mx-6 h-4 rounded-md bg-muted-foreground/5" />
            </div>
          )}

          {/* Image or placeholder */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={headline || "Criativo gerado"}
              className={cn("w-full object-cover", aspectClass)}
            />
          ) : children ? (
            <div className={cn("w-full", aspectClass)}>{children}</div>
          ) : (
            <div className={cn("w-full bg-gradient-to-br from-card/30 to-card/10 flex flex-col items-center justify-center gap-3", aspectClass)}>
              <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center">
                <Maximize2 className="h-8 w-8 text-primary/15" />
              </div>
              <p className="text-xs text-muted-foreground/30 font-medium">Canvas vazio</p>
              <p className="text-[10px] text-muted-foreground/20">Gere um criativo para visualizar aqui</p>
            </div>
          )}

          {/* Hover overlay with actions */}
          <AnimatePresence>
            {hovered && imageUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center gap-3"
              >
                {onEditText && (
                  <ActionButton icon={Type} label="Editar Texto" onClick={onEditText} />
                )}
                {onVary && (
                  <ActionButton icon={Shuffle} label="Variar" onClick={onVary} />
                )}
                <ActionButton icon={ArrowUpCircle} label="Upscale" onClick={() => {}} />
                {onExport && (
                  <ActionButton icon={Download} label="Exportar" onClick={onExport} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Canvas info */}
      {imageUrl && (
        <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground/40 font-mono-brand">
          <span>{ratio}</span>
          <span>·</span>
          <span>Passe o mouse para ações rápidas</span>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex flex-col items-center gap-1.5 rounded-xl bg-card/80 border border-border/30 px-4 py-3 text-foreground hover:bg-card hover:border-primary/30 transition-all group"
    >
      <Icon className="h-5 w-5 group-hover:text-primary transition-colors" />
      <span className="text-[10px] font-medium">{label}</span>
    </motion.button>
  );
}
