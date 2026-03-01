import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { projectId, generalContext, referenceUrls, includeMarketResearch } = await req.json();
    if (!projectId) throw new Error("projectId required");

    // Fetch project basic info
    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (!project) throw new Error("Project not found");

    // Fetch current DNA if exists
    const { data: currentDna } = await supabase.from("project_dna").select("*")
      .eq("project_id", projectId).order("version", { ascending: false }).limit(1).single();

    // Fetch brand kit if exists
    const { data: brandKit } = await supabase.from("brand_kits").select("*").eq("project_id", projectId).maybeSingle();

    // ── Build analysis prompt ───────────────────────────────────
    const referenceDescriptions = (referenceUrls || []).length > 0
      ? `\nO usuário enviou ${referenceUrls.length} imagens de referência visual. URLs: ${referenceUrls.join(", ")}. Analise o estilo visual implícito dessas referências (cores dominantes, mood, estilo fotográfico/ilustrativo, tipografia sugerida).`
      : "";

    const brandKitContext = brandKit
      ? `\nBrand Kit existente: Cores: ${JSON.stringify(brandKit.color_palette)}, Tipografia: ${JSON.stringify(brandKit.typography)}, Linha Editorial: ${JSON.stringify(brandKit.editorial_line)}`
      : "";

    const currentDnaContext = currentDna
      ? `\nDNA atual (v${currentDna.version}): Identidade: ${JSON.stringify(currentDna.identity)}, Audiência: ${JSON.stringify(currentDna.audience)}, Estratégia: ${JSON.stringify(currentDna.strategy)}, Visual: ${JSON.stringify(currentDna.visual)}`
      : "";

    const marketResearchInstruction = includeMarketResearch
      ? `\n\nPESQUISA DE MERCADO: Com base no nicho "${project.niche || generalContext}", faça uma análise de mercado incluindo:
- Principais concorrentes e como se posicionam
- Tendências visuais e de comunicação do nicho
- Linguagem e tom que funcionam melhor nesse mercado
- Cores e estilos visuais mais usados por marcas de sucesso no nicho
- Objeções comuns do público-alvo
Use esse conhecimento para enriquecer TODAS as seções do DNA.`
      : "";

    const systemPrompt = `Você é um estrategista de marca e diretor criativo especialista em marketing digital brasileiro.

Sua missão é gerar o DNA completo de um projeto criativo com base nas informações fornecidas.

PROJETO: "${project.name}"
Nicho cadastrado: "${project.niche || "não definido"}"
Produto cadastrado: "${project.product || "não definido"}"
Descrição: "${project.description || "não definida"}"

CONTEXTO GERAL DO USUÁRIO:
${generalContext || "Nenhum contexto adicional fornecido."}
${referenceDescriptions}
${brandKitContext}
${currentDnaContext}
${marketResearchInstruction}

IMPORTANTE:
- Cruze TODAS as fontes (contexto do usuário, referências visuais, brand kit, pesquisa de mercado) para gerar um DNA coerente e profissional.
- Priorize o contexto do usuário — é a visão dele sobre o projeto.
- As referências visuais indicam o estilo que ele DESEJA, use isso para definir cores, fontes e estilo.
- Se houver pesquisa de mercado, use-a para enriquecer a estratégia e audiência.
- Mantenha campos já preenchidos no DNA atual se fizerem sentido, mas melhore-os.`;

    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere o DNA completo do projeto. ${generalContext || ""}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "fill_project_dna",
            description: "Fill the complete project DNA with all sections",
            parameters: {
              type: "object",
              properties: {
                identity: {
                  type: "object",
                  properties: {
                    nome: { type: "string", description: "Project name" },
                    nicho: { type: "string", description: "Market niche" },
                    produto: { type: "string", description: "Product or service" },
                    slogan: { type: "string", description: "Brand slogan" },
                    tom: { type: "string", description: "Tone of voice (e.g., Profissional, Descontraído, Místico)" },
                    personalidade: { type: "string", description: "Brand personality description" },
                  },
                  required: ["nome", "nicho", "produto", "slogan", "tom", "personalidade"],
                },
                audience: {
                  type: "object",
                  properties: {
                    perfil: { type: "string", description: "Target audience profile" },
                    dor_principal: { type: "string", description: "Main pain point" },
                    desejo_principal: { type: "string", description: "Main desire" },
                    objecoes: { type: "string", description: "Common objections" },
                    provas: { type: "string", description: "Social proof types" },
                  },
                  required: ["perfil", "dor_principal", "desejo_principal", "objecoes", "provas"],
                },
                strategy: {
                  type: "object",
                  properties: {
                    promessa: { type: "string", description: "Big promise/idea" },
                    diferencial: { type: "string", description: "Key differentiator" },
                    mecanismo: { type: "string", description: "Mechanism/method" },
                    cta_padrao: { type: "string", description: "Default CTA" },
                    palavras_proibidas: { type: "string", description: "Forbidden words/phrases" },
                    pilares: { type: "string", description: "Content pillars" },
                  },
                  required: ["promessa", "diferencial", "mecanismo", "cta_padrao", "palavras_proibidas", "pilares"],
                },
                visual: {
                  type: "object",
                  properties: {
                    estilo: { type: "string", description: "Visual style description" },
                    cores: { type: "string", description: "Color description" },
                    referencia: { type: "string", description: "Visual reference description" },
                    colors: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          hex: { type: "string" },
                        },
                        required: ["name", "hex"],
                      },
                      description: "5 brand colors with hex values",
                    },
                    fonts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          role: { type: "string" },
                          family: { type: "string" },
                          weight: { type: "string" },
                          size: { type: "string" },
                        },
                        required: ["role", "family", "weight", "size"],
                      },
                      description: "3 font definitions (Headline, Corpo, CTA) using Google Fonts",
                    },
                  },
                  required: ["estilo", "cores", "referencia", "colors", "fonts"],
                },
                marketInsights: {
                  type: "string",
                  description: "Market research summary and insights (if requested)",
                },
              },
              required: ["identity", "audience", "strategy", "visual"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "fill_project_dna" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await res.text();
      console.error("AI error:", res.status, errText);
      throw new Error("Failed to generate DNA");
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let dnaResult: any;
    try {
      dnaResult = JSON.parse(toolCall?.function?.arguments || "{}");
    } catch {
      throw new Error("Failed to parse DNA result");
    }

    // Log credits
    await supabase.from("cos_ledger").insert({
      project_id: projectId,
      user_id: user.id,
      operation_type: "DNA_AUTOFILL",
      provider_used: "google/gemini-3-flash-preview",
      credits_cost: includeMarketResearch ? 15 : 8,
      estimated_usd: includeMarketResearch ? 0.08 : 0.04,
      metadata: {
        hasContext: !!generalContext,
        referenceCount: referenceUrls?.length || 0,
        includeMarketResearch,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      dna: {
        identity: dnaResult.identity,
        audience: dnaResult.audience,
        strategy: dnaResult.strategy,
        visual: dnaResult.visual,
      },
      marketInsights: dnaResult.marketInsights || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("DNA autofill error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
