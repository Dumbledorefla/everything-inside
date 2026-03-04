import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractImageUrlFromResponse } from "../_shared/ai-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FAL_API_BASE = "https://fal.run";
const TOGETHER_API_BASE = "https://api.together.xyz/v1/images/generations";

// ── Provider mapping by profile (Nano Banana equivalents) ───────
const TEXT_MODELS: Record<string, string[]> = {
  economy: ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"],
  standard: ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"],
  quality: ["google/gemini-2.5-pro", "google/gemini-3-flash-preview"],
};

const IMAGE_MODELS: Record<string, string[]> = {
  economy: ["fal-ai/flux/schnell", "google/gemini-2.5-flash-image"],
  standard: ["fal-ai/flux/dev", "google/gemini-2.5-flash-image", "google/gemini-3-pro-image-preview"],
  quality: ["fal-ai/flux-pro/v1.1", "fal-ai/ideogram/v2", "google/gemini-3-pro-image-preview"],
  text_focused: ["fal-ai/ideogram/v2", "google/gemini-3-pro-image-preview"],
  unrestricted: ["together/black-forest-labs/FLUX.1-schnell", "together/black-forest-labs/FLUX.1-krea-dev", "fal-ai/flux/dev"],
};

// fal.ai model ID mapping (for display → API endpoint)
const FAL_MODELS = new Set([
  "fal-ai/flux/schnell", "fal-ai/flux/dev", "fal-ai/flux-pro/v1.1", "fal-ai/ideogram/v2",
]);

// together.ai model ID mapping (prefix: together/)
// IDs reais: remover prefixo "together/" antes de chamar a API
const TOGETHER_MODELS = new Set([
  "together/black-forest-labs/FLUX.1-schnell",
  "together/black-forest-labs/FLUX.1-krea-dev",
]);

const CREDIT_COSTS: Record<string, number> = {
  "google/gemini-2.5-flash-lite": 1,
  "google/gemini-2.5-flash": 2,
  "google/gemini-3-flash-preview": 3,
  "google/gemini-2.5-pro": 8,
  "google/gemini-2.5-flash-image": 3,
  "google/gemini-3-pro-image-preview": 10,
  "fal-ai/flux/schnell": 2,
  "fal-ai/flux/dev": 4,
  "fal-ai/flux-pro/v1.1": 12,
  "fal-ai/ideogram/v2": 8,
  "together/black-forest-labs/FLUX.1-schnell": 3,
  "together/black-forest-labs/FLUX.1-krea-dev": 4,
};

const PIECE_PROMPTS: Record<string, string> = {
  post: "O objetivo é engajar o público nas redes sociais com conteúdo relevante e uma chamada para ação clara.",
  banner: "O objetivo é criar um banner publicitário para atrair cliques com uma mensagem curta e impactante.",
  story: "O objetivo é criar um story para Instagram que seja rápido, envolvente e otimizado para o formato vertical.",
  ad: "O objetivo é criar um anúncio pago focado em conversão, despertando curiosidade e urgência.",
  thumbnail: "O objetivo é criar um texto para a capa de um vídeo que maximize a taxa de cliques.",
  vsl: "O objetivo é criar um roteiro para um vídeo de vendas que convença o espectador a tomar uma ação.",
  logo: "O objetivo é criar um conceito de logo que seja memorável e represente a marca.",
  palette: "O objetivo é definir uma paleta de cores que transmita a personalidade da marca.",
  typography: "O objetivo é sugerir uma combinação de fontes que seja legível e alinhada à identidade visual.",
  brand_manual: "O objetivo é criar um guia de estilo para garantir a consistência da marca.",
  highlight: "O objetivo é criar uma capa de destaque para o Instagram que seja icônica e informativa.",
  hero_banner: "O objetivo é criar a imagem principal para o topo de um site.",
  ecommerce_banner: "O objetivo é criar um banner para uma loja virtual, destacando um produto ou promoção.",
  lp_section: "O objetivo é criar uma imagem de suporte para uma seção de uma página de vendas.",
};

// ── Mode-specific system prompts ────────────────────────────────
const MODE_PROMPTS: Record<string, string> = {
  foundation: `MODO: FUNDAÇÃO — Priorize minimalismo, escalabilidade e formas puras. Ignore fundos complexos, foque na MARCA. Cores sólidas, reproduzíveis. Tipografia legível de 32px a outdoor.`,
  social: `MODO: SOCIAL — Priorize estética nativa de redes, tendências visuais, composição para retenção e ganchos visuais. Cores vibrantes, alto contraste, otimizado para mobile.`,
  performance: `MODO: PERFORMANCE — Priorize hierarquia de leitura (headline → benefício → CTA), clareza total do produto, alto contraste, conformidade com zonas mortas de ads. Copy: dor → solução → prova → ação.`,
};

const SAFE_ZONE_RULES: Record<string, Record<string, string>> = {
  social: {
    "9:16": "ZONA DE SEGURANÇA: Manter elementos cruciais no centro. 250px superiores (perfil) e 250px inferiores (barra de resposta) livres de informações vitais.",
    "1:1": "ZONA DE SEGURANÇA: Feed — margem de 5% para safe area do Instagram.",
  },
  performance: {
    "16:9": "ZONA DE SEGURANÇA: Hero Banner — composição lateral. Objeto principal em 1 dos terços. 60% com respiro para sobreposição de texto.",
    "1:1": "ZONA DE SEGURANÇA: Ads — centralização absoluta ou diagonal para CTA. Texto máximo 20% da área.",
    "9:16": "ZONA DE SEGURANÇA: Ads Stories — conteúdo vital na zona central. 200px inferiores livres para swipe-up.",
  },
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
  profile: "economy" | "standard" | "quality" | "unrestricted";
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
  referenceId?: string;
  operationMode?: string; // foundation | social | performance
  formatLabel?: string;   // human-readable format tag
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
      operationMode, formatLabel,
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

    // Inject operation mode context
    const modeContext = operationMode && MODE_PROMPTS[operationMode] ? `\n\n${MODE_PROMPTS[operationMode]}` : "";
    const safeZoneContext = operationMode && SAFE_ZONE_RULES[operationMode]?.[ratio] ? `\n${SAFE_ZONE_RULES[operationMode][ratio]}` : "";
    const dnaContext = buildDNAPrompt(project, dna) + deepPerceptionContext + modeContext + safeZoneContext;

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
      const TOGETHER_API_KEY = Deno.env.get("TOGETHER_API_KEY");
      const variation = await generateSingleAsset({
        LOVABLE_API_KEY,
        TOGETHER_API_KEY,
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
          folder: "Exploração",
          profile_used: profile,
          provider_selected: provider === "Auto" ? null : provider,
          provider_used: variation.providerUsed,
          destination,
          preset: ratio,
          attempts: variation.attempts,
          dna_version_id: dnaVersionId,
          operation_mode: operationMode || null,
          format_label: formatLabel || pieceType,
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

        // ── 7b. Log to cos_ledger for monitoring ──────────────
        const estimatedUsd = creditCost * 0.01;
        await supabase.from("cos_ledger").insert({
          project_id: projectId,
          user_id: user.id,
          operation_type: output === "image" ? "IMAGE_GEN" : output === "text" ? "TEXT_GEN" : "IMAGE_GEN",
          provider_used: variation.providerUsed || "cos-system",
          credits_cost: creditCost,
          estimated_usd: estimatedUsd,
          asset_id: savedAsset.id,
          metadata: {
            piece_type: pieceType,
            profile,
            ratio,
            mode,
            operation_mode: operationMode || null,
            text_model: variation.textModel,
            image_model: variation.imageModel,
            fallback_events: variation.fallbackEvents,
          },
        }).then(() => {}).catch((err: any) => console.error("cos_ledger insert error:", err));

        // ── 7c. Log to activity_log ───────────────────────────
        await supabase.from("activity_log").insert({
          project_id: projectId,
          user_id: user.id,
          action: `Geração: ${pieceType} (${profile})`,
          entity_type: "asset",
          entity_id: savedAsset.id,
          metadata: { output, provider: variation.providerUsed, credit_cost: creditCost },
        }).then(() => {}).catch((err: any) => console.error("activity_log insert error:", err));

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
  TOGETHER_API_KEY?: string;
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
    LOVABLE_API_KEY, TOGETHER_API_KEY, dnaContext, output, pieceType, profile,
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
- NUNCA use jargões de marketing como 'CTA', 'headline' ou 'body' no texto final. A linguagem deve ser 100% natural para o cliente.
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
    let models = (provider !== "Auto" && IMAGE_CAPABLE.has(provider))
      ? [provider]
      : IMAGE_MODELS[profile] || IMAGE_MODELS.standard;

    // Para perfil unrestricted, não priorizar modelos do Gemini (que têm filtros)
    const isUnrestricted = profile === "unrestricted";

    // Priorizar modelo de alta qualidade quando há texto para integrar (exceto perfil unrestricted)
    const hasTextToIntegrate = !!(headline || userPrompt);
    if (!isUnrestricted && hasTextToIntegrate && !models.includes("google/gemini-3-pro-image-preview")) {
      models = ["google/gemini-3-pro-image-preview", ...models];
    } else if (!isUnrestricted && hasTextToIntegrate && models[0] !== "google/gemini-3-pro-image-preview") {
      models = ["google/gemini-3-pro-image-preview", ...models.filter(m => m !== "google/gemini-3-pro-image-preview")];
    }

    const qualityImageFinishing = profile === "quality" ? QUALITY_FINISHING_IMAGE : "";

    let usedFallback = false;
    for (const model of models) {
      attempts++;

      // Build concise text overlay instructions
      const headlineText = headline || userPrompt || "";
      const bodyText = body || "";
      const ctaText = cta || "";
      

      const imagePrompt = `Você é um Diretor de Arte e Designer Gráfico de elite, especialista em tipografia e composição para marketing digital. Sua missão é criar uma peça de marketing visual completa (imagem + texto) para um ${pieceType}, pronta para ser postada, com o texto perfeitamente integrado à imagem.

**DNA DO PROJETO (Guia Criativo Obrigatório):**
${dnaContext}

**TEXTO A SER INTEGRADO NA IMAGEM (REGRAS DE CONCISÃO):**
-   **Headline**: "${headlineText}" (Renderize esta frase com destaque máximo).
-   **CTA (Opcional e Curto)**: Se houver um CTA, renderize-o de forma discreta e com no máximo 10 palavras: "${ctaText}".
-   **NÃO RENDERIZE O BODY**: O corpo do texto (\`body\`) NÃO deve ser incluído na imagem. Ele serve apenas como contexto para a IA entender o tema.

**INSTRUÇÕES DE COMPOSIÇÃO E RENDERIZAÇÃO (EXTREMAMENTE CRÍTICO):**
1.  **Renderização Direta e Perfeita do Texto**: O texto DEVE ser renderizado diretamente na imagem, com soletração e gramática perfeitas. Ele precisa parecer parte da cena, não um adesivo. A qualidade da tipografia é o critério número 1 de sucesso.
2.  **Respeito ao DNA Visual**: A tipografia (família, peso, estilo) e as cores devem seguir ESTRITAMENTE o que está definido no DNA do projeto. Para o nicho de Tarot, use fontes serifadas e elegantes; para Tech, fontes limpas e modernas. Se o DNA pede por uma cor específica, use-a.
3.  **Integração Orgânica e Realista**: O texto deve respeitar a iluminação, perspectiva, textura e profundidade de campo da cena. Se a imagem tiver uma parede de tijolos, o texto deve se deformar sutilmente sobre ela. Se a luz vier da esquerda, o texto deve projetar uma sombra suave para a direita. O texto deve parecer que foi filmado junto com a cena, não adicionado depois.
4.  **Hierarquia e Legibilidade Profissional**: Organize o texto de forma profissional. A headline deve ter o maior impacto visual, o corpo (se houver) deve ser legível e o CTA deve ser claro, mas secundário. Use o espaço negativo da composição de forma inteligente para garantir a legibilidade.
5.  **Qualidade Fotográfica de Estúdio**: A imagem final deve ter qualidade de estúdio (iluminação cinematográfica, alta definição, resolução 8k), seguindo as diretrizes de qualidade do perfil selecionado.

**REQUERIMENTOS TÉCNICOS:**
- Aspect Ratio: ${ratio}
- Estilo de Intensidade: ${intensity === "Agressivo" ? "Cores ousadas, alto contraste, impacto máximo." : intensity === "Suave" ? "Tons suaves, calmos, elegantes e etéreos." : "Visual equilibrado, profissional e limpo."}
${qualityImageFinishing}

Gere a imagem final como uma peça única, coesa e com a tipografia perfeitamente renderizada. A qualidade da integração do texto é o fator mais importante.`;

      try {
        console.log(`Tentando gerar imagem com modelo: ${model}`);

        let resp: Response;
        const isFalModel = FAL_MODELS.has(model);
        const isTogetherModel = TOGETHER_MODELS.has(model);

        if (isTogetherModel) {
          // ── together.ai API call (sem filtros de conteúdo) ──
          if (!TOGETHER_API_KEY) {
            const event = `Imagem: TOGETHER_API_KEY não configurada, pulando ${model}`;
            console.error(event);
            fallbackEvents.push(event);
            fallbackLog.push(event);
            usedFallback = true;
            continue;
          }
          // Remove o prefixo "together/" para obter o model ID real
          const togetherModelId = model.replace("together/", "");
          const togetherRatio = ratio === "1:1" ? { width: 1024, height: 1024 }
            : ratio === "9:16" ? { width: 768, height: 1344 }
            : { width: 1344, height: 768 };
          resp = await fetch(TOGETHER_API_BASE, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${TOGETHER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: togetherModelId,
              prompt: imagePrompt,
              n: 1,
              steps: togetherModelId.includes("schnell") ? 4 : 28,
              ...togetherRatio,
              disable_safety_checker: true,
            }),
          });
        } else if (isFalModel) {
          // ── fal.ai API call ──
          const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
          if (!FAL_API_KEY) {
            const event = `Imagem: FAL_API_KEY não configurada, pulando ${model}`;
            console.error(event);
            fallbackEvents.push(event);
            fallbackLog.push(event);
            usedFallback = true;
            continue;
          }
          const falEndpoint = `${FAL_API_BASE}/${model}`;
          resp = await fetch(falEndpoint, {
            method: "POST",
            headers: {
              Authorization: `Key ${FAL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: imagePrompt,
              image_size: ratio === "1:1" ? "square_hd" : ratio === "9:16" ? "portrait_16_9" : "landscape_16_9",
              num_images: 1,
              // Desativa o filtro de conteúdo para perfis que necessitam
              enable_safety_checker: !isUnrestricted,
            }),
          });
        } else {
          // ── Lovable AI Gateway call ──
          resp = await fetch(AI_GATEWAY, {
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
        }

        if (!resp.ok) {
          if (resp.status === 429 || resp.status === 402) throw new Error(`${resp.status}`);
          const respText = await resp.text();
          const event = `Imagem: ${model} falhou (HTTP ${resp.status}): ${respText.slice(0, 200)}`;
          console.error(event);
          fallbackEvents.push(event);
          fallbackLog.push(event);
          usedFallback = true;
          continue;
        }

        const data = await resp.json();
        console.log(`Resposta do modelo ${model} - keys:`, Object.keys(data));

        // fal.ai returns { images: [{ url, content_type }] }
        // together.ai returns { data: [{ url }] }
        let extractedUrl: string | null = null;
        if (isFalModel && data.images?.[0]?.url) {
          extractedUrl = data.images[0].url;
        } else if (isTogetherModel && data.data?.[0]?.url) {
          extractedUrl = data.data[0].url;
        } else {
          extractedUrl = extractImageUrlFromResponse(data);
        }

        if (extractedUrl) {
          imageUrl = extractedUrl;
          imageModel = model;
          if (!providerUsed) providerUsed = model;
          else providerUsed += ` + ${model}`;
          console.log(`Imagem gerada com sucesso via ${model}`);
          if (usedFallback) {
            const event = `Imagem: rebaixado para ${model} por erro no provedor primário`;
            fallbackEvents.push(event);
            fallbackLog.push(event);
          }
          break;
        } else {
          const debugInfo = JSON.stringify(data).slice(0, 500);
          const event = `Imagem: ${model} retornou formato inesperado: ${debugInfo}`;
          console.error(event);
          fallbackEvents.push(event);
          fallbackLog.push(event);
          usedFallback = true;
          continue;
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
