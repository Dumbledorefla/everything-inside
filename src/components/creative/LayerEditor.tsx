import { useState, useRef, useCallback, useEffect } from "react";
import {
  Download, Layers, Sparkles, Loader2, PenLine, Type, AlignLeft, Plus, Copy,
} from "lucide-react";
import { resolveNicheStyle, preloadNicheFonts, type NicheStyle } from "@/lib/nicheStyles";
import { cleanFontFamily } from "@/lib/canvasFont";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

function createDefaultLayers(
  headline: string, body: string | undefined, cta: string | undefined,
  style: NicheStyle, copyPlacement?: string, isDarkBg = true
): TextLayer[] {
  const pos = placementToPosition(copyPlacement);
  const layers: TextLayer[] = [];
  const textColor = isDarkBg ? style.palette.textLight : style.palette.textDark;

  if (headline) {
    layers.push({
      id: "headline", type: "headline", content: headline,
      x: pos.x, y: pos.y, fontSize: 52,
      fontFamily: style.fonts.headline, fontWeight: 800, fontStyle: "normal",
      color: textColor, textAlign: "left", maxWidthPercent: 80, visible: true,
    });
  }

  if (body) {
    layers.push({
      id: "body", type: "body", content: body,
      x: pos.x, y: pos.y + 16, fontSize: 22,
      fontFamily: style.fonts.body, fontWeight: 400, fontStyle: "normal",
      color: textColor, textAlign: "left", maxWidthPercent: 75, visible: true,
    });
  }

  if (cta) {
    layers.push({
      id: "cta", type: "cta", content: cta,
      x: pos.x, y: Math.min(pos.y + 28, 85), fontSize: 28,
      fontFamily: style.fonts.cta, fontWeight: 700, fontStyle: "normal",
      color: "#FFFFFF", textAlign: "left", maxWidthPercent: 60, visible: true,
    });
  }

  return layers;
}

// ── Main Component ──────────────────────────────────────────────

export default function LayerEditor({
  imageUrl, headline, body, cta, ratio = "1:1",
  niche, projectId, brandColors, copyPlacement,
  onLayersChange, onApplyToAll, onAiRendered, showApplyToAll, textBakedInImage, className,
}: LayerEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS["1:1"];
  const [style, setStyle] = useState<NicheStyle>(() => resolveNicheStyle(niche));
  const [isAiRendering, setIsAiRendering] = useState(false);
  const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);
  const [isDarkBackground, setIsDarkBackground] = useState(true);
  const [lightAngle, setLightAngle] = useState(135);
  const [layers, setLayers] = useState<TextLayer[]>(() =>
    textBakedInImage ? [] : createDefaultLayers(headline, body, cta, resolveNicheStyle(niche), copyPlacement)
  );

  const displayImageUrl = renderedImageUrl || imageUrl;

  // ── Sync niche style
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

  // ── Analyze background brightness
  useEffect(() => {
    if (!imageUrl) { setIsDarkBackground(true); setLightAngle(135); return; }
    analyzeImageBrightness(imageUrl).then((brightness) => {
      setIsDarkBackground(brightness < 140);
    });
  }, [imageUrl]);

  // ── Reset rendered image when source changes
  useEffect(() => {
    setRenderedImageUrl(null);
  }, [imageUrl]);

  // ── Sync layers when content changes externally
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

  const aspectClass = ratio === "1:1" ? "aspect-square"
    : ratio === "4:5" ? "aspect-[4/5]"
    : ratio === "9:16" ? "aspect-[9/16]"
    : "aspect-video";

  // ── Generate In-paint Mask
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

  // ── AI Render Pipeline
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
        setRenderedImageUrl(data.renderedImageUrl);
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

  // ── Export PNG
  const exportPNG = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dims.w;
    canvas.height = dims.h;

    const src = displayImageUrl;
    if (src) {
      try {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = src; });
        const scale = Math.max(dims.w / img.width, dims.h / img.height);
        const x = (dims.w - img.width * scale) / 2;
        const y = (dims.h - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      } catch {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, dims.w, dims.h);
      }
    } else {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, dims.w, dims.h);
    }

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `creative-${ratio}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [displayImageUrl, dims, ratio]);

  const LAYER_LABELS: Record<string, string> = {
    headline: "HEADLINE",
    body: "CORPO",
    cta: "CTA",
  };

  // ── Render
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-3">
        {/* Canvas — image only, no text overlay */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "relative w-full max-w-lg mx-auto rounded-xl overflow-hidden border border-border/30 bg-card",
              aspectClass
            )}
          >
            {displayImageUrl ? (
              <img
                src={displayImageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 bg-card flex items-center justify-center text-muted-foreground text-xs">
                Nenhuma imagem
              </div>
            )}

            {/* Rendered badge */}
            {renderedImageUrl && (
              <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-primary/80 px-2 py-0.5 text-[9px] text-primary-foreground font-medium pointer-events-none">
                <Sparkles className="h-2.5 w-2.5" />
                IA Renderizada
              </div>
            )}

            {/* Layer count badge */}
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-[9px] text-white/70 pointer-events-none">
              <Layers className="h-2.5 w-2.5" />{layers.filter((l) => l.visible).length} textos
            </div>

            {/* Empty state for baked-in images */}
            {textBakedInImage && layers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-30">
                <button
                  onClick={addManualLayers}
                  className="flex items-center gap-2 rounded-xl border border-border/30 bg-black/50 backdrop-blur-sm px-4 py-2.5 text-xs text-white/80 hover:bg-black/70 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar camadas de texto
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Side Panel: EDITAR TEXTOS (Desativado) ── */}
        {/*
        <div className="w-60 shrink-0 rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm overflow-y-auto max-h-[500px]">
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider">
              <PenLine className="h-4 w-4 text-primary" />
              Editar Textos
            </div>
            {layers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma camada de texto disponível.</p>
            ) : (
              layers.map((layer) => (
                <div key={layer.id} className="flex flex-col space-y-1.5">
                  <Label htmlFor={`layer-${layer.id}`} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    {layer.type === "headline" ? <Type className="h-3 w-3" /> : layer.type === "cta" ? <Sparkles className="h-3 w-3" /> : <AlignLeft className="h-3 w-3" />}
                    {LAYER_LABELS[layer.type] || layer.type.toUpperCase()}
                  </Label>
                  {layer.type === "body" ? (
                    <Textarea id={`layer-${layer.id}`} value={layer.content} onChange={(e) => updateLayer(layer.id, { content: e.target.value })} rows={3} className="text-xs resize-none" placeholder="Digite o corpo do texto..." />
                  ) : (
                    <Input id={`layer-${layer.id}`} value={layer.content} onChange={(e) => updateLayer(layer.id, { content: e.target.value })} className="text-xs" placeholder={layer.type === "headline" ? "Digite o título..." : "Texto do botão..."} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        */}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={exportPNG} className="gap-2">
          <Download className="h-3.5 w-3.5" />
          Exportar ({dims.w}×{dims.h})
        </Button>

        {/*
        <Button
          onClick={handleAiRender}
          disabled={isAiRendering || !imageUrl || layers.length === 0}
          size="sm"
          className={cn("flex-1 gap-2", isAiRendering && "cursor-wait")}
        >
          {isAiRendering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {isAiRendering ? "Renderizando..." : "Renderizar com IA"}
        </Button>
        */}

        {showApplyToAll && onApplyToAll && (
          <Button variant="outline" size="sm" onClick={() => onApplyToAll(layers)} className="gap-2">
            <Copy className="h-3.5 w-3.5" />
            Aplicar a todos
          </Button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
