import { useRef, useCallback } from "react";

interface CanvasSlot {
  type: "headline" | "body" | "cta" | "logo";
  text: string;
  x: number; // percentage
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: string;
  color: string;
  align: CanvasTextAlign;
  bg?: string;
  borderRadius?: number;
  padding?: number;
}

interface CreativeCanvasProps {
  imageUrl: string | null;
  headline: string;
  body?: string;
  cta?: string;
  ratio: string; // "1:1" | "4:5" | "9:16"
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
  imageUrl,
  headline,
  body,
  cta,
  ratio = "1:1",
  className,
  onExport,
}: CreativeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS["1:1"];

  // Aspect ratio for CSS preview
  const aspectClass = ratio === "1:1"
    ? "aspect-square"
    : ratio === "4:5"
    ? "aspect-[4/5]"
    : ratio === "9:16"
    ? "aspect-[9/16]"
    : "aspect-video";

  const exportPNG = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dims.w;
    canvas.height = dims.h;

    // Draw background image
    if (imageUrl) {
      try {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = imageUrl;
        });
        // Cover fit
        const scale = Math.max(dims.w / img.width, dims.h / img.height);
        const x = (dims.w - img.width * scale) / 2;
        const y = (dims.h - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      } catch {
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, dims.w, dims.h);
      }
    } else {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, dims.w, dims.h);
    }

    // Gradient overlay for text readability
    const gradient = ctx.createLinearGradient(0, dims.h * 0.4, 0, dims.h);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dims.w, dims.h);

    // Safe zone margins (10%)
    const mx = dims.w * 0.08;
    const textW = dims.w - mx * 2;

    // Headline
    if (headline) {
      const fontSize = Math.round(dims.w * 0.055);
      ctx.font = `800 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      wrapText(ctx, headline.toUpperCase(), mx, dims.h * 0.62, textW, fontSize * 1.15);
    }

    // Body
    if (body) {
      const fontSize = Math.round(dims.w * 0.028);
      ctx.font = `400 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "left";
      wrapText(ctx, body, mx, dims.h * 0.78, textW, fontSize * 1.4);
    }

    // CTA button
    if (cta) {
      const fontSize = Math.round(dims.w * 0.032);
      const py = fontSize * 0.8;
      const px = fontSize * 1.5;
      ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const ctaMetrics = ctx.measureText(cta.toUpperCase());
      const btnW = ctaMetrics.width + px * 2;
      const btnH = fontSize + py * 2;
      const btnX = mx;
      const btnY = dims.h * 0.9 - btnH;

      // Button background
      ctx.fillStyle = "#6366f1";
      roundRect(ctx, btnX, btnY, btnW, btnH, 8);
      ctx.fill();

      // Button text
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      ctx.fillText(cta.toUpperCase(), btnX + px, btnY + py + fontSize * 0.85);
    }

    const dataUrl = canvas.toDataURL("image/png");
    onExport?.(dataUrl);

    // Trigger download
    const link = document.createElement("a");
    link.download = `creative-${ratio}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [imageUrl, headline, body, cta, dims, ratio, onExport]);

  return (
    <div className={className}>
      {/* Live Preview (CSS-based) */}
      <div className={`relative ${aspectClass} w-full max-w-md mx-auto rounded-lg overflow-hidden border border-border bg-card`}>
        {imageUrl ? (
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-secondary to-card" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        {/* Safe zone content */}
        <div className="absolute inset-0 flex flex-col justify-end p-[8%] gap-2">
          {headline && (
            <h3 className="text-white font-extrabold text-lg leading-tight uppercase drop-shadow-lg">
              {headline}
            </h3>
          )}
          {body && (
            <p className="text-white/85 text-xs leading-relaxed line-clamp-3">
              {body}
            </p>
          )}
          {cta && (
            <span className="self-start mt-1 rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground uppercase">
              {cta}
            </span>
          )}
        </div>
      </div>

      {/* Export button */}
      <button
        onClick={exportPNG}
        className="mt-3 w-full rounded-md border border-border bg-secondary px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
      >
        Exportar PNG ({ratio})
      </button>

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// Helper: wrap text on canvas
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

// Helper: rounded rectangle
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
