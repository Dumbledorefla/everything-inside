import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Provider mapping by profile ─────────────────────────────────
const TEXT_MODELS: Record<string, string[]> = {
  economy: ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"],
  standard: ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"],
  quality: ["google/gemini-2.5-pro", "google/gemini-3-flash-preview"],
};

const IMAGE_MODELS: Record<string, string[]> = {
  economy: ["google/gemini-2.5-flash-image"],
  standard: ["google/gemini-2.5-flash-image", "google/gemini-3-pro-image-preview"],
  quality: ["google/gemini-3-pro-image-preview", "google/gemini-2.5-flash-image"],
};

// ── Credit costs per model (simplified) ─────────────────────────
const CREDIT_COSTS: Record<string, number> = {
  "google/gemini-2.5-flash-lite": 1,
  "google/gemini-2.5-flash": 2,
  "google/gemini-3-flash-preview": 3,
  "google/gemini-2.5-pro": 8,
  "google/gemini-2.5-flash-image": 3,
  "google/gemini-3-pro-image-preview": 10,
};

// ── Piece type prompt templates ─────────────────────────────────
const PIECE_PROMPTS: Record<string, string> = {
  post: "Crie um post para redes sociais com headline impactante, body persuasivo e CTA direto.",
  banner: "Crie um banner publicitário com headline curta e impactante, subtítulo de apoio e CTA.",
  story: "Crie um story para Instagram com texto curto, direto e envolvente, adequado para formato vertical.",
  ad: "Crie um anúncio pago com headline que gera curiosidade, body que aborda dor/desejo e CTA urgente.",
  thumbnail: "Crie um texto para thumbnail de vídeo: título curto e chamativo que gere clique.",
  vsl: "Crie um roteiro de VSL (Video Sales Letter) com gancho, problema, solução, prova e CTA.",
};

interface GenerateRequest {
  projectId: string;
  mode: "rapido" | "orientado" | "sprint";
  output: "text" | "image" | "both";
  pieceType: string;
  quantity: number;
  profile: "economy" | "standard" | "quality";
  provider: string; // "Auto" or specific model
  destination: string;
  ratio: string;
  intensity: string;
  useModel: boolean;
  useVisualProfile: boolean;
  userPrompt?: string;
  // For "Regerar com Qualidade"
  regenerateAssetId?: string;
  // For pipeline composto
  pipelineMode?: "simple" | "outline" | "variants" | "assembly";
  outlineSections?: string[];
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

    // Auth: extract user from JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for writes
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: GenerateRequest = await req.json();
    const {
      projectId, mode, output, pieceType, quantity, profile,
      provider, destination, ratio, intensity, userPrompt,
      regenerateAssetId, pipelineMode = "simple",
    } = body;

    // ── 1. Fetch Project DNA ────────────────────────────────────
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

    // ── 2. Build DNA System Prompt ──────────────────────────────
    const dnaContext = buildDNAPrompt(project, dna);

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
      });

      // ── 6. Save to DB ───────────────────────────────────────
      const { data: savedAsset } = await supabase
        .from("assets")
        .insert({
          project_id: projectId,
          user_id: user.id,
          title: variation.headline,
          output,
          status: "draft",
          profile_used: profile,
          provider_selected: provider === "Auto" ? null : provider,
          provider_used: variation.providerUsed,
          destination,
          preset: ratio,
          attempts: variation.attempts,
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
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cos-generate error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";

    // Surface rate limit / payment errors
    if (msg.includes("429") || msg.includes("rate limit")) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (msg.includes("402") || msg.includes("payment")) {
      return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione fundos para continuar gerando." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── DNA Prompt Builder ──────────────────────────────────────────
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

    if (identity) {
      parts.push(`\n## Identidade`);
      if (identity.slogan) parts.push(`Slogan: ${identity.slogan}`);
      if (identity.tom) parts.push(`Tom de voz: ${identity.tom}`);
      if (identity.personalidade) parts.push(`Personalidade: ${identity.personalidade}`);
    }
    if (audience) {
      parts.push(`\n## Audiência`);
      if (audience.dor_principal) parts.push(`Dor principal: ${audience.dor_principal}`);
      if (audience.desejo_principal) parts.push(`Desejo principal: ${audience.desejo_principal}`);
      if (audience.perfil) parts.push(`Perfil: ${audience.perfil}`);
    }
    if (strategy) {
      parts.push(`\n## Estratégia`);
      if (strategy.promessa) parts.push(`Promessa: ${strategy.promessa}`);
      if (strategy.diferencial) parts.push(`Diferencial: ${strategy.diferencial}`);
      if (strategy.mecanismo) parts.push(`Mecanismo: ${strategy.mecanismo}`);
    }
  }

  return parts.filter(Boolean).join("\n");
}

// ── Single Asset Generator ──────────────────────────────────────
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
}) {
  const {
    LOVABLE_API_KEY, dnaContext, output, pieceType, profile,
    provider, ratio, destination, intensity, userPrompt,
    originalAsset, variationIndex, totalAttempts,
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

  const pieceInstruction = PIECE_PROMPTS[pieceType] || PIECE_PROMPTS.post;
  const variationNote = variationIndex > 0
    ? `\nEsta é a variação #${variationIndex + 1}. Seja criativo e diferente das anteriores.`
    : "";

  const regenerateNote = originalAsset
    ? `\nVocê está REFINANDO este ativo existente. Headline original: "${originalAsset.asset_versions?.[0]?.headline}". Body original: "${originalAsset.asset_versions?.[0]?.body}". Melhore a qualidade, contraste e profissionalismo.`
    : "";

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

    for (const model of models) {
      attempts++;
      totalAttempts[model] = (totalAttempts[model] || 0) + 1;

      const systemPrompt = `Você é um copywriter profissional especialista em marketing digital brasileiro.
${dnaContext}

REGRAS:
- ${pieceInstruction}
- Destino: ${destination}
- ${intensityMap[intensity] || intensityMap.Equilibrado}
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
          console.error(`Model ${model} failed with ${resp.status}, trying fallback...`);
          continue;
        }

        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content || "";

        // Parse JSON from response
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
        break; // success, stop fallback
      } catch (e: any) {
        if (e.message === "429" || e.message === "402") throw e;
        console.error(`Text gen error with ${model}:`, e.message);
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
    const models = provider !== "Auto"
      ? [provider]
      : IMAGE_MODELS[profile] || IMAGE_MODELS.standard;

    for (const model of models) {
      attempts++;

      const imagePrompt = `Create a professional marketing image for a ${pieceType}.
Style: modern, clean, high-contrast.
Aspect ratio: ${ratio}.
Context: ${headline || userPrompt || "marketing digital brasileiro"}.
${intensity === "Agressivo" ? "Bold colors, strong contrast." : intensity === "Suave" ? "Soft, warm tones." : "Balanced, professional look."}`;

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
          console.error(`Image model ${model} failed with ${resp.status}, trying fallback...`);
          continue;
        }

        const data = await resp.json();
        const images = data.choices?.[0]?.message?.images;
        if (images?.[0]?.image_url?.url) {
          imageUrl = images[0].image_url.url;
          imageModel = model;
          if (!providerUsed) providerUsed = model;
          else providerUsed += ` + ${model}`;
          break;
        }
      } catch (e: any) {
        if (e.message === "429" || e.message === "402") throw e;
        console.error(`Image gen error with ${model}:`, e.message);
        continue;
      }
    }

    if (!imageModel) imageModel = "none";
  }

  return {
    headline, body, cta, imageUrl,
    textModel, imageModel, providerUsed: providerUsed || "none",
    attempts, promptUsed,
  };
}

// ── Pipeline: Outline (step 1 of composite) ────────────────────
async function handleOutline(
  apiKey: string,
  dnaContext: string,
  pieceType: string,
  userPrompt: string | undefined,
  cors: Record<string, string>,
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
    const status = resp.status;
    return new Response(JSON.stringify({ error: `Outline failed: ${status}` }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
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
