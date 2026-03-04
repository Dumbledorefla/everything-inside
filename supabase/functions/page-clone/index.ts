import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface CloneRequest {
  projectId: string;
  sourceUrl: string;
  pageName?: string;
  rewriteIntensity: "light" | "moderate" | "full";
  profile?: "economy" | "standard" | "quality";
}

const TEXT_MODELS: Record<string, string> = {
  economy: "google/gemini-2.5-flash-lite",
  standard: "google/gemini-3-flash-preview",
  quality: "google/gemini-2.5-pro",
};

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
    const visual = dna.visual as any;
    if (identity?.tom) parts.push(`Tom de voz: ${identity.tom}`);
    if (identity?.personalidade) parts.push(`Personalidade: ${identity.personalidade}`);
    if (audience?.publico_alvo) parts.push(`Público-alvo: ${audience.publico_alvo}`);
    if (audience?.dor_principal) parts.push(`Dor principal: ${audience.dor_principal}`);
    if (audience?.desejo_principal) parts.push(`Desejo principal: ${audience.desejo_principal}`);
    if (strategy?.promessa) parts.push(`Promessa: ${strategy.promessa}`);
    if (strategy?.diferencial) parts.push(`Diferencial: ${strategy.diferencial}`);
    if (strategy?.mecanismo) parts.push(`Mecanismo: ${strategy.mecanismo}`);
    if (visual?.estilo) parts.push(`Estilo Visual: ${visual.estilo}`);
    if (visual?.cores) parts.push(`Cores: ${visual.cores}`);
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

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY não configurado. Conecte o Firecrawl nas configurações do projeto.");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { projectId, sourceUrl, pageName, rewriteIntensity = "moderate", profile = "standard" }: CloneRequest = await req.json();

    if (!sourceUrl) throw new Error("sourceUrl é obrigatório.");

    // ── STEP 1: Fetch Project DNA
    const [{ data: project }, { data: dna }] = await Promise.all([
      supabase.from("projects").select("name, niche, product, description").eq("id", projectId).single(),
      supabase.from("project_dna").select("*").eq("project_id", projectId).order("version", { ascending: false }).limit(1).single(),
    ]);
    const dnaContext = buildDNAPrompt(project, dna);

    // ── STEP 2: Scrape Source URL via Firecrawl
    console.log("[PAGE-CLONE] Scraping URL:", sourceUrl);
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: sourceUrl,
        formats: ["markdown"],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    if (!scrapeResponse.ok) {
      throw new Error(`Falha ao acessar a página de origem (${scrapeResponse.status}). Verifique a URL.`);
    }

    const scrapeData = await scrapeResponse.json();
    const pageMarkdown = (scrapeData.data?.markdown || scrapeData.markdown || "").substring(0, 20000);
    const pageTitle = scrapeData.data?.metadata?.title || scrapeData.metadata?.title || "Página Clonada";

    if (!pageMarkdown) throw new Error("Não foi possível extrair conteúdo da página de origem.");

    console.log("[PAGE-CLONE] Scraped. Markdown length:", pageMarkdown.length);

    // ── STEP 3: AI Analysis + Rewrite
    const textModel = TEXT_MODELS[profile];

    const intensityInstructions: Record<string, string> = {
      light: "INTENSIDADE LEVE: Mantenha a estrutura e o estilo geral da página original. Apenas adapte os textos para o nicho e produto do projeto, sem alterar o tom ou a abordagem.",
      moderate: "INTENSIDADE MODERADA: Mantenha a estrutura de seções da página original, mas reescreva completamente todos os textos com o tom de voz, a estratégia e o DNA do projeto. Adapte os gatilhos e argumentos para o público do projeto.",
      full: "INTENSIDADE TOTAL (REMODELAÇÃO COMPLETA): Use a página original apenas como inspiração estrutural. Reescreva tudo do zero com o DNA do projeto. Crie novos ângulos, novos gatilhos e uma nova narrativa completamente original, mantendo apenas a sequência lógica das seções.",
    };

    const rewritePrompt = `Você é um Copywriter e Arquiteto de Páginas de Vendas de elite. Sua missão é analisar uma página de vendas existente e reescrevê-la completamente adaptada ao DNA de um novo projeto.

**DNA DO PROJETO DESTINO (Guia Criativo Obrigatório):**
${dnaContext}

**INSTRUÇÃO DE INTENSIDADE:**
${intensityInstructions[rewriteIntensity]}

**PÁGINA DE ORIGEM (Conteúdo Extraído):**
URL: ${sourceUrl}
Título Original: ${pageTitle}

---
${pageMarkdown}
---

**TAREFA:**
1. Identifique todas as seções da página original (hero, dor, mecanismo, prova social, depoimentos, oferta, garantia, FAQ, CTA, etc.).
2. Para cada seção, reescreva o conteúdo adaptado ao DNA do projeto, seguindo a instrução de intensidade acima.
3. Mantenha a estrutura persuasiva da página original (a sequência das seções), mas adapte TODO o conteúdo ao nicho, produto, público e tom de voz do projeto.

**FORMATO DE SAÍDA (JSON puro, sem markdown):**
{
  "page_title": "Título da nova página",
  "page_type": "sales",
  "sections": [
    {
      "section_type": "hero",
      "headline": "Headline principal reescrita",
      "subheadline": "Sub-headline de apoio",
      "body": "Texto do corpo da seção (2-4 frases)",
      "cta": "Texto do botão de ação",
      "visual_direction": "Descrição da imagem ideal para esta seção"
    }
  ],
  "rewrite_notes": "Observações sobre as principais mudanças feitas e por quê"
}`;

    const aiResp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: textModel,
        messages: [{ role: "user", content: rewritePrompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) throw new Error(`AI error: ${aiResp.status}`);
    const aiData = await aiResp.json();
    const rewrittenPage = JSON.parse(aiData.choices[0].message.content);

    // ── STEP 4: Save to Database
    const { data: page, error: pageErr } = await supabase.from("pages").insert({
      project_id: projectId,
      user_id: user.id,
      name: pageName || rewrittenPage.page_title || `Clone de ${pageTitle}`,
      page_type: rewrittenPage.page_type || "sales",
      status: "draft",
      source_url: sourceUrl,
    }).select().single();

    if (pageErr) throw pageErr;

    // Save sections
    const sectionsToInsert = (rewrittenPage.sections || []).map((s: any, i: number) => ({
      page_id: page.id,
      section_type: s.section_type || "hero",
      sort_order: i,
      status: "review",
    }));

    const { data: savedSections } = await supabase.from("page_sections").insert(sectionsToInsert).select();

    // Save variants for each section
    if (savedSections) {
      for (let i = 0; i < savedSections.length; i++) {
        const section = savedSections[i];
        const rewrittenSection = rewrittenPage.sections[i];
        if (rewrittenSection) {
          await supabase.from("page_section_variants").insert({
            section_id: section.id,
            headline: rewrittenSection.headline || "",
            body: rewrittenSection.body || "",
            cta: rewrittenSection.cta || "",
            style: {
              subheadline: rewrittenSection.subheadline || "",
              visual_direction: rewrittenSection.visual_direction || "",
              source: "clone-remodel",
              rewrite_intensity: rewriteIntensity,
            },
          });
        }
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      project_id: projectId,
      user_id: user.id,
      action: `Clone & Remodel: ${sourceUrl}`,
      entity_type: "page",
      entity_id: page.id,
      metadata: { source_url: sourceUrl, sections_count: sectionsToInsert.length, rewrite_intensity: rewriteIntensity },
    });

    return new Response(JSON.stringify({
      success: true,
      page,
      sectionsCount: sectionsToInsert.length,
      rewriteNotes: rewrittenPage.rewrite_notes,
      pageId: page.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[PAGE-CLONE] Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
