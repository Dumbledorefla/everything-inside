import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Download, Layers, Type, Move, Palette, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, ChevronDown, Copy,
} from "lucide-react";
import { resolveNicheStyle, preloadNicheFonts, type NicheStyle } from "@/lib/nicheStyles";
import { cleanFontFamily } from "@/lib/canvasFont";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────

export interface TextLayer {
  id: string;
  type: "headline" | "body" | "cta";
  content: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  fontSize: number; // px relative to canvas
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  color: string;
  textAlign: "left" | "center" | "right";
  maxWidthPercent: number;
  visible: boolean;
}

export interface LayerEditorProps {
  imageUrl: string | null;
  headline: string;
  body?: string;
  cta?: string;
  ratio: string;
  niche?: string | null;
  logoUrl?: string | null;
  brandColors?: { primary?: string; secondary?: string } | null;
  copyPlacement?: string;
  onLayersChange?: (layers: TextLayer[]) => void;
  onApplyToAll?: (layers: TextLayer[]) => void;
  showApplyToAll?: boolean;
  /** When true, starts with empty text layers (image already has text baked in) */
  textBakedInImage?: boolean;
  className?: string;
}

const RATIO_DIMS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1920, h: 1080 },
};

const FONT_OPTIONS = [
  "'Inter', sans-serif",
  "'Montserrat', sans-serif",
  "'Playfair Display', serif",
  "'Cinzel', serif",
  "'EB Garamond', serif",
  "'Fredoka', sans-serif",
  "'Quicksand', sans-serif",
  "'Roboto', sans-serif",
];

// ── Helpers ─────────────────────────────────────────────────────

function placementToPosition(placement?: string): { x: number; y: number } {
  if (!placement) return { x: 8, y: 60 };
  const p = placement.toLowerCase();
  const yMap: Record<string, number> = { topo: 15, centro: 45, rodapé: 70, rodape: 70 };
  const xMap: Record<string, number> = { esquerdo: 8, centro: 30, direito: 55, esquerda: 8, direita: 55 };
  let y = 60, x = 8;
  for (const [k, v] of Object.entries(yMap)) { if (p.includes(k)) { y = v; break; } }
  for (const [k, v] of Object.entries(xMap)) { if (p.includes(k)) { x = v; break; } }
  return { x, y };
}

function createDefaultLayers(
  headline: string, body: string | undefined, cta: string | undefined,
  style: NicheStyle, copyPlacement?: string
): TextLayer[] {
  const pos = placementToPosition(copyPlacement);
  const layers: TextLayer[] = [];

  if (headline) {
    layers.push({
      id: "headline",
      type: "headline",
      content: headline,
      x: pos.x,
      y: pos.y,
      fontSize: 48,
      fontFamily: style.fonts.headline,
      fontWeight: 800,
      fontStyle: "normal",
      color: style.palette.textLight,
      textAlign: "left",
      maxWidthPercent: 80,
      visible: true,
    });
  }

  if (body) {
    layers.push({
      id: "body",
      type: "body",
      content: body,
      x: pos.x,
      y: pos.y + 16,
      fontSize: 24,
      fontFamily: style.fonts.body,
      fontWeight: 400,
      fontStyle: "normal",
      color: style.palette.textLight,
      textAlign: "left",
      maxWidthPercent: 75,
      visible: true,
    });
  }

  if (cta) {
    layers.push({
      id: "cta",
      type: "cta",
      content: cta,
      x: pos.x,
      y: Math.min(pos.y + 28, 85),
      fontSize: 28,
      fontFamily: style.fonts.cta,
      fontWeight: 700,
      fontStyle: "normal",
      color: style.palette.textLight,
      textAlign: "left",
      maxWidthPercent: 60,
      visible: true,
    });
  }

  return layers;
}

// ── Component ───────────────────────────────────────────────────

export default function LayerEditor({
  imageUrl, headline, body, cta, ratio = "1:1",
  niche, logoUrl, brandColors, copyPlacement,
  onLayersChange, onApplyToAll, showApplyToAll, textBakedInImage, className,
}: LayerEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS["1:1"];
  const [style, setStyle] = useState<NicheStyle>(() => resolveNicheStyle(niche));

  const [layers, setLayers] = useState<TextLayer[]>(() =>
    createDefaultLayers(headline, body, cta, resolveNicheStyle(niche), copyPlacement)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);

  const selectedLayer = layers.find((l) => l.id === selectedId);

  useEffect(() => {
    const s = resolveNicheStyle(niche);
    setStyle(s);
    preloadNicheFonts(s);
  }, [niche]);

  // Sync layers when content changes externally
  useEffect(() => {
    setLayers(createDefaultLayers(headline, body, cta, style, copyPlacement));
  }, [headline, body, cta]);

  const updateLayer = useCallback((id: string, updates: Partial<TextLayer>) => {
    setLayers((prev) => {
      const next = prev.map((l) => l.id === id ? { ...l, ...updates } : l);
      onLayersChange?.(next);
      return next;
    });
  }, [onLayersChange]);

  const ctaColor = brandColors?.primary || style.palette.primary;

  const aspectClass = ratio === "1:1" ? "aspect-square"
    : ratio === "4:5" ? "aspect-[4/5]"
    : ratio === "9:16" ? "aspect-[9/16]"
    : "aspect-video";

  // ── Drag logic ────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent, layerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(layerId);
    setSelectedId(layerId);
    setShowToolbar(true);

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = layer.x;
    const origY = layer.y;

    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      updateLayer(layerId, {
        x: Math.max(0, Math.min(90, origX + dx)),
        y: Math.max(0, Math.min(95, origY + dy)),
      });
    };
    const onUp = () => {
      setDraggingId(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [layers, updateLayer]);

  // ── Export ────────────────────────────────────────────────────
  const exportPNG = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dims.w;
    canvas.height = dims.h;
    await document.fonts.ready;

    // Layer 0: Background
    if (imageUrl) {
      try {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = imageUrl; });
        const scale = Math.max(dims.w / img.width, dims.h / img.height);
        const x = (dims.w - img.width * scale) / 2;
        const y = (dims.h - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      } catch {
        ctx.fillStyle = style.palette.textDark;
        ctx.fillRect(0, 0, dims.w, dims.h);
      }
    } else {
      ctx.fillStyle = style.palette.textDark;
      ctx.fillRect(0, 0, dims.w, dims.h);
    }

    // Overlay gradient
    const gradient = ctx.createLinearGradient(0, dims.h * 0.3, 0, dims.h);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.5, style.palette.overlay.replace(/[\d.]+\)$/, "0.3)"));
    gradient.addColorStop(1, style.palette.overlay);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dims.w, dims.h);

    // Brand elements
    const mx = dims.w * 0.08;
    const my = dims.h * 0.06;
    ctx.fillStyle = ctaColor;
    ctx.fillRect(mx, my, dims.w * 0.12, 4);

    if (logoUrl) {
      try {
        const logo = new window.Image();
        logo.crossOrigin = "anonymous";
        await new Promise<void>((res, rej) => { logo.onload = () => res(); logo.onerror = rej; logo.src = logoUrl; });
        const logoH = dims.h * 0.05;
        const logoW = (logo.width / logo.height) * logoH;
        ctx.drawImage(logo, mx, my + 12, logoW, logoH);
      } catch { /* skip */ }
    }

    // Text layers
    for (const layer of layers) {
      if (!layer.visible || !layer.content) continue;

      const px = (layer.x / 100) * dims.w;
      const py = (layer.y / 100) * dims.h;
      const scaledSize = Math.round((layer.fontSize / 48) * dims.w * 0.05);
      const maxW = (layer.maxWidthPercent / 100) * dims.w;

      ctx.font = `${layer.fontStyle === "italic" ? "italic " : ""}${layer.fontWeight} ${scaledSize}px "${cleanFontFamily(layer.fontFamily)}"`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = layer.textAlign;

      const alignX = layer.textAlign === "center" ? px + maxW / 2
        : layer.textAlign === "right" ? px + maxW
        : px;

      // CTA button background
      if (layer.type === "cta") {
        const metrics = ctx.measureText(layer.content);
        const padX = scaledSize * 1.2;
        const padY = scaledSize * 0.5;
        const btnW = metrics.width + padX * 2;
        const btnH = scaledSize + padY * 2;
        ctx.fillStyle = ctaColor;
        roundRect(ctx, px, py - padY, btnW, btnH, style.cta.borderRadius);
        ctx.fill();
        ctx.fillStyle = layer.color;
        ctx.textAlign = "left";
        ctx.fillText(layer.content, px + padX, py + scaledSize * 0.75);
      } else {
        wrapText(ctx, layer.content, alignX, py + scaledSize, maxW, scaledSize * 1.2);
      }
    }

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `creative-${ratio}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [imageUrl, layers, dims, ratio, style, ctaColor, logoUrl]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={cn("space-y-3", className)}>
      {/* Canvas viewport */}
      <div
        ref={containerRef}
        className={cn("relative w-full max-w-lg mx-auto rounded-xl overflow-hidden border border-border/30 bg-card cursor-crosshair select-none", aspectClass)}
        onClick={() => { setSelectedId(null); setEditingId(null); setShowToolbar(false); }}
      >
        {/* Layer 0: Background */}
        {imageUrl ? (
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: style.palette.textDark }} />
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `linear-gradient(to top, ${style.palette.overlay}, ${style.palette.overlay.replace(/[\d.]+\)$/, "0.2)")}, transparent)`,
        }} />

        {/* Brand elements */}
        <div className="absolute top-0 left-0 right-0 p-[6%] pointer-events-none">
          <div className="h-1 rounded-full mb-2" style={{ width: "12%", backgroundColor: ctaColor }} />
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-5 object-contain opacity-90" draggable={false} />}
        </div>

        {/* Text layers (interactive) */}
        {layers.filter((l) => l.visible).map((layer) => (
          <div
            key={layer.id}
            className={cn(
              "absolute group transition-shadow duration-150",
              selectedId === layer.id && "ring-2 ring-primary/60 rounded",
              draggingId === layer.id && "cursor-grabbing",
              draggingId !== layer.id && "cursor-grab"
            )}
            style={{
              left: `${layer.x}%`,
              top: `${layer.y}%`,
              maxWidth: `${layer.maxWidthPercent}%`,
              zIndex: layer.type === "headline" ? 30 : layer.type === "cta" ? 20 : 25,
            }}
            onPointerDown={(e) => handlePointerDown(e, layer.id)}
            onClick={(e) => { e.stopPropagation(); setSelectedId(layer.id); setShowToolbar(true); }}
            onDoubleClick={(e) => { e.stopPropagation(); setEditingId(layer.id); }}
          >
            {layer.type === "cta" ? (
              <span
                className="inline-block px-4 py-1.5 text-xs font-bold"
                style={{
                  fontFamily: layer.fontFamily,
                  fontWeight: layer.fontWeight,
                  fontStyle: layer.fontStyle,
                  color: layer.color,
                  textAlign: layer.textAlign,
                  backgroundColor: ctaColor,
                  borderRadius: style.cta.borderRadius,
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))",
                }}
              >
                {editingId === layer.id ? (
                  <input
                    autoFocus
                    value={layer.content}
                    onChange={(e) => updateLayer(layer.id, { content: e.target.value })}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                    className="bg-transparent outline-none w-full min-w-[60px]"
                    style={{ color: layer.color, fontFamily: layer.fontFamily }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : layer.content}
              </span>
            ) : (
              <div
                style={{
                  fontFamily: layer.fontFamily,
                  fontWeight: layer.fontWeight,
                  fontStyle: layer.fontStyle,
                  color: layer.color,
                  textAlign: layer.textAlign,
                  fontSize: layer.type === "headline" ? "1.1rem" : "0.7rem",
                  lineHeight: layer.type === "headline" ? 1.2 : 1.5,
                  textShadow: layer.type === "headline"
                    ? "0 1px 3px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.3)"
                    : "0 1px 4px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.2)",
                  mixBlendMode: "normal",
                  WebkitBackgroundClip: "text",
                  paintOrder: "stroke fill",
                  WebkitTextStroke: layer.type === "headline" ? "0.3px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {editingId === layer.id ? (
                  <textarea
                    autoFocus
                    value={layer.content}
                    onChange={(e) => updateLayer(layer.id, { content: e.target.value })}
                    onBlur={() => setEditingId(null)}
                    rows={layer.type === "headline" ? 3 : 4}
                    className="bg-black/20 backdrop-blur-sm rounded outline-none w-full resize-none p-1"
                    style={{ color: layer.color, fontFamily: layer.fontFamily, fontSize: "inherit", fontWeight: layer.fontWeight }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : layer.content}
              </div>
            )}

            {/* Drag handle indicator */}
            {selectedId === layer.id && !editingId && (
              <div className="absolute -top-5 left-0 flex items-center gap-1 rounded bg-primary/90 px-1.5 py-0.5 text-[9px] text-primary-foreground font-mono">
                <Move className="h-2.5 w-2.5" />
                {layer.type === "headline" ? "Título" : layer.type === "cta" ? "CTA" : "Corpo"}
              </div>
            )}
          </div>
        ))}

        {/* Layer badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-[9px] text-white/70 pointer-events-none">
          <Layers className="h-2.5 w-2.5" />{layers.filter((l) => l.visible).length + 2} camadas
        </div>

      </div>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      {showToolbar && selectedLayer && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm p-3"
        >
          {/* Font selector */}
          <select
            value={selectedLayer.fontFamily}
            onChange={(e) => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
            className="rounded-lg border border-border/20 bg-background/40 px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>{cleanFontFamily(f)}</option>
            ))}
          </select>

          {/* Font size */}
          <div className="flex items-center gap-1">
            <Type className="h-3 w-3 text-muted-foreground/50" />
            <input
              type="number"
              value={selectedLayer.fontSize}
              onChange={(e) => updateLayer(selectedLayer.id, { fontSize: +e.target.value })}
              className="w-12 rounded-lg border border-border/20 bg-background/40 px-1.5 py-1 text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-primary/30"
              min={12} max={120}
            />
          </div>

          {/* Bold */}
          <button
            onClick={() => updateLayer(selectedLayer.id, { fontWeight: selectedLayer.fontWeight >= 700 ? 400 : 800 })}
            className={cn("rounded-lg border p-1.5 transition-all",
              selectedLayer.fontWeight >= 700 ? "border-primary/40 bg-primary/10 text-primary" : "border-border/20 text-muted-foreground/50 hover:text-foreground"
            )}
          >
            <Bold className="h-3 w-3" />
          </button>

          {/* Italic */}
          <button
            onClick={() => updateLayer(selectedLayer.id, { fontStyle: selectedLayer.fontStyle === "italic" ? "normal" : "italic" })}
            className={cn("rounded-lg border p-1.5 transition-all",
              selectedLayer.fontStyle === "italic" ? "border-primary/40 bg-primary/10 text-primary" : "border-border/20 text-muted-foreground/50 hover:text-foreground"
            )}
          >
            <Italic className="h-3 w-3" />
          </button>

          {/* Alignment */}
          {(["left", "center", "right"] as const).map((a) => {
            const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
            return (
              <button key={a}
                onClick={() => updateLayer(selectedLayer.id, { textAlign: a })}
                className={cn("rounded-lg border p-1.5 transition-all",
                  selectedLayer.textAlign === a ? "border-primary/40 bg-primary/10 text-primary" : "border-border/20 text-muted-foreground/50 hover:text-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
              </button>
            );
          })}

          {/* Color picker */}
          <div className="flex items-center gap-1">
            <Palette className="h-3 w-3 text-muted-foreground/50" />
            <input
              type="color"
              value={selectedLayer.color.startsWith("#") ? selectedLayer.color : "#FFFFFF"}
              onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
              className="h-6 w-6 rounded border-0 cursor-pointer"
            />
          </div>

          {/* Quick colors */}
          <div className="flex gap-1">
            {["#FFFFFF", "#000000", ctaColor, style.palette.primary, style.palette.accent].map((c, i) => (
              <button key={i}
                onClick={() => updateLayer(selectedLayer.id, { color: c })}
                className="h-5 w-5 rounded-full border border-border/30 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={exportPNG}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border/20 bg-secondary px-4 py-2.5 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar ({dims.w}×{dims.h})
        </button>

        {showApplyToAll && onApplyToAll && (
          <button onClick={() => onApplyToAll(layers)}
            className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            Aplicar a todos
          </button>
        )}
      </div>

      {/* Hidden export canvas */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ── Canvas Helpers ──────────────────────────────────────────────

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, cy);
      line = word + " ";
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, cy);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
