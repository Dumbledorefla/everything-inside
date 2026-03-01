/**
 * Strips CSS font-family fallbacks and quotes for use with Canvas 2D API.
 * e.g. "'Cinzel', serif" → "Cinzel"
 */
export function cleanFontFamily(cssFont: string): string {
  // Take first family, strip quotes
  const first = cssFont.split(",")[0].trim();
  return first.replace(/['"]/g, "");
}
