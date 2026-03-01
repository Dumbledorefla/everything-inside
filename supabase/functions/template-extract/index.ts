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

    const { assetId, templateName } = await req.json();
    if (!assetId) throw new Error("assetId required");

    // Fetch asset + latest version
    const { data: asset } = await supabase.from("assets").select("*").eq("id", assetId).single();
    if (!asset) throw new Error("Asset not found");

    const { data: version } = await supabase.from("asset_versions").select("*").eq("asset_id", assetId)
      .order("version", { ascending: false }).limit(1).single();
    if (!version) throw new Error("No asset version found");

    // Ask LLM to abstract the copy into a reusable template
    const extractPrompt = `Você é um especialista em copywriting e templates. Analise este criativo aprovado e transforme-o em um template reutilizável.

CRIATIVO ORIGINAL:
- Headline: "${version.headline || ''}"
- Body: "${version.body || ''}"
- CTA: "${version.cta || ''}"
- Tipo: "${asset.preset || '1:1'}"
- Destino: "${asset.destination || 'Feed'}"

REGRAS:
1. Substitua nomes próprios, produtos específicos e nichos por variáveis [VAR_PRODUTO], [VAR_NICHO], [VAR_BENEFICIO], [VAR_NUMERO], etc.
2. Mantenha a estrutura e o tom exatos da copy original
3. Identifique o padrão/framework usado (ex: PAS, AIDA, Curiosidade, Prova Social)

Retorne a estrutura abstrata do template.`;

    const llmRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: extractPrompt }],
        tools: [{
          type: "function",
          function: {
            name: "extract_template",
            description: "Extract a reusable copy template from an approved asset",
            parameters: {
              type: "object",
              properties: {
                headline_template: { type: "string", description: "Headline with variables" },
                body_template: { type: "string", description: "Body with variables" },
                cta_template: { type: "string", description: "CTA with variables" },
                framework: { type: "string", description: "Copy framework identified (PAS, AIDA, etc.)" },
                variables: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, example: { type: "string" } }, required: ["name", "description", "example"] } },
                tone: { type: "string", description: "Tom da copy (urgente, educativo, etc.)" },
              },
              required: ["headline_template", "body_template", "cta_template", "framework", "variables", "tone"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_template" } },
      }),
    });

    if (!llmRes.ok) throw new Error("LLM extraction failed");

    const llmData = await llmRes.json();
    const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];
    let templateData: any;
    try {
      templateData = JSON.parse(toolCall?.function?.arguments || "{}");
    } catch {
      throw new Error("Failed to parse template extraction");
    }

    // Save to templates table
    const { data: saved, error: saveErr } = await supabase.from("templates").insert({
      name: templateName || `Modelo de ${version.headline?.slice(0, 30) || 'Asset'}`,
      user_id: userId,
      project_id: asset.project_id,
      aspect_ratio: asset.preset || "1:1",
      is_custom_model: true,
      source_asset_id: assetId,
      template_content: templateData,
      slots: {
        headline: { template: templateData.headline_template },
        body: { template: templateData.body_template },
        cta: { template: templateData.cta_template },
      },
    }).select().single();

    if (saveErr) throw saveErr;

    // Log credits
    await supabase.from("cos_ledger").insert({
      project_id: asset.project_id,
      user_id: userId,
      asset_id: assetId,
      operation_type: "TEMPLATE_EXTRACT",
      provider_used: "google/gemini-3-flash-preview",
      credits_cost: 2,
      estimated_usd: 0.01,
    });

    return new Response(JSON.stringify({
      success: true,
      template: saved,
      extraction: templateData,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("Template extract error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
