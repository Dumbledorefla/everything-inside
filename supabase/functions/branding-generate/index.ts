import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    const { projectId } = await req.json();
    if (!projectId) throw new Error("projectId required");

    // Fetch project info
    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (!project) throw new Error("Project not found");

    // Fetch current DNA
    const { data: dna } = await supabase.from("project_dna").select("*").eq("project_id", projectId)
      .order("version", { ascending: false }).limit(1).single();

    // ── Step 1: LLM Strategy ────────────────────────────
    const strategyPrompt = `Você é um diretor de arte e estrategista de marca. O projeto é: "${project.name}" no nicho "${project.niche || 'geral'}". Produto: "${project.product || 'não especificado'}".

Gere um Branding Kit completo em JSON com esta estrutura EXATA:
{
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "typography": { "heading": "Nome da Fonte Google", "body": "Nome da Fonte Google" },
  "editorialLine": [
    { "pillar": "Nome do Pilar", "description": "Descrição curta", "frequency": "3x/semana", "examples": ["exemplo1", "exemplo2"] }
  ],
  "moodKeywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
}

Regras:
- As cores devem refletir o nicho e criar contraste entre si
- A tipografia deve usar fontes do Google Fonts reais
- Gere exatamente 3 pilares editoriais relevantes para o nicho
- Os moodKeywords serão usados para gerar imagens de referência`;

    const strategyRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: strategyPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "create_branding_kit",
            description: "Create a complete branding kit",
            parameters: {
              type: "object",
              properties: {
                colorPalette: { type: "array", items: { type: "string" } },
                typography: { type: "object", properties: { heading: { type: "string" }, body: { type: "string" } }, required: ["heading", "body"] },
                editorialLine: { type: "array", items: { type: "object", properties: { pillar: { type: "string" }, description: { type: "string" }, frequency: { type: "string" }, examples: { type: "array", items: { type: "string" } } }, required: ["pillar", "description", "frequency", "examples"] } },
                moodKeywords: { type: "array", items: { type: "string" } }
              },
              required: ["colorPalette", "typography", "editorialLine", "moodKeywords"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "create_branding_kit" } },
      }),
    });

    if (!strategyRes.ok) {
      const errText = await strategyRes.text();
      console.error("Strategy LLM error:", strategyRes.status, errText);
      throw new Error("Failed to generate branding strategy");
    }

    const strategyData = await strategyRes.json();
    const toolCall = strategyData.choices?.[0]?.message?.tool_calls?.[0];
    let brandingKit: any;
    try {
      brandingKit = JSON.parse(toolCall?.function?.arguments || "{}");
    } catch {
      throw new Error("Failed to parse branding strategy");
    }

    // ── Step 2: Save Brand Kit ──────────────────────────
    const { error: upsertErr } = await supabase.from("brand_kits").upsert({
      project_id: projectId,
      user_id: userId,
      color_palette: brandingKit.colorPalette || [],
      typography: brandingKit.typography || {},
      editorial_line: brandingKit.editorialLine || [],
      moodboard_urls: [],
      status: "complete",
    }, { onConflict: "project_id" });

    if (upsertErr) console.error("Brand kit save error:", upsertErr);

    // ── Step 3: Update DNA with visual tokens ───────────
    const currentVersion = dna?.version || 0;
    const newVisual = {
      ...(dna?.visual as any || {}),
      cores: brandingKit.colorPalette?.join(", ") || "",
      fontes: `${brandingKit.typography?.heading || "Inter"}, ${brandingKit.typography?.body || "Inter"}`,
    };

    await supabase.from("project_dna").insert({
      project_id: projectId,
      version: currentVersion + 1,
      identity: dna?.identity || {},
      audience: dna?.audience || {},
      strategy: dna?.strategy || {},
      visual: newVisual,
      funnel: dna?.funnel || {},
    });

    // ── Step 4: Log credits ─────────────────────────────
    await supabase.from("cos_ledger").insert({
      project_id: projectId,
      user_id: userId,
      operation_type: "BRANDING_KIT",
      provider_used: "google/gemini-3-flash-preview",
      credits_cost: 10,
      estimated_usd: 0.05,
      metadata: { step: "strategy_generation" },
    });

    return new Response(JSON.stringify({
      success: true,
      brandingKit: {
        colorPalette: brandingKit.colorPalette,
        typography: brandingKit.typography,
        editorialLine: brandingKit.editorialLine,
        moodKeywords: brandingKit.moodKeywords,
      },
      dnaVersion: currentVersion + 1,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Branding generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
