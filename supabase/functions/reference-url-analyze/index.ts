import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const TYPE_FOCUS: Record<string, string> = {
  instagram: `FOCO (INSTAGRAM): Analise o perfil/publicação como referência de conteúdo digital. Foque em: estética do feed, tipos de post, ganchos de retenção, tom de voz, frequência implícita, uso de stories/reels, engajamento visual.`,
  sales: `FOCO (VENDA/DIRECT RESPONSE): Analise como página de vendas. Foque em: headline principal, sub-headlines, hierarquia de benefícios, prova social, gatilhos de urgência/escassez, estrutura de oferta, CTA principal e secundários, objeções tratadas, garantia.`,
  landing: `FOCO (LANDING PAGE/SITE): Analise como landing page ou site institucional. Foque em: estrutura de seções (hero, benefícios, prova, CTA), escaneabilidade, hierarquia visual, navegação, responsividade implícita, padrões de leitura F/Z.`,
  brand: `FOCO (MARCA/BRANDING): Analise como referência de identidade de marca. Foque em: tom de voz, personalidade da marca, consistência visual, paleta, tipografia, elementos recorrentes, posicionamento, arquétipo de marca.`,
  ecommerce: `FOCO (E-COMMERCE): Analise como loja virtual. Foque em: apresentação de produto, fotografias, grid de produtos, filtros, UX de compra, upsell/cross-sell, trust badges, política de frete/devolução, reviews.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured. Conecte o Firecrawl nas configurações.");

    const { pageUrl, projectId, projectNiche, humanContext, referenceType } = await req.json();
    if (!pageUrl || !projectId) {
      return new Response(JSON.stringify({ error: "pageUrl and projectId are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refType = referenceType || "landing";
    const typeFocus = TYPE_FOCUS[refType] || TYPE_FOCUS.landing;

    // ── Step 1: Scrape URL via Firecrawl ──
    console.log("Scraping URL:", pageUrl);
    
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: pageUrl,
        formats: ["markdown", "screenshot"],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errText = await scrapeResponse.text();
      console.error("Firecrawl error:", scrapeResponse.status, errText);
      throw new Error(`Falha ao acessar a página (${scrapeResponse.status}). Verifique a URL.`);
    }

    const scrapeData = await scrapeResponse.json();
    const pageMarkdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const pageScreenshot = scrapeData.data?.screenshot || scrapeData.screenshot || null;
    const pageMetadata = scrapeData.data?.metadata || scrapeData.metadata || {};

    if (!pageMarkdown && !pageScreenshot) {
      throw new Error("Não foi possível extrair conteúdo da página.");
    }

    console.log("Scraped successfully. Markdown length:", pageMarkdown.length, "Has screenshot:", !!pageScreenshot);

    // ── Step 2: AI Analysis ──
    const systemPrompt = `You are a Deep Perception Engine — an elite Art Director, Copywriter and Marketing Strategist. You perform surgical-precision analysis of web pages and digital assets. Return ONLY a JSON object (no markdown, no backticks).

${typeFocus}

VOCÊ ESTÁ ANALISANDO UMA PÁGINA WEB COMPLETA (não apenas uma imagem). Analise TUDO: copy, design, estrutura, persuasão, UX.

REGRA FUNDAMENTAL: Use esta referência para INSPIRAÇÃO e APRENDIZADO, não para cópia. Identifique os PRINCÍPIOS por trás das escolhas, não os elementos literais.

EIXOS DE ANÁLISE:

1. COPY E PERSUASÃO
- Headline principal e sub-headlines: qual a promessa central?
- Tipo de persuasão dominante (lógica, emocional, urgência, autoridade, prova social)
- Tom de voz (formal, casual, autoritário, empático, provocador)
- Gatilhos psicológicos identificados (escassez, reciprocidade, compromisso, prova social, autoridade, afinidade)
- Estrutura argumentativa (problema→solução, antes→depois, lista de benefícios, storytelling)
- CTAs: texto exato, posicionamento, frequência

2. ESTRUTURA E ARQUITETURA
- Mapa de seções da página (lista sequencial das seções)
- Hierarquia de informação (o que vem primeiro, o que é priorizado)
- Padrão de leitura estimado (F-pattern, Z-pattern, linear)
- Blocos de prova social (depoimentos, logos, números)
- Blocos de objeção (FAQ, garantias, políticas)

3. DESIGN E IDENTIDADE VISUAL
- Paleta de cores dominante (extraia 3-5 HEX codes)
- Estilo tipográfico (serif vs sans, peso, hierarquia)
- Uso de espaço em branco e respiro
- Estilo de imagens/fotos (lifestyle, produto isolado, ilustração, ícones)
- Nível de sofisticação visual (1-10)

4. PÚBLICO E POSICIONAMENTO
- Público-alvo implícito (demografia, psicografia)
- Nível de consciência do público (inconsciente, consciente do problema, consciente da solução, consciente do produto, totalmente consciente)
- Posicionamento de mercado (premium, acessível, massivo, nicho)
- Diferenciação implícita (o que os separa da concorrência)

5. LIÇÕES ESTRATÉGICAS
- Os 3-5 princípios mais fortes que podem ser ADAPTADOS (não copiados) para outro projeto
- O que NÃO fazer (elementos fracos ou genéricos)
- Por que esta página funciona (ou não funciona)

6. PROMPT DE RECRIAÇÃO ESTRATÉGICA
- Um prompt detalhado para recriar a ESTRATÉGIA e o SENTIMENTO desta referência adaptado ao nicho "${projectNiche || "general"}"
- NÃO copie a referência, extraia os princípios e adapte

SCHEMA DE RESPOSTA (JSON puro):
{
  "page_title": "string",
  "page_type": "landing|ecommerce|instagram|sales|brand|blog|other",
  "visual_archetype": "string (arquétipo visual dominante)",
  "emotional_tone": "string (tom emocional principal)",
  "sophistication_level": number (1-10),
  "copy_analysis": {
    "main_headline": "string",
    "sub_headlines": ["string"],
    "persuasion_type": "string",
    "tone_of_voice": "string",
    "psychological_triggers": ["string"],
    "argument_structure": "string",
    "ctas": [{"text": "string", "position": "string"}]
  },
  "structure_map": {
    "sections": [{"name": "string", "purpose": "string", "order": number}],
    "reading_pattern": "string",
    "social_proof_blocks": ["string"],
    "objection_handling": ["string"]
  },
  "design_identity": {
    "palette": ["#hex"],
    "typography_style": {"heading": "string", "body": "string", "hierarchy": "string"},
    "whitespace_usage": "string",
    "image_style": "string",
    "overall_aesthetic": "string"
  },
  "audience_positioning": {
    "target_audience": "string",
    "awareness_level": "string",
    "market_position": "string",
    "differentiation": "string"
  },
  "strategic_lessons": {
    "top_principles": ["string"],
    "what_not_to_do": ["string"],
    "why_it_works": "string"
  },
  "composition_intent": "string (resumo da intenção compositiva)",
  "focus_narrative": "string (foco narrativo central)",
  "strategic_why": "string (por que funciona estrategicamente)",
  "generated_prompt": "string (prompt para recriar a estratégia adaptada)",
  "human_context": "string or null"
}`;

    const truncatedMarkdown = pageMarkdown.substring(0, 15000);

    const userContent: any[] = [
      {
        type: "text",
        text: `Analyze this ${refType} reference page in depth.\n\nPage URL: ${pageUrl}\nPage Title: ${pageMetadata.title || "Unknown"}\n${humanContext ? `Additional context: "${humanContext}"\n` : ""}\n\n--- PAGE CONTENT (Markdown) ---\n${truncatedMarkdown}\n--- END ---`,
      },
    ];

    if (pageScreenshot) {
      userContent.push({
        type: "image_url",
        image_url: { url: pageScreenshot.startsWith("data:") ? pageScreenshot : `data:image/png;base64,${pageScreenshot}` },
      });
    }

    const aiResponse = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI gateway error:", status, t);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    let analysis;
    try {
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", raw.substring(0, 500));
      return new Response(JSON.stringify({ error: "Falha ao processar a análise", raw: raw.substring(0, 200) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 3: Save to database ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Use screenshot as the image_url for the reference card, or a placeholder
    const displayImage = pageScreenshot && pageScreenshot.startsWith("http") 
      ? pageScreenshot 
      : pageMetadata.ogImage || pageMetadata.image || `https://api.microlink.io/?url=${encodeURIComponent(pageUrl)}&screenshot=true&meta=false&embed=screenshot.url`;

    const { data: inserted, error: insertError } = await adminClient
      .from("reference_analyses")
      .insert({
        project_id: projectId,
        user_id: user.id,
        image_url: displayImage,
        reference_type: refType,
        visual_archetype: analysis.visual_archetype || "",
        emotional_tone: analysis.emotional_tone || "",
        composition_intent: analysis.composition_intent || "",
        typography_style: analysis.design_identity?.typography_style || {},
        human_context: analysis.human_context || null,
        focus_narrative: analysis.focus_narrative || "",
        strategic_why: analysis.strategic_why || "",
        sophistication_level: analysis.sophistication_level || 5,
        generated_prompt: analysis.generated_prompt || null,
        raw_analysis: { ...analysis, source_url: pageUrl, source_type: "url_scrape", page_markdown_length: pageMarkdown.length },
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
    console.error("reference-url-analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
