import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const CREDIT_COSTS = { memory_analysis: { credits: 3, usd: 0.03 } };

Deno.serve(async (req) => {
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

    const { projectId, autoTriggered } = await req.json();
    if (!projectId) throw new Error("projectId required");

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ═══ BATCH TRIGGER LOGIC ═══
    // If auto-triggered, check if enough new officials since last analysis
    if (autoTriggered) {
      const { data: lastMemory } = await serviceClient
        .from("project_memory")
        .select("last_analysis_at")
        .eq("project_id", projectId)
        .order("last_analysis_at", { ascending: false })
        .limit(1)
        .single();

      const lastAnalysis = lastMemory?.last_analysis_at ? new Date(lastMemory.last_analysis_at) : new Date(0);
      
      const { count: newOfficials } = await serviceClient
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "official")
        .gte("updated_at", lastAnalysis.toISOString());

      if (!newOfficials || newOfficials < 5) {
        return new Response(JSON.stringify({
          patterns: [],
          message: `Apenas ${newOfficials || 0}/5 novos ativos oficiais desde última análise. Aguardando mais.`,
          skipped: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fetch recent approved/official assets
    const { data: assets } = await serviceClient
      .from("assets")
      .select("id, title, profile_used, provider_used, preset, status, output, destination, asset_versions(headline, body, cta, generation_metadata)")
      .eq("project_id", projectId)
      .in("status", ["approved", "official"])
      .order("updated_at", { ascending: false })
      .limit(15);

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

    const dnaStr = dna ? JSON.stringify({ identity: dna.identity, audience: dna.audience, strategy: dna.strategy, visual: dna.visual, version: dna.version }) : "Nenhum DNA configurado";

    const assetSummary = assets.map((a: any, i: number) => {
      const v = a.asset_versions?.[0];
      return `${i + 1}. Headline: "${v?.headline || a.title}" | Body: "${(v?.body || "").slice(0, 100)}" | CTA: "${v?.cta || ""}" | Perfil: ${a.profile_used} | Output: ${a.output} | Ratio: ${a.preset} | Status: ${a.status}`;
    }).join("\n");

    // ═══ LLM ANALYSIS WITH TOOL CALLING ═══
    const resp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um Diretor de Arte e Copywriter senior do COS (Creative Operating System).
Analise os criativos aprovados e compare com o DNA atual do projeto.
Identifique padrões NÃO cobertos pelo DNA atual que são consistentes nos ativos aprovados.

DNA ATUAL:
${dnaStr}

Responda APENAS em JSON válido com esta estrutura exata:
{
  "patterns": [
    {
      "type": "COPY" | "VISUAL" | "STRATEGY",
      "description": "descrição em PT-BR do padrão detectado",
      "confidence": 0.0-1.0,
      "proposed_patch": { "campo_do_dna": "valor_sugerido" },
      "evidence": "exemplos dos ativos que comprovam"
    }
  ],
  "summary": "resumo executivo em PT-BR"
}

Regras:
- Apenas padrões com confiança >= 0.6
- Máximo 5 padrões
- proposed_patch deve ser específico e acionável
- Retorne APENAS o JSON, sem markdown`
          },
          {
            role: "user",
            content: `Analise estes ${assets.length} criativos aprovados/oficiais:\n\n${assetSummary}`
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
    let analysis = { patterns: [] as any[], summary: "Análise inconclusiva" };

    if (jsonMatch) {
      try { analysis = JSON.parse(jsonMatch[0]); } catch {}
    }

    // Save high-confidence patterns as pending DNA updates
    let savedCount = 0;
    for (const p of (analysis.patterns || [])) {
      if ((p.confidence || 0) >= 0.6) {
        await serviceClient.from("pending_dna_updates").insert({
          project_id: projectId,
          user_id: user.id,
          suggestion_text: `[${p.type}] ${p.description}`,
          json_patch: p.proposed_patch || {},
          status: "pending",
        });
        savedCount++;
      }
    }

    // Update last_analysis_at timestamp
    await serviceClient.from("project_memory").upsert({
      project_id: projectId,
      user_id: user.id,
      pattern: "system:last_analysis",
      category: "system",
      last_analysis_at: new Date().toISOString(),
      confirmed: true,
    }, { onConflict: "project_id,pattern" });

    // Log telemetry
    await serviceClient.from("cos_ledger").insert({
      project_id: projectId,
      user_id: user.id,
      provider_used: "gemini-3-flash-preview",
      operation_type: "MEMORY_ANALYSIS",
      credits_cost: CREDIT_COSTS.memory_analysis.credits,
      estimated_usd: CREDIT_COSTS.memory_analysis.usd,
      metadata: { patterns_found: analysis.patterns?.length || 0, saved: savedCount },
    });

    return new Response(JSON.stringify({ ...analysis, saved: savedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
