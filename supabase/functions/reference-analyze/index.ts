import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { imageUrl, projectId, projectNiche, humanContext } = await req.json();
    if (!imageUrl || !projectId) {
      return new Response(JSON.stringify({ error: "imageUrl and projectId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a Deep Perception Engine — an elite visual semiotics analyst for marketing & advertising. You analyze reference images with surgical precision across multiple dimensions. You MUST return your analysis as a JSON object matching the exact schema below. Do NOT include any text outside the JSON.

ANALYSIS DIMENSIONS:

1. VISUAL ARCHETYPE — Identify the dominant visual language (e.g., "Minimalista High-Tech", "Brutalist Editorial", "Warm Organic Lifestyle", "Corporate Institutional", "Underground Rebel").

2. EMOTIONAL TONE — The predominant emotion the image communicates to the viewer (e.g., "Urgência e Escassez", "Calmaria e Confiança", "Exclusividade Sofisticada", "Nostalgia Acolhedora", "Energia e Empoderamento").

3. SOPHISTICATION LEVEL — Scale 1-10 where 1 = mass-market/popular and 10 = ultra-luxury/high-end. Consider typography quality, whitespace usage, color restraint, composition refinement.

4. COMPOSITION INTENT — Describe the hero element, depth of field, positioning strategy, negative space usage, visual hierarchy. (e.g., "Produto centralizado com bokeh profundo e iluminação dramática lateral").

5. TYPOGRAPHY STYLE — Analyze any text visible: font weight (bold/light/medium), tracking (tight/normal/wide), serif vs sans-serif, modern vs classic vibe, contrast with background. Return as JSON with keys: weight, tracking, vibe, contrast_strategy.

6. HUMAN CONTEXT (if people are present) — Demographics (approximate age, style), body language interpretation (confidence, vulnerability, relaxation), usage context (office/home/outdoor/studio). If no people, return null.

7. FOCUS NARRATIVE — What is the "hero" of the image and why? What story does the composition tell? (e.g., "Uma mulher jovem em pose de poder, transmitindo independência financeira, com o produto sutilmente posicionado como facilitador").

8. STRATEGIC WHY — Why does this image WORK for marketing? What psychological triggers does it activate? (e.g., "Ativa gatilho de prova social + aspiração. O ambiente luxuoso posiciona o produto como premium, enquanto o sorriso genuíno reduz percepção de risco").

9. GENERATED PROMPT — Transform ALL the above analysis into a single, actionable image generation prompt that would recreate the FEELING and STRATEGY of this reference, adapted for the niche "${projectNiche || "general"}". The prompt should be in Portuguese and start with "Gere uma imagem que...".

Return ONLY this JSON (no markdown, no backticks):
{
  "visual_archetype": "string",
  "emotional_tone": "string",
  "sophistication_level": number,
  "composition_intent": "string",
  "typography_style": { "weight": "string", "tracking": "string", "vibe": "string", "contrast_strategy": "string" },
  "human_context": "string or null",
  "focus_narrative": "string",
  "strategic_why": "string",
  "generated_prompt": "string"
}`;

    const userMessage = humanContext
      ? `Analyze this reference image. Additional context from the user: "${humanContext}"\n\nImage URL: ${imageUrl}`
      : `Analyze this reference image.\n\nImage URL: ${imageUrl}`;

    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (strip markdown fences if present)
    let analysis;
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", raw);
      return new Response(JSON.stringify({ error: "Failed to parse analysis", raw }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    // Extract user from auth header
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Get user ID from the JWT
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      (authHeader || "").replace("Bearer ", "")
    );
    
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Use service role to insert
    const adminClient = createClient(supabaseUrl, supabaseKey);

    const { data: inserted, error: insertError } = await adminClient
      .from("reference_analyses")
      .insert({
        project_id: projectId,
        user_id: userId,
        image_url: imageUrl,
        visual_archetype: analysis.visual_archetype || "",
        emotional_tone: analysis.emotional_tone || "",
        composition_intent: analysis.composition_intent || "",
        typography_style: analysis.typography_style || {},
        human_context: analysis.human_context || null,
        focus_narrative: analysis.focus_narrative || "",
        strategic_why: analysis.strategic_why || "",
        sophistication_level: analysis.sophistication_level || 5,
        generated_prompt: analysis.generated_prompt || null,
        raw_analysis: analysis,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(insertError.message);
    }

    return new Response(JSON.stringify({ analysis: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reference-analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
