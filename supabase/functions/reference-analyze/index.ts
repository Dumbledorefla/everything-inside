import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Reference Type Prompts ──────────────────────────────────────
const TYPE_FOCUS: Record<string, string> = {
  instagram: `FOCO ESPECIAL (INSTAGRAM/CONTEÚDO):
- Priorize análise de VIRALIZAÇÃO e RETENÇÃO
- Identifique ganchos visuais que param o scroll (pattern interrupt)
- Avalie estética nativa da plataforma (cores vibrantes, contraste alto)
- Analise o potencial de compartilhamento e engajamento
- Identifique tendências visuais do momento (ex: design Y2K, minimalismo, maximalismo)`,

  sales: `FOCO ESPECIAL (VENDA / DIRECT RESPONSE):
- Priorize análise de CONVERSÃO e DESEJO
- Foque no produto: como ele é apresentado, iluminado, posicionado
- Analise provas sociais visuais (badges, selos, depoimentos)
- Avalie clareza da oferta e hierarquia de informação
- Identifique gatilhos de urgência e escassez visuais
- Analise o CTA: posição, cor, tamanho, contraste com o fundo`,

  landing: `FOCO ESPECIAL (LANDING PAGE / SITE):
- Priorize análise de ESTRUTURA e ESCANEABILIDADE
- Analise blocos de informação e seções (hero, benefícios, prova, CTA)
- Avalie hierarquia de botões e CTAs (primário vs secundário)
- Analise o grid, espaçamento e ritmo visual das seções
- Identifique padrões de leitura (F-pattern, Z-pattern)
- Avalie responsividade implícita e adaptabilidade mobile`,

  brand: `FOCO ESPECIAL (REFERÊNCIA DE MARCA):
- Priorize análise de IDENTIDADE e TOM DE VOZ visual
- Extraia APENAS os elementos de longo prazo: cores institucionais, tipografia de marca, texturas recorrentes
- Analise o "feeling" geral da marca (premium, acessível, rebelde, institucional)
- Identifique consistência visual e sistema de design implícito
- Foque em elementos replicáveis para construir brand guidelines`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { imageUrl, projectId, projectNiche, humanContext, referenceType } = await req.json();
    if (!imageUrl || !projectId) {
      return new Response(JSON.stringify({ error: "imageUrl and projectId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refType = referenceType || "instagram";
    const typeFocus = TYPE_FOCUS[refType] || TYPE_FOCUS.instagram;

    const systemPrompt = `You are a Deep Perception Engine — an elite Art Director and Marketing Strategist. You perform surgical-precision visual semiotics analysis. Return ONLY a JSON object (no markdown, no backticks).

${typeFocus}

ANALYSIS AXES:

1. PSICOLOGIA E SENTIMENTO
- Emoção dominante (Ex: Urgência, Calmaria, Autoridade, Luxo, Nostalgia, Empoderamento)
- Arquétipo visual (Ex: O Mago, O Herói, O Minimalista, O Rebelde, O Sedutor, O Sábio)
- Nível de Sofisticação: escala 1-10 (1=massivo/popular, 10=ultra-luxo). Considere tipografia, respiro, paleta restrita, refinamento compositivo.

2. INTENCIONALIDADE DE COMPOSIÇÃO
- Por que esta imagem FUNCIONA? Hierarquia visual (onde o olho bate primeiro)
- Profundidade de campo (bokeh, foco seletivo, camadas)
- Regra dos terços, simetria, espaço negativo
- Posição do herói (produto/pessoa central, lateral, contextual)

3. CONTEXTO HUMANO E POSE (se houver pessoas)
- Demografia: idade aproximada, estilo de vestimenta (lifestyle, executivo, casual, atlético)
- Linguagem corporal: pose, expressão facial exata, o que transmite (confiança, alívio, poder, vulnerabilidade)
- Contexto de uso: escritório (business), casa (conforto), rua (liberdade), estúdio (profissional)
- Se não houver pessoas, retorne null

4. SEMIÓTICA DO TEXTO E TIPOGRAFIA
- Copy presente: qual a mensagem implícita?
- Peso das fontes (bold, light, medium), tracking (tight, normal, wide)
- Uso de espaço em branco (respiro) — comunica exclusividade ou acessibilidade?
- Serif vs Sans-serif, modern vs classic, contraste com fundo
- EXTRAIA o texto literal visível na imagem no campo "extracted_copy"

5. DNA VISUAL PROFUNDO
- Paleta: extraia os 3-5 HEX codes dominantes
- Textura de Luz: suave/softbox, dura/direcional, neon/artificial, natural/golden hour, difusa
- Nível de ruído/grão: limpo, sutil grain, pesado/vintage
- Temperatura de cor: fria, neutra, quente

6. FOCO NARRATIVO
- O que é o "herói" da imagem e por quê?
- Que história a composição conta?

7. STRATEGIC WHY (POR QUE FUNCIONA)
- Gatilhos psicológicos ativados (prova social, aspiração, escassez, autoridade, pertencimento)
- Por que um Diretor de Arte de elite escolheria esta composição?

8. PROMPT DE GERAÇÃO
- Transforme TODA a análise acima em um prompt único e acionável para recriar o SENTIMENTO e ESTRATÉGIA desta referência, adaptado para o nicho "${projectNiche || "general"}".
- Comece com "Gere uma imagem que..."
- Inclua: sentimento alvo, composição, profundidade de campo, posição do herói, textura de luz, paleta, e adaptação ao nicho.

SCHEMA DE RESPOSTA (JSON puro, sem markdown):
{
  "visual_archetype": "string",
  "emotional_tone": "string",
  "sophistication_level": number,
  "composition_intent": "string",
  "typography_style": { "weight": "string", "tracking": "string", "vibe": "string", "contrast_strategy": "string", "whitespace_intent": "string" },
  "extracted_copy": "string or null",
  "human_context": "string or null",
  "focus_narrative": "string",
  "strategic_why": "string",
  "generated_prompt": "string",
  "palette": ["#hex1", "#hex2", "#hex3"],
  "lighting_type": "string",
  "grain_level": "string",
  "color_temperature": "string"
}`;

    const userMessage = humanContext
      ? `Analyze this ${refType} reference image. Additional context from the user: "${humanContext}"\n\nImage URL: ${imageUrl}`
      : `Analyze this ${refType} reference image.\n\nImage URL: ${imageUrl}`;

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
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

    const { data: inserted, error: insertError } = await adminClient
      .from("reference_analyses")
      .insert({
        project_id: projectId,
        user_id: user.id,
        image_url: imageUrl,
        reference_type: refType,
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
