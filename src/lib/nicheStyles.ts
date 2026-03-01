/**
 * Niche-driven design tokens for creative canvas rendering.
 * Maps project niche (from DNA) to typography, palette, and CTA style.
 */

export interface NicheStyle {
  id: string;
  label: string;
  fonts: {
    headline: string;
    body: string;
    cta: string;
  };
  /** Google Fonts import URL (loaded dynamically) */
  fontsImport: string;
  palette: {
    primary: string;    // hex
    secondary: string;
    accent: string;
    textLight: string;
    textDark: string;
    overlay: string;    // rgba gradient base
  };
  cta: {
    borderRadius: number;
    style: "solid" | "outline" | "gradient";
    uppercase: boolean;
  };
}

export const NICHE_STYLES: Record<string, NicheStyle> = {
  mistico: {
    id: "mistico",
    label: "Tarot / Místico",
    fonts: {
      headline: "'Cinzel', serif",
      body: "'Playfair Display', serif",
      cta: "'Cinzel', serif",
    },
    fontsImport: "https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Playfair+Display:wght@400;500;600&display=swap",
    palette: {
      primary: "#C9A84C",    // gold
      secondary: "#7C3AED",  // purple
      accent: "#F5E6C8",     // light gold
      textLight: "#F5F0E8",
      textDark: "#1A0A2E",
      overlay: "rgba(26, 10, 46, 0.7)",
    },
    cta: { borderRadius: 2, style: "outline", uppercase: true },
  },
  ecommerce: {
    id: "ecommerce",
    label: "E-commerce / Casa",
    fonts: {
      headline: "'Montserrat', sans-serif",
      body: "'Inter', sans-serif",
      cta: "'Montserrat', sans-serif",
    },
    fontsImport: "https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap",
    palette: {
      primary: "#2D2D2D",
      secondary: "#A67C52",  // warm wood
      accent: "#E8DDD3",     // neutral warm
      textLight: "#FFFFFF",
      textDark: "#1A1A1A",
      overlay: "rgba(0, 0, 0, 0.55)",
    },
    cta: { borderRadius: 6, style: "solid", uppercase: false },
  },
  religioso: {
    id: "religioso",
    label: "Bíblico / Religioso",
    fonts: {
      headline: "'EB Garamond', serif",
      body: "'Roboto', sans-serif",
      cta: "'Roboto', sans-serif",
    },
    fontsImport: "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500;600;700&family=Roboto:wght@400;500&display=swap",
    palette: {
      primary: "#1B3A5C",    // deep blue
      secondary: "#C9A84C",  // gold
      accent: "#F0EDE8",
      textLight: "#FFFFFF",
      textDark: "#0D1B2A",
      overlay: "rgba(13, 27, 42, 0.65)",
    },
    cta: { borderRadius: 4, style: "solid", uppercase: false },
  },
  infantil: {
    id: "infantil",
    label: "Brinquedos / Infantil",
    fonts: {
      headline: "'Fredoka', sans-serif",
      body: "'Quicksand', sans-serif",
      cta: "'Fredoka', sans-serif",
    },
    fontsImport: "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@400;500;600&display=swap",
    palette: {
      primary: "#FF6B35",    // vibrant orange
      secondary: "#4ECDC4",  // teal
      accent: "#FFE66D",     // yellow
      textLight: "#FFFFFF",
      textDark: "#2D3436",
      overlay: "rgba(0, 0, 0, 0.35)",
    },
    cta: { borderRadius: 24, style: "solid", uppercase: true },
  },
  tech: {
    id: "tech",
    label: "Tech / SaaS",
    fonts: {
      headline: "'Inter', sans-serif",
      body: "'Inter', sans-serif",
      cta: "'Inter', sans-serif",
    },
    fontsImport: "",
    palette: {
      primary: "#6366F1",    // indigo
      secondary: "#06B6D4",  // cyan
      accent: "#E0E7FF",
      textLight: "#FFFFFF",
      textDark: "#0F172A",
      overlay: "rgba(15, 23, 42, 0.6)",
    },
    cta: { borderRadius: 8, style: "gradient", uppercase: false },
  },
  fitness: {
    id: "fitness",
    label: "Fitness / Saúde",
    fonts: {
      headline: "'Montserrat', sans-serif",
      body: "'Inter', sans-serif",
      cta: "'Montserrat', sans-serif",
    },
    fontsImport: "https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&display=swap",
    palette: {
      primary: "#10B981",    // green
      secondary: "#1F2937",  // dark
      accent: "#D1FAE5",
      textLight: "#FFFFFF",
      textDark: "#064E3B",
      overlay: "rgba(0, 0, 0, 0.5)",
    },
    cta: { borderRadius: 6, style: "solid", uppercase: true },
  },
  default: {
    id: "default",
    label: "Padrão",
    fonts: {
      headline: "'Inter', sans-serif",
      body: "'Inter', sans-serif",
      cta: "'Inter', sans-serif",
    },
    fontsImport: "",
    palette: {
      primary: "#06B6D4",
      secondary: "#6366F1",
      accent: "#CFFAFE",
      textLight: "#FFFFFF",
      textDark: "#0C1220",
      overlay: "rgba(0, 0, 0, 0.6)",
    },
    cta: { borderRadius: 6, style: "solid", uppercase: true },
  },
};

/**
 * Resolve a niche string (from project DNA) to the closest NicheStyle.
 * Does fuzzy keyword matching.
 */
export function resolveNicheStyle(niche?: string | null): NicheStyle {
  if (!niche) return NICHE_STYLES.default;
  const lower = niche.toLowerCase();

  const keywords: Record<string, string[]> = {
    mistico: ["tarot", "místic", "esotér", "astrolog", "espiritual", "oráculo"],
    ecommerce: ["ecommerce", "e-commerce", "casa", "loja", "decor", "móve", "produto"],
    religioso: ["bíbli", "biblic", "religi", "igrej", "cristã", "evangél", "católi"],
    infantil: ["brinquedo", "infantil", "criança", "kid", "toy", "bebê"],
    tech: ["tech", "saas", "software", "startup", "app", "digital"],
    fitness: ["fitness", "saúde", "gym", "academia", "treino", "nutri", "emagre"],
  };

  for (const [key, words] of Object.entries(keywords)) {
    if (words.some((w) => lower.includes(w))) {
      return NICHE_STYLES[key];
    }
  }

  return NICHE_STYLES.default;
}

/** Preload niche fonts by injecting a link tag */
export function preloadNicheFonts(style: NicheStyle) {
  if (!style.fontsImport) return;
  const id = `niche-fonts-${style.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = style.fontsImport;
  document.head.appendChild(link);
}
