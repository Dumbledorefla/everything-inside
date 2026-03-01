/**
 * Maps a project niche string to a CSS class that overrides accent colors.
 * Returns empty string for unknown niches (keeps default cyan).
 */
export function getNicheClass(niche?: string | null): string {
  if (!niche) return "";
  const n = niche.toLowerCase();

  if (/(tarot|místico|mistico|astrolog|esotér|oráculo|cigano)/.test(n)) return "niche-tarot";
  if (/(ecommerce|e-commerce|loja|varejo|shop)/.test(n)) return "niche-ecommerce";
  if (/(bíbli|bibli|cristã|evangél|religi|igreja|pastoral)/.test(n)) return "niche-religioso";
  if (/(fitness|academia|saúde|treino|gym|nutrição)/.test(n)) return "niche-fitness";
  if (/(infantil|criança|brinquedo|kids|baby)/.test(n)) return "niche-infantil";
  if (/(tech|software|saas|programação|dev|startup)/.test(n)) return "niche-tech";
  if (/(educa|curso|ensino|professor|escola)/.test(n)) return "niche-educacao";
  if (/(saúde|médic|clínic|terapia|bem.?estar)/.test(n)) return "niche-saude";

  return "";
}

/**
 * Get a readable niche color name for UI display
 */
export function getNicheColor(niche?: string | null): string {
  const cls = getNicheClass(niche);
  const map: Record<string, string> = {
    "niche-tarot": "hsl(270 60% 55%)",
    "niche-ecommerce": "hsl(217 91% 60%)",
    "niche-religioso": "hsl(142 71% 45%)",
    "niche-fitness": "hsl(14 90% 55%)",
    "niche-infantil": "hsl(330 80% 60%)",
    "niche-tech": "hsl(187 94% 43%)",
    "niche-educacao": "hsl(45 93% 47%)",
    "niche-saude": "hsl(168 76% 42%)",
  };
  return map[cls] || "hsl(187 94% 43%)";
}
