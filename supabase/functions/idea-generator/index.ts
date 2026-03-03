import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface IdeaRequest {
  projectId: string;
  topic: string;
  pieceType: string;
}

function buildDNAPrompt(project: any, dna: any): string {
  if (!project) return "Projeto sem dados de contexto.";

  const parts = [
    `# Projeto: ${project.name}`,
    project.niche ? `Nicho: ${project.niche}` : null,
    project.product ? `Produto: ${project.product}` : null,
  ];

  if (dna) {
    const identity = dna.identity as any;
    const audience = dna.audience as any;
    const strategy = dna.strategy as any;

    if (identity) {
      parts.push(`\n## Identidade`);
      if (identity.tom) parts.push(`Tom de voz: ${identity.tom}`);
      if (identity.personalidade) parts.push(`Personalidade: ${identity.personalidade}`);
    }
    if (audience) {
      parts.push(`\n## Audiência`);
      if (audience.publico_alvo) parts.push(`Público-alvo: ${audience.publico_alvo}`);
      if (audience.dor_principal) parts.push(`Dor principal: ${audience.dor_principal}`);
      if (audience.desejo_principal) parts.push(`Desejo principal: ${audience.desejo_principal}`);
    }
    if (strategy) {
      parts.push(`\n## Estratégia`);
      if (strategy.promessa) parts.push(`Promessa (Big Idea): ${strategy.promessa}`);
      if (strategy.diferencial) parts.push(`Diferencial: ${strategy.diferencial}`);
    }
  }

  return parts.filter(Boolean).join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { projectId, topic, pieceType }: IdeaRequest = await req.json();
    if (!projectId || !topic) throw new Error("projectId and topic are required");

    const [{ data: project }, { data: dna }] = await Promise.all([
      supabase.from("projects").select("name, niche, product").eq("id", projectId).single(),
      supabase.from("project_dna").select("*").eq("project_id", projectId).order("version", { ascending: false }).limit(1).single(),
    ]);

    const dnaContext = buildDNAPrompt(project, dna);

    const systemPrompt = `Você é um Diretor de Criação e Estrategista de Conteúdo de elite, especialista em marketing digital. Sua missão é gerar 5 ideias criativas e estratégicas para um conteúdo de ${pieceType}.

**DNA DO PROJETO (Guia Criativo Obrigatório):**
${dnaContext}

**INSTRUÇÕES CRÍTICAS:**
1.  **Gere 5 Ideias**: Crie exatamente 5 ideias distintas e de alta qualidade.
2.  **Alinhamento Estratégico**: As ideias DEVEM estar 100% alinhadas com o DNA do projeto (nicho, público, tom de voz).
3.  **Foco no Tópico**: As ideias devem ser sobre o tópico: "${topic}".
4.  **Formato de Saída**: Para cada ideia, forneça um \`headline\` (título curto e magnético) e um \`body\` (descrição de 1-2 frases explicando a ideia e o visual).`;

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
          { role: "user", content: `Gere 5 ideias criativas sobre: ${topic}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_ideas",
            description: "Return 5 creative content ideas",
            parameters: {
              type: "object",
              properties: {
                ideias: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      headline: { type: "string", description: "Short magnetic title" },
                      body: { type: "string", description: "1-2 sentence description of the idea and visual" },
                    },
                    required: ["headline", "body"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["ideias"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_ideas" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let ideasResult: any;
    try {
      ideasResult = JSON.parse(toolCall?.function?.arguments || "{}");
    } catch {
      throw new Error("Failed to parse ideas result");
    }

    // Log credits
    await supabase.from("cos_ledger").insert({
      project_id: projectId,
      user_id: user.id,
      operation_type: "IDEA_GENERATOR",
      provider_used: "google/gemini-2.5-flash",
      credits_cost: 3,
      estimated_usd: 0.01,
      metadata: { topic, pieceType },
    });

    return new Response(JSON.stringify(ideasResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("idea-generator error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
