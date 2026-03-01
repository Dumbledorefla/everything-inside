import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Provider mapping by profile (Nano Banana equivalents) ───────
const TEXT_MODELS: Record<string, string[]> = {
  economy: ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"],
  standard: ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"],
  quality: ["google/gemini-2.5-pro", "google/gemini-3-flash-preview"],
};

const IMAGE_MODELS: Record<string, string[]> = {
  economy: ["google/gemini-2.5-flash-image"],                              // NB 2.5 (economia)
  standard: ["google/gemini-2.5-flash-image", "google/gemini-3-pro-image-preview"], // NB 2 (padrão)
  quality: ["google/gemini-3-pro-image-preview", "google/gemini-2.5-flash-image"],  // NB Pro (qualidade)
};

const CREDIT_COSTS: Record<string, number> = {
  "google/gemini-2.5-flash-lite": 1,
  "google/gemini-2.5-flash": 2,
  "google/gemini-3-flash-preview": 3,
  "google/gemini-2.5-pro": 8,
  "google/gemini-2.5-flash-image": 3,
  "google/gemini-3-pro-image-preview": 10,
};

const PIECE_PROMPTS: Record<string, string> = {
  post: "Crie um post para redes sociais com headline impactante, body persuasivo e CTA direto.",
  banner: "Crie um banner publicitário com headline curta e impactante, subtítulo de apoio e CTA.",
  story: "Crie um story para Instagram com texto curto, direto e envolvente, adequado para formato vertical.",
  ad: "Crie um anúncio pago com headline que gera curiosidade, body que aborda dor/desejo e CTA urgente.",
  thumbnail: "Crie um texto para thumbnail de vídeo: título curto e chamativo que gere clique.",
  vsl: "Crie um roteiro de VSL (Video Sales Letter) com gancho, problema, solução, prova e CTA.",
};

// ── Quality finishing instructions ──────────────────────────────
const QUALITY_FINISHING_TEXT = `
INSTRUÇÕES DE QUALIDADE PREMIUM:
- Use palavras de poder e gatilhos mentais sofisticados
- Aplique storytelling micro (mesmo em textos curtos)
- Headline com no máximo 8 palavras, alta densidade semântica
- CTA com urgência sutil, nunca genérico
- Body com ritmo: frase curta, frase média, frase de impacto
- Revise a copy como se fosse para uma campanha de R$100k/dia`;

const QUALITY_FINISHING_IMAGE = `
QUALITY FINISHING INSTRUCTIONS:
- Ultra high resolution, crisp details, professional lighting
- Studio-quality composition with perfect visual hierarchy
- Rich color grading, cinematic contrast
- Premium typography integration zones
- Clean negative space for text overlay
- Commercial photography aesthetic`;

interface GenerateRequest {
  projectId: string;
  mode: "rapido" | "orientado" | "sprint";
  output: "text" | "image" | "both";
  pieceType: string;
  quantity: number;
  profile: "economy" | "standard" | "quality";
  provider: string;
  destination: string;
  ratio: string;
  intensity: string;
  useModel: boolean;
  useVisualProfile: boolean;
  userPrompt?: string;
  regenerateAssetId?: string;
  pipelineMode?: "simple" | "outline" | "variants" | "assembly";
  outlineSections?: string[];
  referenceId?: string; // Deep Perception reference to inject
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
    const body: GenerateRequest = await req.json();
    const {
      projectId, mode, output, pieceType, quantity, profile,
      provider, destination, ratio, intensity, userPrompt,
      regenerateAssetId, pipelineMode = "simple", referenceId,
    } = body;

    // ── 1. Fetch Project DNA (latest version) ───────────────────
    const { data: dna } = await supabase
      .from("project_dna")
      .select("*")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const { data: project } = await supabase
      .from("projects")
      .select("name, niche, product, description")
      .eq("id", projectId)
      .single();

    // ── DNA Version ID for snapshot ─────────────────────────────
    const dnaVersionId: string | null = dna?.id ?? null;

    // ── 2. Build DNA System Prompt ──────────────────────────────
    // ── 2a. Fetch Deep Perception reference if provided ─────────
    let deepPerceptionContext = "";
    if (referenceId) {
      const { data: refAnalysis } = await supabase
        .from("reference_analyses")
        .select("*")
        .eq("id", referenceId)
        .single();
      if (refAnalysis) {
        deepPerceptionContext = buildDeepPerceptionContext(refAnalysis);
      }
    } else if (body.useVisualProfile) {
      // Auto-select latest reference for the project
      const { data: latestRef } = await supabase
        .from("reference_analyses")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (latestRef) {
        deepPerceptionContext = buildDeepPerceptionContext(latestRef);
      }
    }

    const dnaContext = buildDNAPrompt(project, dna) + deepPerceptionContext;

    // ── 3. Handle "Regerar com Qualidade" ───────────────────────
    let originalAsset: any = null;
    if (regenerateAssetId) {
      const { data: asset } = await supabase
        .from("assets")
        .select("*, asset_versions(*)")
        .eq("id", regenerateAssetId)
        .single();
      originalAsset = asset;
    }

    // ── 4. Pipeline routing ─────────────────────────────────────
    if (pipelineMode === "outline") {
      return await handleOutline(LOVABLE_API_KEY, dnaContext, pieceType, userPrompt, corsHeaders);
    }

    // ── 5. Generate variations ──────────────────────────────────
    const results = [];
    const totalAttempts: Record<string, number> = {};
    const fallbackLog: string[] = [];

    for (let i = 0; i < quantity; i++) {
      const variation = await generateSingleAsset({
        LOVABLE_API_KEY,
        dnaContext,
        output,
        pieceType,
        profile,
        provider,
        ratio,
        destination,
        intensity,
        userPrompt,
        originalAsset,
        variationIndex: i,
        totalAttempts,
        fallbackLog,
      });

      // ── 6. Save to DB with DNA snapshot ─────────────────────
      const { data: savedAsset } = await supabase
        .from("assets")
        .insert({
          project_id: projectId,
          user_id: user.id,
          title: variation.headline,
          output,
          status: "draft",
          folder: "Exploração",                    // Always born in Exploração
          profile_used: profile,
          provider_selected: provider === "Auto" ? null : provider,
          provider_used: variation.providerUsed,
          destination,
          preset: ratio,
          attempts: variation.attempts,
          dna_version_id: dnaVersionId,            // Snapshot: which DNA generated this
        })
        .select()
        .single();

      if (savedAsset) {
        await supabase.from("asset_versions").insert({
          asset_id: savedAsset.id,
          version: 1,
          headline: variation.headline,
          body: variation.body,
          cta: variation.cta,
          image_url: variation.imageUrl,
          generation_metadata: {
            model_text: variation.textModel,
            model_image: variation.imageModel,
            profile,
            piece_type: pieceType,
            prompt_used: variation.promptUsed,
            dna_version_id: dnaVersionId,
            fallback_log: variation.fallbackEvents,
          },
        });

        // ── 7. Log credits ────────────────────────────────────
        const creditCost = (CREDIT_COSTS[variation.textModel] || 0) + (CREDIT_COSTS[variation.imageModel] || 0);
        if (creditCost > 0) {
          await supabase.from("cos_credits_log").insert({
            user_id: user.id,
            project_id: projectId,
            amount: -creditCost,
            description: `Geração: ${pieceType} (${profile}) via ${variation.providerUsed}`,
            related_entity_id: savedAsset.id,
            related_entity_type: "asset",
          });
        }

        results.push({
          id: savedAsset.id,
          headline: variation.headline,
          body: variation.body,
          cta: variation.cta,
          imageUrl: variation.imageUrl,
          provider: variation.providerUsed,
          profile,
          status: "draft",
          creditCost,
          dnaVersionId,
          fallbackEvents: variation.fallbackEvents,
        });
      }
    }

    // Log fallback events to activity_log if any occurred
    if (fallbackLog.length > 0) {
      await supabase.from("activity_log").insert({
        project_id: projectId,
        user_id: user.id,
        action: `Fallback de provedor: ${fallbackLog.join("; ")}`,
        entity_type: "generation",
        metadata: { fallback_log: fallbackLog },
      });
    }

    return new Response(JSON.stringify({ results, fallbackLog }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cos-generate error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("429") || msg.includes("rate limit")) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (msg.includes("402") || msg.includes("payment")) {
      return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── DNA Prompt Builder (structured JSON context) ────────────────
function buildDNAPrompt(project: any, dna: any): string {
  if (!project) return "Projeto sem dados de contexto.";

  const parts = [
    `# Projeto: ${project.name}`,
    project.niche ? `Nicho: ${project.niche}` : null,
    project.product ? `Produto: ${project.product}` : null,
    project.description ? `Descrição: ${project.description}` : null,
  ];

  if (dna) {
    const identity = dna.identity as any;
    const audience = dna.audience as any;
    const strategy = dna.strategy as any;
    const visual = dna.visual as any;

    if (identity) {
      parts.push(`\n## Identidade`);
      if (identity.slogan) parts.push(`Slogan: ${identity.slogan}`);
      if (identity.tom) parts.push(`Tom de voz: ${identity.tom}`);
      if (identity.personalidade) parts.push(`Personalidade: ${identity.personalidade}`);
    }
    if (audience) {
      parts.push(`\n## Audiência`);
      if (audience.publico_alvo) parts.push(`Público-alvo: ${audience.publico_alvo}`);
      if (audience.dor_principal) parts.push(`Dor principal: ${audience.dor_principal}`);
      if (audience.desejo_principal) parts.push(`Desejo principal: ${audience.desejo_principal}`);
      if (audience.perfil) parts.push(`Perfil: ${audience.perfil}`);
    }
    if (strategy) {
      parts.push(`\n## Estratégia`);
      if (strategy.promessa) parts.push(`Promessa (Big Idea): ${strategy.promessa}`);
      if (strategy.diferencial) parts.push(`Diferencial: ${strategy.diferencial}`);
      if (strategy.mecanismo) parts.push(`Mecanismo: ${strategy.mecanismo}`);
    }
    if (visual) {
      parts.push(`\n## Estilo Visual`);
      if (visual.estilo) parts.push(`Estilo: ${visual.estilo}`);
      if (visual.cores) parts.push(`Cores: ${visual.cores}`);
      if (visual.referencia) parts.push(`Referência: ${visual.referencia}`);
    }
  }

  return parts.filter(Boolean).join("\n");
}

// ── Deep Perception Context Builder ─────────────────────────────
function buildDeepPerceptionContext(ref: any): string {
  const raw = ref.raw_analysis || {};
  const parts = [
    `\n\n## 🔮 DEEP PERCEPTION (Referência Ativa)`,
    `Arquétipo Visual: ${ref.visual_archetype}`,
    `Tom Emocional: ${ref.emotional_tone}`,
    `Sofisticação: ${ref.sophistication_level}/10`,
    `Composição: ${ref.composition_intent}`,
    ref.focus_narrative ? `Foco Narrativo: ${ref.focus_narrative}` : null,
    ref.human_context ? `Contexto Humano: ${ref.human_context}` : null,
    ref.strategic_why ? `Estratégia: ${ref.strategic_why}` : null,
  ];

  // Add visual DNA details from raw analysis
  if (raw.palette?.length) parts.push(`Paleta: ${raw.palette.join(", ")}`);
  if (raw.lighting_type) parts.push(`Iluminação: ${raw.lighting_type}`);
  if (raw.grain_level) parts.push(`Grão/Textura: ${raw.grain_level}`);
  if (raw.color_temperature) parts.push(`Temperatura: ${raw.color_temperature}`);

  if (ref.typography_style && typeof ref.typography_style === "object") {
    const ts = ref.typography_style;
    parts.push(`Tipografia: peso=${ts.weight || "?"}, tracking=${ts.tracking || "?"}, vibe=${ts.vibe || "?"}`);
  }

  if (ref.generated_prompt) {
    parts.push(`\nINSTRUÇÃO DA REFERÊNCIA: ${ref.generated_prompt}`);
  }

  parts.push(`\nIMPORTANTE: Mantenha o SENTIMENTO, a COMPOSIÇÃO e a ESTRATÉGIA da referência. Adapte ao nicho e DNA do projeto.`);

  return parts.filter(Boolean).join("\n");
}

// ── Single Asset Generator with Fallback Logging ────────────────
async function generateSingleAsset(opts: {
  LOVABLE_API_KEY: string;
  dnaContext: string;
  output: string;
  pieceType: string;
  profile: string;
  provider: string;
  ratio: string;
  destination: string;
  intensity: string;
  userPrompt?: string;
  originalAsset?: any;
  variationIndex: number;
  totalAttempts: Record<string, number>;
  fallbackLog: string[];
}) {
  const {
    LOVABLE_API_KEY, dnaContext, output, pieceType, profile,
    provider, ratio, destination, intensity, userPrompt,
    originalAsset, variationIndex, totalAttempts, fallbackLog,
  } = opts;

  let headline = "";
  let body = "";
  let cta = "";
  let imageUrl: string | null = null;
  let textModel = "";
  let imageModel = "";
  let providerUsed = "";
  let attempts = 0;
  let promptUsed = "";
  const fallbackEvents: string[] = [];

  const pieceInstruction = PIECE_PROMPTS[pieceType] || PIECE_PROMPTS.post;
  const variationNote = variationIndex > 0
    ? `\nEsta é a variação #${variationIndex + 1}. Seja criativo e diferente das anteriores.`
    : "";

  const regenerateNote = originalAsset
    ? `\nVocê está REFINANDO este ativo existente. Headline original: "${originalAsset.asset_versions?.[0]?.headline}". Body original: "${originalAsset.asset_versions?.[0]?.body}". Melhore a qualidade, contraste e profissionalismo.`
    : "";

  // Quality finishing instructions injected only for quality profile
  const qualityFinishing = profile === "quality" ? QUALITY_FINISHING_TEXT : "";

  const intensityMap: Record<string, string> = {
    Suave: "Use linguagem suave e acolhedora.",
    Equilibrado: "Equilibre persuasão e naturalidade.",
    Agressivo: "Use linguagem direta, urgente e persuasiva.",
  };

  // ── TEXT GENERATION ───────────────────────────────────────────
  if (output === "text" || output === "both") {
    const models = provider !== "Auto"
      ? [provider]
      : TEXT_MODELS[profile] || TEXT_MODELS.standard;

    let usedFallback = false;
    for (const model of models) {
      attempts++;
      totalAttempts[model] = (totalAttempts[model] || 0) + 1;

      const systemPrompt = `Você é um copywriter profissional especialista em marketing digital brasileiro.
${dnaContext}

REGRAS:
- ${pieceInstruction}
- Destino: ${destination}
- ${intensityMap[intensity] || intensityMap.Equilibrado}
${qualityFinishing}
${regenerateNote}
${variationNote}

FORMATO DE RESPOSTA (JSON):
{"headline": "...", "body": "...", "cta": "..."}

Retorne APENAS o JSON, sem markdown ou explicações.`;

      promptUsed = systemPrompt;

      try {
        const resp = await fetch(AI_GATEWAY, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt || `Gere um ${pieceType} criativo para ${destination}.` },
            ],
          }),
        });

        if (!resp.ok) {
          if (resp.status === 429 || resp.status === 402) throw new Error(`${resp.status}`);
          const event = `Texto: ${model} falhou (HTTP ${resp.status}), tentando fallback`;
          console.error(event);
          fallbackEvents.push(event);
          fallbackLog.push(event);
          usedFallback = true;
          continue;
        }

        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content || "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          headline = parsed.headline || "";
          body = parsed.body || "";
          cta = parsed.cta || "";
        } else {
          headline = raw.slice(0, 80);
          body = raw;
        }

        textModel = model;
        providerUsed = model;
        if (usedFallback) {
          const event = `Texto: rebaixado para ${model} por erro no provedor primário`;
          fallbackEvents.push(event);
          fallbackLog.push(event);
        }
        break;
      } catch (e: any) {
        if (e.message === "429" || e.message === "402") throw e;
        const event = `Texto: ${model} erro: ${e.message}`;
        console.error(event);
        fallbackEvents.push(event);
        fallbackLog.push(event);
        usedFallback = true;
        continue;
      }
    }

    if (!headline && !body) {
      headline = "Erro na geração";
      body = "Não foi possível gerar o conteúdo. Tente novamente.";
      textModel = "none";
    }
  }

  // ── IMAGE GENERATION ──────────────────────────────────────────
  if (output === "image" || output === "both") {
    // Always use dedicated image models — text-only models can't generate images
    const IMAGE_CAPABLE = new Set(Object.values(IMAGE_MODELS).flat());
    const models = (provider !== "Auto" && IMAGE_CAPABLE.has(provider))
      ? [provider]
      : IMAGE_MODELS[profile] || IMAGE_MODELS.standard;

    const qualityImageFinishing = profile === "quality" ? QUALITY_FINISHING_IMAGE : "";

    let usedFallback = false;
    for (const model of models) {
      attempts++;

      const imagePrompt = `Create a professional marketing image for a ${pieceType}.

${dnaContext}

Visual direction: Use the project's niche, brand colors, and visual style described above as the PRIMARY creative guide for this image.
Aspect ratio: ${ratio}.
Subject/Context: ${headline || userPrompt || pieceType}.
${intensity === "Agressivo" ? "Bold colors, strong contrast, high energy." : intensity === "Suave" ? "Soft, warm tones, elegant and calm." : "Balanced, professional look."}
${qualityImageFinishing}
IMPORTANT: The image MUST reflect the project's niche and visual identity described above. Do NOT create generic marketing images.`;

      try {
        const resp = await fetch(AI_GATEWAY, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!resp.ok) {
          if (resp.status === 429 || resp.status === 402) throw new Error(`${resp.status}`);
          const event = `Imagem: ${model} falhou (HTTP ${resp.status}), tentando fallback`;
          console.error(event);
          fallbackEvents.push(event);
          fallbackLog.push(event);
          usedFallback = true;
          continue;
        }

        const data = await resp.json();
        const images = data.choices?.[0]?.message?.images;
        if (images?.[0]?.image_url?.url) {
          imageUrl = images[0].image_url.url;
          imageModel = model;
          if (!providerUsed) providerUsed = model;
          else providerUsed += ` + ${model}`;
          if (usedFallback) {
            const event = `Imagem: rebaixado para ${model} por erro no provedor primário`;
            fallbackEvents.push(event);
            fallbackLog.push(event);
          }
          break;
        }
      } catch (e: any) {
        if (e.message === "429" || e.message === "402") throw e;
        const event = `Imagem: ${model} erro: ${e.message}`;
        console.error(event);
        fallbackEvents.push(event);
        fallbackLog.push(event);
        usedFallback = true;
        continue;
      }
    }

    if (!imageModel) imageModel = "none";
  }

  return {
    headline, body, cta, imageUrl,
    textModel, imageModel, providerUsed: providerUsed || "none",
    attempts, promptUsed, fallbackEvents,
  };
}

// ── Pipeline: Outline ──────────────────────────────────────────
async function handleOutline(
  apiKey: string, dnaContext: string, pieceType: string,
  userPrompt: string | undefined, cors: Record<string, string>,
) {
  const resp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `Você é um arquiteto de conteúdo. ${dnaContext}

Gere um outline (estrutura de seções) para um ${pieceType} composto.
Retorne APENAS um JSON: {"sections": [{"id": "hero", "name": "Hero", "description": "Seção principal..."}, ...]}`,
        },
        { role: "user", content: userPrompt || `Crie o outline para um ${pieceType} completo.` },
      ],
    }),
  });

  if (!resp.ok) {
    return new Response(JSON.stringify({ error: `Outline failed: ${resp.status}` }), {
      status: resp.status, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const outline = jsonMatch ? JSON.parse(jsonMatch[0]) : { sections: [] };

  return new Response(JSON.stringify(outline), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
