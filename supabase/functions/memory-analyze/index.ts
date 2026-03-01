import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { projectId, assetIds } = await req.json();
    if (!projectId) throw new Error("projectId required");

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch recent approved/official assets
    let query = serviceClient
      .from("assets")
      .select("id, title, profile_used, provider_used, preset, status, asset_versions(headline, body, cta, generation_metadata)")
      .eq("project_id", projectId)
      .in("status", ["approved", "official"])
      .order("updated_at", { ascending: false })
      .limit(10);

    const { data: assets } = await query;

    if (!assets || assets.length < 3) {
      return new Response(JSON.stringify({
        patterns: [],
        message: "Mínimo de 3 ativos aprovados necessário para análise.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch current DNA
    const { data: dna } = await serviceClient
      .from("project_dna")
      .select("identity, audience, strategy, visual, version")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const dnaStr = dna ? JSON.stringify({
      identity: dna.identity,
      audience: dna.audience,
      strategy: dna.strategy,
      visual: dna.visual,
      version: dna.version,
    }) : "Nenhum DNA configurado";

    const assetSummary = assets.map((a: any, i: number) => {
      const v = a.asset_versions?.[0];
      return `${i + 1}. Headline: "${v?.headline || a.title}" | Body: "${v?.body?.slice(0, 80) || ""}" | CTA: "${v?.cta || ""}" | Perfil: ${a.profile_used} | Proporção: ${a.preset} | Status: ${a.status}`;
    }).join("\n");

    // Use LLM to analyze patterns
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um analista de padrões de marketing do COS (Creative Operating System).
Analise os criativos aprovados e compare com o DNA atual do projeto.
Identifique padrões NÃO cobertos pelo DNA atual.

DNA ATUAL:
${dnaStr}

Responda APENAS em JSON válido com esta estrutura:
{
  "patterns": [
    {
      "pattern_key": "string (ex: style:short_headlines)",
      "description": "string (descrição em PT-BR)",
      "category": "string (style|quality|content|provider)",
      "confidence": number (0-1),
      "suggested_dna_patch": { "campo": "valor sugerido" }
    }
  ],
  "summary": "string (resumo em PT-BR)"
}

Retorne APENAS o JSON.`,
          },
          {
            role: "user",
            content: `Analise estes ${assets.length} criativos aprovados/oficiais:\n\n${assetSummary}`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI analysis error:", resp.status, t);
      throw new Error("Erro na análise de IA");
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let analysis = { patterns: [], summary: "Análise inconclusiva" };

    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch {}
    }

    // Save high-confidence patterns as pending DNA updates
    for (const p of (analysis.patterns || [])) {
      if ((p.confidence || 0) >= 0.7) {
        await serviceClient.from("pending_dna_updates").insert({
          project_id: projectId,
          user_id: user.id,
          suggestion_text: p.description,
          json_patch: p.suggested_dna_patch || {},
          status: "pending",
        });
      }
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
