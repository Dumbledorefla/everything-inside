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

    const { messages, projectId } = await req.json();

    // Fetch project DNA for context
    let dnaContext = "";
    if (projectId) {
      const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: project } = await serviceClient.from("projects").select("name, niche, product, description").eq("id", projectId).single();
      const { data: dna } = await serviceClient.from("project_dna").select("identity, audience, strategy").eq("project_id", projectId).order("version", { ascending: false }).limit(1).single();

      if (project) {
        dnaContext = `\n\nContexto do projeto "${project.name}":`;
        if (project.niche) dnaContext += `\nNicho: ${project.niche}`;
        if (project.product) dnaContext += `\nProduto: ${project.product}`;
        if (project.description) dnaContext += `\nDescrição: ${project.description}`;
      }
      if (dna) {
        const id = dna.identity as any;
        const aud = dna.audience as any;
        const str = dna.strategy as any;
        if (id?.tom) dnaContext += `\nTom: ${id.tom}`;
        if (aud?.dor_principal) dnaContext += `\nDor: ${aud.dor_principal}`;
        if (str?.promessa) dnaContext += `\nPromessa: ${str.promessa}`;
      }
    }

    const systemPrompt = `Você é o Assistente COS — um especialista em marketing digital e criação de conteúdo.
Você ajuda o usuário a planejar, criar e refinar criativos de marketing (posts, banners, ads, stories, páginas de vendas).
Seja direto, prático e focado em resultados. Use português brasileiro.
Quando o usuário pedir para gerar conteúdo, oriente-o a usar a tela de Produção com os controles adequados.
Quando pedir planejamento, sugira calendários e sprints.${dnaContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cos-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
