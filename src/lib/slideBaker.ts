import type { TextLayer } from "@/components/creative/LayerEditor";
import { resolveNicheStyle } from "@/lib/nicheStyles";

const RATIO_DIMS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1920, h: 1080 },
};

function defaultLayersFor(slide: any, niche?: string | null): TextLayer[] {
  const style = resolveNicheStyle(niche);
  const layers: TextLayer[] = [];
  if (slide.headline) {
    layers.push({
      id: "headline", type: "headline", content: slide.headline,
      x: 8, y: 60, fontSize: 52,
      fontFamily: style.fonts.headline, fontWeight: 800, fontStyle: "normal",
      color: style.palette.textLight, textAlign: "left", maxWidthPercent: 80, visible: true,
    });
  }
  if (slide.body) {
    layers.push({
      id: "body", type: "body", content: slide.body,
      x: 8, y: 76, fontSize: 22,
      fontFamily: style.fonts.body, fontWeight: 400, fontStyle: "normal",
      color: style.palette.textLight, textAlign: "left", maxWidthPercent: 75, visible: true,
    });
  }
  if (slide.cta) {
    layers.push({
      id: "cta", type: "cta", content: slide.cta,
      x: 8, y: 88, fontSize: 28,
      fontFamily: style.fonts.cta, fontWeight: 700, fontStyle: "normal",
      color: "#FFFFFF", textAlign: "left", maxWidthPercent: 60, visible: true,
    });
  }
  return layers;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function bakeSlideToBlob(
  slide: any,
  customLayers: TextLayer[] | undefined,
  ratio: string,
  niche?: string | null,
): Promise<Blob> {
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS["1:1"];
  const canvas = document.createElement("canvas");
  canvas.width = dims.w;
  canvas.height = dims.h;
  const ctx = canvas.getContext("2d")!;

  // Background
  if (slide.imageUrl) {
    try {
      const img = await loadImage(slide.imageUrl);
      const scale = Math.max(dims.w / img.width, dims.h / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const x = (dims.w - drawW) / 2;
      const y = (dims.h - drawH) / 2;
      ctx.drawImage(img, x, y, drawW, drawH);
    } catch {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, dims.w, dims.h);
    }
  } else {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, dims.w, dims.h);
  }

  // Text layers
  const layers = (customLayers && customLayers.length > 0) ? customLayers : defaultLayersFor(slide, niche);
  for (const layer of layers) {
    if (!layer.visible || !layer.content) continue;
    const fontStyle = layer.fontStyle || "normal";
    ctx.font = `${fontStyle} ${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}, sans-serif`;
    ctx.fillStyle = layer.color;
    ctx.textBaseline = "top";
    ctx.textAlign = (layer.textAlign as CanvasTextAlign) || "left";

    const maxWidth = (dims.w * layer.maxWidthPercent) / 100;
    const lines = wrapText(ctx, layer.content, maxWidth);

    const xPx = (dims.w * layer.x) / 100;
    let yPx = (dims.h * layer.y) / 100;
    const lineHeight = layer.fontSize * 1.2;

    // Soft shadow for legibility
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    let drawX = xPx;
    if (layer.textAlign === "center") drawX = xPx + maxWidth / 2;
    if (layer.textAlign === "right") drawX = xPx + maxWidth;

    for (const line of lines) {
      ctx.fillText(line, drawX, yPx);
      yPx += lineHeight;
    }

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)!);
}

export async function exportCarouselZip(
  slides: any[],
  layerStylesBySlide: Record<number, TextLayer[]>,
  ratio: string,
  niche?: string | null,
  filename = `carousel-${Date.now()}.zip`,
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const slide of slides) {
    const layers = layerStylesBySlide[slide.slideNumber];
    const blob = await bakeSlideToBlob(slide, layers, ratio, niche);
    const num = String(slide.slideNumber).padStart(2, "0");
    zip.file(`${num}.jpg`, blob);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
