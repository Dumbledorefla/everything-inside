import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Niche style tokens (server-side mirror of nicheStyles.ts)
const NICHE_STYLES: Record<string, { fonts: { headline: string; body: string; cta: string }; palette: Record<string, string>; cta: { borderRadius: number; style: string; uppercase: boolean } }> = {
  mistico: {
    fonts: { headline: "Cinzel", body: "Playfair Display", cta: "Cinzel" },
    palette: { primary: "#C9A84C", secondary: "#7C3AED", accent: "#F5E6C8", textLight: "#F5F0E8", textDark: "#1A0A2E", overlay: "rgba(26,10,46,0.7)" },
    cta: { borderRadius: 2, style: "outline", uppercase: true },
  },
  ecommerce: {
    fonts: { headline: "Montserrat", body: "Inter", cta: "Montserrat" },
    palette: { primary: "#2D2D2D", secondary: "#A67C52", accent: "#E8DDD3", textLight: "#FFFFFF", textDark: "#1A1A1A", overlay: "rgba(0,0,0,0.55)" },
    cta: { borderRadius: 6, style: "solid", uppercase: false },
  },
  religioso: {
    fonts: { headline: "EB Garamond", body: "Roboto", cta: "Roboto" },
    palette: { primary: "#1B3A5C", secondary: "#C9A84C", accent: "#F0EDE8", textLight: "#FFFFFF", textDark: "#0D1B2A", overlay: "rgba(13,27,42,0.65)" },
    cta: { borderRadius: 4, style: "solid", uppercase: false },
  },
  infantil: {
    fonts: { headline: "Fredoka", body: "Quicksand", cta: "Fredoka" },
    palette: { primary: "#FF6B35", secondary: "#4ECDC4", accent: "#FFE66D", textLight: "#FFFFFF", textDark: "#2D3436", overlay: "rgba(0,0,0,0.35)" },
    cta: { borderRadius: 24, style: "solid", uppercase: true },
  },
  default: {
    fonts: { headline: "Inter", body: "Inter", cta: "Inter" },
    palette: { primary: "#06B6D4", secondary: "#6366F1", accent: "#CFFAFE", textLight: "#FFFFFF", textDark: "#0C1220", overlay: "rgba(0,0,0,0.6)" },
    cta: { borderRadius: 6, style: "solid", uppercase: true },
  },
};

function resolveNiche(niche?: string | null): string {
  if (!niche) return "default";
  const lower = niche.toLowerCase();
  const map: Record<string, string[]> = {
    mistico: ["tarot", "místic", "esotér", "astrolog"],
    ecommerce: ["ecommerce", "e-commerce", "casa", "loja", "decor"],
    religioso: ["bíbli", "religi", "igrej", "cristã", "evangél"],
    infantil: ["brinquedo", "infantil", "criança", "kid", "toy"],
  };
  for (const [key, words] of Object.entries(map)) {
    if (words.some(w => lower.includes(w))) return key;
  }
  return "default";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assetId, width, height } = await req.json();
    if (!assetId) throw new Error("assetId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch asset + latest version
    const { data: asset } = await supabase
      .from("assets")
      .select("*, asset_versions(*)")
      .eq("id", assetId)
      .single();
    if (!asset) throw new Error("Asset not found");

    const version = (asset.asset_versions || []).sort((a: any, b: any) => b.version - a.version)[0];

    // Fetch project + DNA
    const { data: project } = await supabase.from("projects").select("*").eq("id", asset.project_id).single();
    const { data: dna } = await supabase
      .from("project_dna")
      .select("*")
      .eq("project_id", asset.project_id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const nicheKey = resolveNiche(project?.niche);
    const style = NICHE_STYLES[nicheKey] || NICHE_STYLES.default;

    // Extract visual tokens from DNA
    const visual = (dna?.visual as any) || {};
    const logoUrl = visual?.logo_url || null;
    const primaryColor = visual?.colors?.[0]?.hex || style.palette.primary;

    // Build render metadata (since we can't use Satori in edge functions,
    // we return a structured render spec that the client Canvas uses)
    const renderSpec = {
      asset: {
        id: asset.id,
        headline: version?.headline || asset.title || "",
        body: version?.body || "",
        cta: version?.cta || "",
        imageUrl: version?.image_url || null,
        ratio: asset.preset || "1:1",
      },
      style: {
        nicheKey,
        label: nicheKey,
        fonts: style.fonts,
        palette: style.palette,
        cta: style.cta,
      },
      brand: {
        logoUrl,
        primaryColor,
        secondaryColor: visual?.colors?.[1]?.hex || style.palette.secondary,
      },
      dimensions: {
        width: width || 1080,
        height: height || 1080,
      },
    };

    return new Response(JSON.stringify(renderSpec), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
