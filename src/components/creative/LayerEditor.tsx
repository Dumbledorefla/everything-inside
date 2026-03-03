import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Download, Layers, Type, Move, Palette, Bold, Italic, Lock,
  AlignLeft, AlignCenter, AlignRight, ChevronDown, Copy, Plus,
  Sparkles, Loader2, PenLine,
} from "lucide-react";
import { resolveNicheStyle, preloadNicheFonts, type NicheStyle } from "@/lib/nicheStyles";
import { cleanFontFamily } from "@/lib/canvasFont";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ── Types ───────────────────────────────────────────────────────

export interface TextLayer {
  id: string;
  type: "headline" | "body" | "cta";
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  color: string;
  textAlign: "left" | "center" | "right";
  maxWidthPercent: number;
  visible: boolean;
  blendMode?: string;
}

export interface LayerEditorProps {
  imageUrl: string | null;
  headline: string;
  body?: string;
  cta?: string;
  ratio: string;
  niche?: string | null;
  projectId?: string | null;
  logoUrl?: string | null;
  brandColors?: { primary?: string; secondary?: string } | null;
  copyPlacement?: string;
  onLayersChange?: (layers: TextLayer[]) => void;
  onApplyToAll?: (layers: TextLayer[]) => void;
  onAiRendered?: (renderedImageUrl: string) => void;
  showApplyToAll?: boolean;
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

const SNAP_THRESHOLD = 2;

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

function analyzeImageBrightness(imgSrc: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(80); return; }
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      }
      resolve(sum / (size * size));
    };
    img.onerror = () => resolve(80);
    img.src = imgSrc;
  });
}

function analyzeLightDirection(imgSrc: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 32;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(135); return; }
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let totalB = 0, wx = 0, wy = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const b = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          totalB += b;
          wx += b * x;
          wy += b * y;
        }
      }
      if (totalB === 0) { resolve(135); return; }
      const cx = wx / totalB;
      const cy = wy / totalB;
      const dx = cx - size / 2;
      const dy = cy - size / 2;
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      resolve(angle);
    };
    img.onerror = () => resolve(135);
    img.src = imgSrc;
  });
}

function createDefaultLayers(
  headline: string, body: string | undefined, cta: string | undefined,
  style: NicheStyle, copyPlacement?: string, isDarkBg = true
): TextLayer[] {
  const pos = placementToPosition(copyPlacement);
  const layers: TextLayer[] = [];
  const textColor = isDarkBg ? style.palette.textLight : style.palette.textDark;
  const blendMode = isDarkBg ? "screen" : "multiply";

  if (headline) {
    layers.push({
      id: "headline", type: "headline", content: headline,
      x: pos.x, y: pos.y, fontSize: 52,
      fontFamily: style.fonts.headline, fontWeight: 800, fontStyle: "normal",
      color: textColor, textAlign: "left", maxWidthPercent: 80, visible: true,
      blendMode,
    });
  }

  if (body) {
    layers.push({
      id: "body", type: "body", content: body,
      x: pos.x, y: pos.y + 16, fontSize: 22,
      fontFamily: style.fonts.body, fontWeight: 400, fontStyle: "normal",
      color: textColor, textAlign: "left", maxWidthPercent: 75, visible: true,
      blendMode,
    });
  }

  if (cta) {
    layers.push({
      id: "cta", type: "cta", content: cta,
      x: pos.x, y: Math.min(pos.y + 28, 85), fontSize: 28,
      fontFamily: style.fonts.cta, fontWeight: 700, fontStyle: "normal",
      color: "#FFFFFF", textAlign: "left", maxWidthPercent: 60, visible: true,
      blendMode: "normal",
    });
  }

  return layers;
}

// ── Directional Occlusion Shadows ──────────────────────────────

function getDirectionalShadow(lightAngle: number, type: "headline" | "body" | "cta"): string {
  const shadowAngle = (lightAngle + 180) % 360;
  const rad = shadowAngle * Math.PI / 180;

  if (type === "headline") {
    const ox = Math.round(Math.cos(rad) * 2);
    const oy = Math.round(Math.sin(rad) * 4);
    return `${ox}px ${oy}px 12px rgba(0,0,0,0.45), 0px 1px 2px rgba(0,0,0,0.3), ${ox * 0.5}px ${oy * 0.5}px 5px rgba(0,0,0,0.2)`;
  }
  if (type === "body") {
    const ox = Math.round(Math.cos(rad) * 1);
    const oy = Math.round(Math.sin(rad) * 2);
    return `${ox}px ${oy}px 6px rgba(0,0,0,0.35), 0px 1px 1px rgba(0,0,0,0.2), ${ox * 0.5}px ${oy * 0.5}px 3px rgba(0,0,0,0.15)`;
  }
  return "none";
}

function getLayerTextStyle(layer: TextLayer, lightAngle = 135, _isDarkBg = true) {
  const isMultiply = layer.blendMode === "multiply";
  const blendOpacity = isMultiply ? 0.88 : 1;

  const base = {
    textShadow: getDirectionalShadow(lightAngle, layer.type),
    WebkitTextStroke: "none" as const,
    filter: "contrast(1.02) brightness(0.98) blur(0.3px)",
    opacity: blendOpacity,
  };

  if (layer.type === "headline") {
    return { ...base, fontSize: "clamp(1rem, 3.5vw, 1.3rem)", lineHeight: 1.1, letterSpacing: "0.1em" };
  }
  if (layer.type === "body") {
    return { ...base, fontSize: "clamp(0.6rem, 1.8vw, 0.75rem)", lineHeight: 1.5, letterSpacing: "0.02em" };
  }
  return {};
}

// ── Side Panel Component ────────────────────────────────────────

function TextEditPanel({
  layers,
  onUpdateLayer,
  className,
}: {
  layers: TextLayer[];
  onUpdateLayer: (id: string, updates: Partial<TextLayer>) => void;
  className?: string;
}) {
  const layerLabels: Record<string, { label: string; icon: React.ReactNode; placeholder: string }> = {
    headline: { label: "Headline", icon: <Type className="h-3.5 w-3.5" />, placeholder: "Digite o título..." },
    body: { label: "Corpo", icon: <AlignLeft className="h-3.5 w-3.5" />, placeholder: "Digite o corpo do texto..." },
    cta: { label: "CTA", icon: <Sparkles className="h-3.5 w-3.5" />, placeholder: "Texto do botão..." },
  };

  if (layers.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-4 text-xs text-muted-foreground", className)}>
        Nenhuma camada de texto disponível.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3 p-3", className)}>
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80 uppercase tracking-wider">
        <PenLine className="h-3.5 w-3.5 text-primary" />
        Editar Textos
      </div>

      {layers.map((layer) => {
        const meta = layerLabels[layer.type] || { label: layer.type, icon: <Type className="h-3.5 w-3.5" />, placeholder: "" };
        return (
          <div key={layer.id} className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              {meta.icon}
              {meta.label}
              {!layer.visible && <span className="text-[9px] text-muted-foreground/40">(oculto)</span>}
            </label>
            <textarea
              value={layer.content}
              onChange={(e) => onUpdateLayer(layer.id, { content: e.target.value })}
              placeholder={meta.placeholder}
              rows={layer.type === "headline" ? 2 : layer.type === "body" ? 3 : 1}
              className={cn(
                "w-full rounded-lg border border-border/30 bg-background/60 px-3 py-2 text-xs text-foreground",
                "placeholder:text-muted-foreground/40 resize-none",
                "focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40",
                "transition-colors"
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────

export default function LayerEditor({
  imageUrl, headline, body, cta, ratio = "1:1",
  niche, projectId, logoUrl, brandColors, copyPlacement,
  onLayersChange, onApplyToAll, onAiRendered, showApplyToAll, textBakedInImage, className,
}: LayerEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS["1:1"];
  const [style, setStyle] = useState<NicheStyle>(() => resolveNicheStyle(niche));
  const [isAiRendering, setIsAiRendering] = useState(false);

  const [isDarkBackground, setIsDarkBackground] = useState(true);
  const [lightAngle, setLightAngle] = useState(135);
  const [layers, setLayers] = useState<TextLayer[]>(() =>
    textBakedInImage ? [] : createDefaultLayers(headline, body, cta, resolveNicheStyle(niche), copyPlacement)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number }>({});

  const selectedLayer = layers.find((l) => l.id === selectedId);

  // ── Sync niche style ──────────────────────────────────────────
  useEffect(() => {
    const s = resolveNicheStyle(niche);
    setStyle(s);
    preloadNicheFonts(s);
    setLayers((prev) => prev.map((l) => ({
      ...l,
      fontFamily: l.type === "headline" ? s.fonts.headline
        : l.type === "body" ? s.fonts.body
        : s.fonts.cta,
    })));
  }, [niche]);

  // ── Analyze background brightness + light direction ──────────
  useEffect(() => {
    if (!imageUrl) { setIsDarkBackground(true); setLightAngle(135); return; }
    Promise.all([
      analyzeImageBrightness(imageUrl),
      analyzeLightDirection(imageUrl),
    ]).then(([brightness, angle]) => {
      const dark = brightness < 140;
      setIsDarkBackground(dark);
      setLightAngle(angle);
      const blendMode = dark ? "screen" : "multiply";
      setLayers((prev) => prev.map((l) => {
        if (l.type === "cta") return { ...l, blendMode: "normal" };
        const autoColor = dark ? style.palette.textLight : style.palette.textDark;
        return { ...l, color: autoColor, blendMode };
      }));
    });
  }, [imageUrl, style]);

  // ── Sync layers when content changes externally ──────────────
  useEffect(() => {
    if (textBakedInImage) return;
    setLayers(createDefaultLayers(headline, body, cta, style, copyPlacement, isDarkBackground));
  }, [headline, body, cta]);

  const updateLayer = useCallback((id: string, updates: Partial<TextLayer>) => {
    setLayers((prev) => {
      const next = prev.map((l) => l.id === id ? { ...l, ...updates } : l);
      onLayersChange?.(next);
      return next;
    });
  }, [onLayersChange]);

  const addManualLayers = useCallback(() => {
    const newLayers = createDefaultLayers(headline, body, cta, style, copyPlacement, isDarkBackground);
    setLayers(newLayers);
    onLayersChange?.(newLayers);
  }, [headline, body, cta, style, copyPlacement, isDarkBackground, onLayersChange]);

  const ctaColor = brandColors?.primary || style.palette.primary;

  const aspectClass = ratio === "1:1" ? "aspect-square"
    : ratio === "4:5" ? "aspect-[4/5]"
    : ratio === "9:16" ? "aspect-[9/16]"
    : "aspect-video";

  // ── Drag logic with snap ──────────────────────────────────────
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
      let dx = ((ev.clientX - startX) / rect.width) * 100;
      let dy = ((ev.clientY - startY) / rect.height) * 100;
      let newX = Math.max(0, Math.min(90, origX + dx));
      let newY = Math.max(0, Math.min(95, origY + dy));
      const guides: { x?: number; y?: number } = {};
      if (Math.abs(newX - 50) < SNAP_THRESHOLD) { newX = 50; guides.x = 50; }
      if (Math.abs(newY - 50) < SNAP_THRESHOLD) { newY = 50; guides.y = 50; }
      for (const third of [33.33, 66.66]) {
        if (Math.abs(newX - third) < SNAP_THRESHOLD) { newX = third; guides.x = third; }
        if (Math.abs(newY - third) < SNAP_THRESHOLD) { newY = third; guides.y = third; }
      }
      setSnapGuides(guides);
      updateLayer(layerId, { x: newX, y: newY });
    };
    const onUp = () => {
      setDraggingId(null);
      setSnapGuides({});
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [layers, updateLayer]);

  // ── Generate In-paint Mask ────────────────────────────────────
  const generateInpaintMask = useCallback((
    imgW: number, imgH: number, visibleLayers: TextLayer[]
  ): string => {
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = imgW;
    maskCanvas.height = imgH;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, imgW, imgH);

    ctx.fillStyle = "#FFFFFF";
    for (const layer of visibleLayers) {
      const lx = (layer.x / 100) * imgW;
      const ly = (layer.y / 100) * imgH;
      const maxW = (layer.maxWidthPercent / 100) * imgW;
      const scaledFontSize = (layer.fontSize / 52) * imgH * 0.06;
      const lines = Math.ceil(layer.content.length / (maxW / (scaledFontSize * 0.6)));
      const blockH = scaledFontSize * 1.4 * Math.max(lines, 1);
      const pad = scaledFontSize * 0.5;
      ctx.fillRect(lx - pad, ly - pad, maxW + pad * 2, blockH + pad * 2);
    }

    return maskCanvas.toDataURL("image/png");
  }, []);

  // ── AI Render Pipeline ─────────────────────────────────────────
  const handleAiRender = useCallback(async () => {
    if (!imageUrl || layers.length === 0) {
      toast.error("Adicione texto e uma imagem antes de renderizar.");
      return;
    }
    setIsAiRendering(true);
    toast.info("Renderizando com IA... Isso pode levar alguns segundos.");

    try {
      const visibleLayers = layers.filter(l => l.visible && l.content);
      const layerMeta = visibleLayers.map(l => ({
        type: l.type, content: l.content, x: l.x, y: l.y,
        fontSize: l.fontSize, fontFamily: l.fontFamily,
        fontWeight: l.fontWeight, color: l.color, textAlign: l.textAlign,
      }));

      const maskDataUrl = generateInpaintMask(dims.w, dims.h, visibleLayers);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sessão expirada. Faça login novamente para renderizar.");
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-ai-finalize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            imageUrl, layers: layerMeta,
            niche: niche || undefined, ratio, lightAngle, isDarkBackground,
            maskDataUrl: maskDataUrl || undefined,
            projectId: projectId || undefined,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      const data = await resp.json();

      if (data.renderedImageUrl) {
        toast.success("✨ Imagem renderizada com sucesso!");
        onAiRendered?.(data.renderedImageUrl);
      } else {
        throw new Error("A IA não retornou uma imagem.");
      }
    } catch (e: any) {
      console.error("AI render error:", e);
      toast.error(e.message || "Falha na renderização com IA.");
    } finally {
      setIsAiRendering(false);
    }
  }, [imageUrl, layers, niche, ratio, lightAngle, isDarkBackground, dims, generateInpaintMask, onAiRendered, projectId]);

  // ── Export PNG ────────────────────────────────────────────────
  const exportPNG = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dims.w;
    canvas.height = dims.h;
    await document.fonts.ready;

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

    const gradient = ctx.createLinearGradient(0, dims.h * 0.3, 0, dims.h);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.5, style.palette.overlay.replace(/[\d.]+\)$/, "0.3)"));
    gradient.addColorStop(1, style.palette.overlay);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dims.w, dims.h);

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

    const shadowRad = ((lightAngle + 180) % 360) * Math.PI / 180;

    for (const layer of layers) {
      if (!layer.visible || !layer.content) continue;
      const px = (layer.x / 100) * dims.w;
      const py = (layer.y / 100) * dims.h;
      const scaledSize = Math.round((layer.fontSize / 48) * dims.w * 0.05);
      const maxW = (layer.maxWidthPercent / 100) * dims.w;

      ctx.font = `${layer.fontStyle === "italic" ? "italic " : ""}${layer.fontWeight} ${scaledSize}px "${cleanFontFamily(layer.fontFamily)}"`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = layer.textAlign;

      if (layer.blendMode === "screen") ctx.globalCompositeOperation = "screen";
      else if (layer.blendMode === "multiply") ctx.globalCompositeOperation = "multiply";
      else if (layer.blendMode === "overlay") ctx.globalCompositeOperation = "overlay";
      else ctx.globalCompositeOperation = "source-over";

      if (layer.blendMode === "multiply") ctx.globalAlpha = 0.88;
      else ctx.globalAlpha = 1;

      const alignX = layer.textAlign === "center" ? px + maxW / 2
        : layer.textAlign === "right" ? px + maxW : px;

      if (layer.type === "headline") {
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = Math.round(Math.cos(shadowRad) * 2);
        ctx.shadowOffsetY = Math.round(Math.sin(shadowRad) * 4);
      } else if (layer.type === "body") {
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = Math.round(Math.cos(shadowRad) * 1);
        ctx.shadowOffsetY = Math.round(Math.sin(shadowRad) * 2);
      }

      if (layer.type === "cta") {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        const metrics = ctx.measureText(layer.content);
        const padX = scaledSize * 1.2;
        const padY = scaledSize * 0.5;
        const btnW = metrics.width + padX * 2;
        const btnH = scaledSize + padY * 2;
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = ctaColor;
        roundRect(ctx, px, py - padY, btnW, btnH, style.cta.borderRadius);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.fillStyle = layer.color;
        ctx.textAlign = "left";
        ctx.fillText(layer.content, px + padX, py + scaledSize * 0.75);
      } else {
        wrapText(ctx, layer.content, alignX, py + scaledSize, maxW, scaledSize * 1.2);
      }

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `creative-${ratio}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [imageUrl, layers, dims, ratio, style, ctaColor, logoUrl, lightAngle]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={cn("space-y-3", className)}>
      {/* Main layout: Canvas + Side Panel */}
      <div className="flex gap-3">
        {/* Canvas viewport */}
        <div className="flex-1 min-w-0">
          <div
            ref={containerRef}
            className={cn("relative w-full max-w-lg mx-auto rounded-xl overflow-hidden border border-border/30 bg-card cursor-crosshair select-none", aspectClass)}
            onClick={() => { setSelectedId(null); setShowToolbar(false); }}
          >
            {/* Background */}
            {imageUrl ? (
              <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="absolute inset-0 bg-card" />
            )}

            {/* Overlay gradient */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `linear-gradient(to top, ${style.palette.overlay}, ${style.palette.overlay.replace(/[\d.]+\)$/, "0.2)")}, transparent)`,
            }} />

            {/* Snap alignment guides */}
            {draggingId && (
              <>
                {snapGuides.x !== undefined && (
                  <div className="absolute top-0 bottom-0 pointer-events-none z-50"
                    style={{ left: `${snapGuides.x}%`, width: 1, background: "rgba(99,182,255,0.6)" }}
                  />
                )}
                {snapGuides.y !== undefined && (
                  <div className="absolute left-0 right-0 pointer-events-none z-50"
                    style={{ top: `${snapGuides.y}%`, height: 1, background: "rgba(99,182,255,0.6)" }}
                  />
                )}
                <div className="absolute top-0 bottom-0 pointer-events-none z-40" style={{ left: "50%", width: 1, background: "rgba(255,255,255,0.08)" }} />
                <div className="absolute left-0 right-0 pointer-events-none z-40" style={{ top: "50%", height: 1, background: "rgba(255,255,255,0.08)" }} />
              </>
            )}

            {/* Brand elements */}
            <div className="absolute top-0 left-0 right-0 p-[6%] pointer-events-none">
              <div className="h-1 rounded-full mb-2" style={{ width: "12%", backgroundColor: ctaColor }} />
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-5 object-contain opacity-90" draggable={false} />}
            </div>

            {/* ── Text layers (read-only on canvas, editable in side panel) ── */}
            {layers.filter((l) => l.visible).map((layer) => {
              const hierarchyStyle = getLayerTextStyle(layer, lightAngle, isDarkBackground);
              const effectiveBlend = layer.blendMode || "normal";

              return (
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
                    mixBlendMode: effectiveBlend as any,
                  }}
                  onPointerDown={(e) => handlePointerDown(e, layer.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(layer.id); setShowToolbar(true); }}
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
                        textShadow: "none",
                        filter: "drop-shadow(2px 4px 6px rgba(0,0,0,0.5))",
                        mixBlendMode: "normal",
                      }}
                    >
                      {layer.content}
                    </span>
                  ) : (
                    <div
                      style={{
                        fontFamily: layer.fontFamily,
                        fontWeight: layer.fontWeight,
                        fontStyle: layer.fontStyle,
                        color: layer.color,
                        textAlign: layer.textAlign,
                        ...hierarchyStyle,
                        paintOrder: "stroke fill",
                      }}
                    >
                      {layer.content}
                    </div>
                  )}

                  {/* Drag handle */}
                  {selectedId === layer.id && (
                    <div className="absolute -top-5 left-0 flex items-center gap-1 rounded bg-primary/90 px-1.5 py-0.5 text-[9px] text-primary-foreground font-mono">
                      <Move className="h-2.5 w-2.5" />
                      {layer.type === "headline" ? "Título" : layer.type === "cta" ? "CTA" : "Corpo"}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty state for baked-in images */}
            {textBakedInImage && layers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-30">
                <button
                  onClick={(e) => { e.stopPropagation(); addManualLayers(); }}
                  className="flex items-center gap-2 rounded-xl border border-border/30 bg-black/50 backdrop-blur-sm px-4 py-2.5 text-xs text-white/80 hover:bg-black/70 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar camadas de texto
                </button>
              </div>
            )}

            {/* Layer badge */}
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-[9px] text-white/70 pointer-events-none">
              <Layers className="h-2.5 w-2.5" />{layers.filter((l) => l.visible).length + 2} camadas
            </div>

            {/* Blend indicator */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-0.5 text-[9px] text-white/60 pointer-events-none">
              {isDarkBackground ? "☀ Screen" : "● Multiply"}
              <span className="opacity-40">·</span>
              <span className="opacity-50">L{Math.round(lightAngle)}°</span>
            </div>
          </div>
        </div>

        {/* ── Side Panel: Text Editing ──────────────────────────── */}
        <div className="w-56 shrink-0 rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm overflow-y-auto max-h-[500px]">
          <TextEditPanel
            layers={layers}
            onUpdateLayer={updateLayer}
          />
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      {showToolbar && selectedLayer && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm p-3"
        >
          <div className="flex items-center gap-1">
            <select
              value={selectedLayer.fontFamily}
              onChange={(e) => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
              className="rounded-lg border border-border/20 bg-background/40 px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{cleanFontFamily(f)}</option>
              ))}
            </select>
            {selectedLayer.fontFamily === (selectedLayer.type === "headline" ? style.fonts.headline : selectedLayer.type === "body" ? style.fonts.body : style.fonts.cta) && (
              <span title="Fonte alinhada com o DNA da marca"><Lock className="h-3 w-3 text-primary/70" /></span>
            )}
          </div>

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

          <button
            onClick={() => updateLayer(selectedLayer.id, { fontWeight: selectedLayer.fontWeight >= 700 ? 400 : 800 })}
            className={cn("rounded-lg border p-1.5 transition-all",
              selectedLayer.fontWeight >= 700 ? "border-primary/40 bg-primary/10 text-primary" : "border-border/20 text-muted-foreground/50 hover:text-foreground"
            )}
          >
            <Bold className="h-3 w-3" />
          </button>

          <button
            onClick={() => updateLayer(selectedLayer.id, { fontStyle: selectedLayer.fontStyle === "italic" ? "normal" : "italic" })}
            className={cn("rounded-lg border p-1.5 transition-all",
              selectedLayer.fontStyle === "italic" ? "border-primary/40 bg-primary/10 text-primary" : "border-border/20 text-muted-foreground/50 hover:text-foreground"
            )}
          >
            <Italic className="h-3 w-3" />
          </button>

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

          <div className="flex items-center gap-1">
            <Palette className="h-3 w-3 text-muted-foreground/50" />
            <input
              type="color"
              value={selectedLayer.color.startsWith("#") ? selectedLayer.color : "#FFFFFF"}
              onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
              className="h-6 w-6 rounded border-0 cursor-pointer"
            />
          </div>

          <div className="flex gap-1">
            {["#FFFFFF", "#000000", ctaColor, style.palette.primary, style.palette.accent].map((c, i) => (
              <button key={i}
                onClick={() => updateLayer(selectedLayer.id, { color: c })}
                className="h-5 w-5 rounded-full border border-border/30 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Blend mode selector */}
          <div className="flex items-center gap-1 border-l border-border/20 pl-2 ml-1">
            <span className="text-[9px] text-muted-foreground/50">Blend</span>
            <select
              value={selectedLayer.blendMode || "normal"}
              onChange={(e) => updateLayer(selectedLayer.id, { blendMode: e.target.value })}
              className="rounded-lg border border-border/20 bg-background/40 px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="normal">Normal</option>
              <option value="screen">Screen</option>
              <option value="multiply">Multiply</option>
              <option value="overlay">Overlay</option>
              <option value="soft-light">Soft Light</option>
              <option value="color-dodge">Color Dodge</option>
            </select>
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={exportPNG}
          className="flex items-center justify-center gap-2 rounded-xl border border-border/20 bg-secondary px-4 py-2.5 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar ({dims.w}×{dims.h})
        </button>

        <button
          onClick={handleAiRender}
          disabled={isAiRendering || !imageUrl || layers.length === 0}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium transition-all",
            isAiRendering
              ? "border-primary/20 bg-primary/5 text-primary/60 cursor-wait"
              : "border-primary/40 bg-gradient-to-r from-primary/15 to-accent/15 text-primary hover:from-primary/25 hover:to-accent/25"
          )}
        >
          {isAiRendering ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isAiRendering ? "Renderizando..." : "Renderizar com IA"}
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
