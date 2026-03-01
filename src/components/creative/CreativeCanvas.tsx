import { useRef, useCallback, useEffect, useState } from "react";
import { Download, Layers } from "lucide-react";
import { type NicheStyle, resolveNicheStyle, preloadNicheFonts } from "@/lib/nicheStyles";

interface CreativeCanvasProps {
  imageUrl: string | null;
  headline: string;
  body?: string;
  cta?: string;
  ratio: string;
  niche?: string | null;
  logoUrl?: string | null;
  brandColors?: { primary?: string; secondary?: string } | null;
  className?: string;
  onExport?: (dataUrl: string) => void;
}

const RATIO_DIMS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1920, h: 1080 },
};

export default function CreativeCanvas({
  imageUrl, headline, body, cta, ratio = "1:1",
  niche, logoUrl, brandColors, className, onExport,
}: CreativeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS["1:1"];
  const [style, setStyle] = useState<NicheStyle>(() => resolveNicheStyle(niche));

  useEffect(() => {
    const s = resolveNicheStyle(niche);
    setStyle(s);
    preloadNicheFonts(s);
  }, [niche]);

  const ctaColor = brandColors?.primary || style.palette.primary;

  const aspectClass = ratio === "1:1" ? "aspect-square"
    : ratio === "4:5" ? "aspect-[4/5]"
    : ratio === "9:16" ? "aspect-[9/16]"
    : "aspect-video";

  // ── PNG Export (4-layer Canvas render) ─────────────────────────
  const exportPNG = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dims.w;
    canvas.height = dims.h;

    // ═══ LAYER 1: Background (AI Generated Image) ═══
    if (imageUrl) {
      try {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = imageUrl;
        });
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

    // ═══ LAYER 2: Overlay (Readability Gradient) ═══
    const gradient = ctx.createLinearGradient(0, dims.h * 0.3, 0, dims.h);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.5, style.palette.overlay.replace(/[\d.]+\)$/, "0.3)"));
    gradient.addColorStop(1, style.palette.overlay);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dims.w, dims.h);

    // Top vignette for logo area
    const topGrad = ctx.createLinearGradient(0, 0, 0, dims.h * 0.2);
    topGrad.addColorStop(0, style.palette.overlay.replace(/[\d.]+\)$/, "0.4)"));
    topGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, dims.w, dims.h * 0.2);

    // Safe zone margins (8%)
    const mx = dims.w * 0.08;
    const my = dims.h * 0.06;
    const textW = dims.w - mx * 2;

    // ═══ LAYER 3: Text Slots (Headline / Body / CTA) ═══
    // Headline
    if (headline) {
      const fontSize = Math.round(dims.w * 0.055);
      ctx.font = `800 ${fontSize}px ${style.fonts.headline}`;
      ctx.fillStyle = style.palette.textLight;
      ctx.textAlign = "left";
      const displayHeadline = style.cta.uppercase ? headline.toUpperCase() : headline;
      wrapText(ctx, displayHeadline, mx, dims.h * 0.6, textW, fontSize * 1.15);
    }

    // Body
    if (body) {
      const fontSize = Math.round(dims.w * 0.028);
      ctx.font = `400 ${fontSize}px ${style.fonts.body}`;
      ctx.fillStyle = hexToRgba(style.palette.textLight, 0.85);
      ctx.textAlign = "left";
      wrapText(ctx, body, mx, dims.h * 0.76, textW, fontSize * 1.4);
    }

    // CTA Button
    if (cta) {
      const fontSize = Math.round(dims.w * 0.03);
      const py = fontSize * 0.7;
      const px = fontSize * 1.5;
      ctx.font = `700 ${fontSize}px ${style.fonts.cta}`;
      const ctaText = style.cta.uppercase ? cta.toUpperCase() : cta;
      const ctaMetrics = ctx.measureText(ctaText);
      const btnW = ctaMetrics.width + px * 2;
      const btnH = fontSize + py * 2;
      const btnX = mx;
      const btnY = dims.h * 0.89 - btnH;

      if (style.cta.style === "outline") {
        ctx.strokeStyle = ctaColor;
        ctx.lineWidth = 2;
        roundRect(ctx, btnX, btnY, btnW, btnH, style.cta.borderRadius);
        ctx.stroke();
      } else if (style.cta.style === "gradient") {
        const grad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
        grad.addColorStop(0, ctaColor);
        grad.addColorStop(1, brandColors?.secondary || style.palette.secondary);
        ctx.fillStyle = grad;
        roundRect(ctx, btnX, btnY, btnW, btnH, style.cta.borderRadius);
        ctx.fill();
      } else {
        ctx.fillStyle = ctaColor;
        roundRect(ctx, btnX, btnY, btnW, btnH, style.cta.borderRadius);
        ctx.fill();
      }

      ctx.fillStyle = style.cta.style === "outline" ? ctaColor : style.palette.textLight;
      ctx.textAlign = "left";
      ctx.fillText(ctaText, btnX + px, btnY + py + fontSize * 0.82);
    }

    // ═══ LAYER 4: Brand Kit (Logo + accent line) ═══
    // Accent line at top
    ctx.fillStyle = ctaColor;
    ctx.fillRect(mx, my, dims.w * 0.12, 4);

    // Logo
    if (logoUrl) {
      try {
        const logo = new window.Image();
        logo.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          logo.onload = () => resolve();
          logo.onerror = reject;
          logo.src = logoUrl;
        });
        const logoH = dims.h * 0.05;
        const logoW = (logo.width / logo.height) * logoH;
        ctx.drawImage(logo, mx, my + 12, logoW, logoH);
      } catch {
        // Skip logo if failed to load
      }
    }

    const dataUrl = canvas.toDataURL("image/png");
    onExport?.(dataUrl);

    const link = document.createElement("a");
    link.download = `creative-${ratio}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [imageUrl, headline, body, cta, dims, ratio, style, ctaColor, logoUrl, brandColors, onExport]);

  return (
    <div className={className}>
      {/* ── Live CSS Preview (4 layers visualized) ── */}
      <div className={`relative ${aspectClass} w-full max-w-md mx-auto rounded-lg overflow-hidden border border-border bg-card`}>
        {/* Layer 1: Background */}
        {imageUrl ? (
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: style.palette.textDark }} />
        )}

        {/* Layer 2: Overlay gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${style.palette.overlay}, ${style.palette.overlay.replace(/[\d.]+\)$/, "0.2)")}, transparent)`,
          }}
        />

        {/* Layer 4: Brand Kit (top) */}
        <div className="absolute top-0 left-0 right-0 p-[6%]">
          <div className="h-1 rounded-full mb-2" style={{ width: "12%", backgroundColor: ctaColor }} />
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-6 object-contain opacity-90" />
          )}
        </div>

        {/* Layer 3: Text Slots */}
        <div className="absolute inset-0 flex flex-col justify-end p-[8%] gap-2">
          {headline && (
            <h3
              className="font-extrabold text-lg leading-tight drop-shadow-lg"
              style={{
                fontFamily: style.fonts.headline,
                color: style.palette.textLight,
                textTransform: style.cta.uppercase ? "uppercase" : "none",
              }}
            >
              {headline}
            </h3>
          )}
          {body && (
            <p
              className="text-xs leading-relaxed line-clamp-3"
              style={{
                fontFamily: style.fonts.body,
                color: hexToRgba(style.palette.textLight, 0.85),
              }}
            >
              {body}
            </p>
          )}
          {cta && (
            <span
              className="self-start mt-1 px-4 py-1.5 text-xs font-bold"
              style={{
                fontFamily: style.fonts.cta,
                borderRadius: style.cta.borderRadius,
                textTransform: style.cta.uppercase ? "uppercase" : "none",
                ...(style.cta.style === "outline"
                  ? { border: `2px solid ${ctaColor}`, color: ctaColor, background: "transparent" }
                  : style.cta.style === "gradient"
                  ? {
                      background: `linear-gradient(135deg, ${ctaColor}, ${brandColors?.secondary || style.palette.secondary})`,
                      color: style.palette.textLight,
                    }
                  : { backgroundColor: ctaColor, color: style.palette.textLight }),
              }}
            >
              {cta}
            </span>
          )}
        </div>

        {/* Layer indicator badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-[9px] text-white/70">
          <Layers className="h-2.5 w-2.5" />4 camadas
        </div>
      </div>

      {/* Niche style badge */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground font-mono">
          Estilo: {style.label}
        </span>
        <span className="flex items-center gap-1.5">
          {[style.palette.primary, style.palette.secondary, style.palette.accent].map((c, i) => (
            <span key={i} className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c }} />
          ))}
        </span>
      </div>

      {/* Export button */}
      <button
        onClick={exportPNG}
        className="mt-2 w-full flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        Exportar Criativo Final ({dims.w}×{dims.h})
      </button>

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
