/**
 * Maps a project niche string to a CSS class that overrides accent colors.
 * Returns empty string for unknown niches (keeps default cyan).
 */
export function getNicheClass(niche?: string | null): string {
  if (!niche) return "";
  const n = niche.toLowerCase();

  if (/(tarot|místico|mistico|astrolog|esotér|oráculo)/.test(n)) return "niche-tarot";
  if (/(ecommerce|e-commerce|loja|varejo|shop)/.test(n)) return "niche-ecommerce";
  if (/(bíbli|bibli|cristã|evangél|religi|igreja|pastoral)/.test(n)) return "niche-religioso";
  if (/(fitness|academia|saúde|treino|gym|nutrição)/.test(n)) return "niche-fitness";
  if (/(infantil|criança|brinquedo|kids|baby)/.test(n)) return "niche-infantil";
  if (/(tech|software|saas|programação|dev|startup)/.test(n)) return "niche-tech";

  return "";
}
