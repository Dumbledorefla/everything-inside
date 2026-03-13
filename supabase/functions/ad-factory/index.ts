import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAIGuard, guardErrorResponse } from "../_shared/guard-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface AdFactoryRequest {
  projectId: string;
  mode: "angles" | "generate";
  campaignGoal?: string;
  targetAudience?: string;
  offer?: string;
  selectedAngle?: {
    title: string;
    hook: string;
    copy: string;
    visualDirection: string;
  };
  platforms?: string[];
  quantity?: number;
  profile?: "economy" | "standard" | "quality";
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
    if (identity?.tom) parts.push(`Tom de voz: ${identity.tom}`);
    if (audience?.publico_alvo) parts.push(`Público-alvo: ${audience.publico_alvo}`);
    if (audience?.dor_principal) parts.push(`Dor principal: ${audience.dor_principal}`);
    if (audience?.desejo_principal) parts.push(`Desejo principal: ${audience.desejo_principal}`);
    if (strategy?.promessa) parts.push(`Promessa: ${strategy.promessa}`);
    if (strategy?.diferencial) parts.push(`Diferencial: ${strategy.diferencial}`);
  }
  return parts.filter(Boolean).join("\n");
}

const TEXT_MODELS: Record<string, string> = {
  economy: "google/gemini-2.5-flash-lite",
  standard: "google/gemini-3-flash-preview",
  quality: "google/gemini-2.5-pro",
};

const IMAGE_MODELS: Record<string, string[]> = {
  economy: ["google/gemini-2.5-flash-image"],
  standard: ["google/gemini-2.5-flash-image", "google/gemini-3-pro-image-preview"],
  quality: ["google/gemini-3-pro-image-preview", "google/gemini-2.5-flash-image"],
};

const PLATFORM_FORMATS: Record<string, { ratio: string; label: string; safeZone: string }[]> = {
  "Facebook/Instagram Feed": [
    { ratio: "1:1", label: "Feed Quadrado", safeZone: "Texto máximo 20% da área. CTA no terço inferior." },
    { ratio: "4:5", label: "Feed Vertical", safeZone: "Produto no centro. Headline no terço superior. CTA no terço inferior." },
  ],
  "Instagram Stories / Reels": [
    { ratio: "9:16", label: "Stories/Reels", safeZone: "Zona morta: 250px superiores e 200px inferiores. Conteúdo vital no centro." },
  ],
  "Google Display": [
    { ratio: "16:9", label: "Banner Horizontal", safeZone: "Composição lateral. Produto em 1 dos terços. 60% de respiro para texto." },
    { ratio: "1:1", label: "Banner Quadrado", safeZone: "Produto centralizado. Headline acima. CTA abaixo." },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: AdFactoryRequest = await req.json();
    const { projectId, mode } = body;

    const [{ data: project }, { data: dna }] = await Promise.all([
      supabase.from("projects").select("name, niche, product").eq("id", projectId).single(),
      supabase.from("project_dna").select("*").eq("project_id", projectId).order("version", { ascending: false }).limit(1).single(),
    ]);
    const dnaContext = buildDNAPrompt(project, dna);

    // ── MODE: ANGLES ──
    if (mode === "angles") {
      const { campaignGoal, targetAudience, offer } = body;
      const textModel = TEXT_MODELS[body.profile || "standard"];

      const prompt = `Você é um Estrategista de Anúncios Pagos de elite, especialista em Facebook Ads, Instagram Ads e Google Ads. Sua missão é gerar 5 ângulos de campanha distintos e altamente persuasivos.

**DNA DO PROJETO:**
${dnaContext}

**BRIEFING DA CAMPANHA:**
- Objetivo: ${campaignGoal || "Conversão / Venda Direta"}
- Público-Alvo Específico: ${targetAudience || "Definido pelo DNA do projeto"}
- Oferta: ${offer || "Produto/Serviço principal do projeto"}

**INSTRUÇÕES:**
Gere 5 ângulos de campanha distintos. Cada ângulo deve explorar uma abordagem psicológica diferente:
1. Dor/Problema (foco na dor que o produto resolve)
2. Desejo/Transformação (foco no resultado que o produto entrega)
3. Curiosidade/Mistério (gancho que gera clique por curiosidade)
4. Prova Social/Autoridade (foco em credibilidade e resultados de outros)
5. Urgência/Escassez (foco em agir agora)

Para cada ângulo, forneça:
- "title": Nome curto do ângulo
- "approach": A abordagem psicológica em 1 frase
- "hook": O gancho principal (headline do anúncio, máximo 10 palavras, IMPACTANTE)
- "copy": O texto do anúncio (2-3 parágrafos curtos: problema → solução → CTA)
- "visualDirection": Descrição detalhada da cena visual ideal para este ângulo`;

      const resp = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: textModel,
          messages: [{ role: "user", content: prompt }],
          tools: [{
            type: "function",
            function: {
              name: "return_angles",
              description: "Return 5 campaign angles",
              parameters: {
                type: "object",
                properties: {
                  angles: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        approach: { type: "string" },
                        hook: { type: "string" },
                        copy: { type: "string" },
                        visualDirection: { type: "string" },
                      },
                      required: ["title", "approach", "hook", "copy", "visualDirection"],
                    },
                  },
                },
                required: ["angles"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_angles" } },
        }),
      });

      if (!resp.ok) {
        const status = resp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }
      const data = await resp.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      const angles = JSON.parse(toolCall.function.arguments);

      return new Response(JSON.stringify(angles), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MODE: GENERATE ──
    if (mode === "generate") {
      const { selectedAngle, platforms = ["Facebook/Instagram Feed"], quantity = 1, profile = "standard" } = body;
      if (!selectedAngle) throw new Error("selectedAngle is required for generate mode");

      const authHeader = req.headers.get("Authorization") ?? "";
      const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();

      const results: any[] = [];
      const imageModelList = IMAGE_MODELS[profile];

      for (const platform of platforms) {
        const formats = PLATFORM_FORMATS[platform] || PLATFORM_FORMATS["Facebook/Instagram Feed"];
        for (const format of formats) {
          for (let i = 0; i < quantity; i++) {
            const imagePrompt = `Você é um Diretor de Arte especialista em anúncios pagos de alta conversão. Crie um anúncio visual completo para ${platform} no formato ${format.label}.

**DNA DO PROJETO:**
${dnaContext}

**ÂNGULO DA CAMPANHA:**
- Título: ${selectedAngle.title}
- Hook: "${selectedAngle.hook}"
- Direção Visual: ${selectedAngle.visualDirection}

**TEXTO A SER INTEGRADO NA IMAGEM:**
- Headline Principal: "${selectedAngle.hook}"
- CTA: "Saiba Mais" ou equivalente ao nicho

**REGRAS DE COMPOSIÇÃO (CRÍTICO):**
1. HIERARQUIA: Headline → Benefício Visual → CTA.
2. ZONA DE SEGURANÇA: ${format.safeZone}
3. TEXTO INTEGRADO: Tipografia profissional. Soletração perfeita. Integração orgânica.
4. CONFORMIDADE COM ADS: Máximo 20% da área com texto.
5. QUALIDADE: Fotografia de estúdio, iluminação cinematográfica, ultra-realista.

Aspect Ratio: ${format.ratio}
Plataforma: ${platform}

Gere o anúncio final como uma peça única, coesa, pronta para veicular.`;

            let imageUrl: string | null = null;
            let modelUsed = "";

            for (const model of imageModelList) {
              try {
                const imgResp = await fetch(AI_GATEWAY, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model,
                    messages: [{ role: "user", content: imagePrompt }],
                    modalities: ["image", "text"],
                  }),
                });

                if (!imgResp.ok) continue;
                const imgData = await imgResp.json();
                const imageEntry = imgData.choices?.[0]?.message?.images?.[0];

                if (imageEntry?.image_url?.url) {
                  imageUrl = imageEntry.image_url.url;
                  modelUsed = model;
                  break;
                }

                const parts = imgData.choices?.[0]?.message?.content;
                if (Array.isArray(parts)) {
                  for (const part of parts) {
                    if (part.inline_data?.data) {
                      imageUrl = `data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`;
                      modelUsed = model;
                      break;
                    }
                  }
                }
                if (imageUrl) break;
              } catch {
                continue;
              }
            }

            if (imageUrl && user) {
              const { data: savedAsset } = await supabase.from("assets").insert({
                project_id: projectId,
                user_id: user.id,
                title: selectedAngle.hook,
                output: "image",
                status: "draft",
                folder: "Ad Factory",
                profile_used: profile,
                provider_used: modelUsed,
                destination: platform,
                preset: format.ratio,
                operation_mode: "performance",
                format_label: `${format.label} — ${selectedAngle.title}`,
              }).select().single();

              if (savedAsset) {
                await supabase.from("asset_versions").insert({
                  asset_id: savedAsset.id,
                  version: 1,
                  headline: selectedAngle.hook,
                  body: selectedAngle.copy,
                  image_url: imageUrl,
                });

                results.push({
                  id: savedAsset.id,
                  platform,
                  format: format.label,
                  ratio: format.ratio,
                  imageUrl,
                  headline: selectedAngle.hook,
                  angle: selectedAngle.title,
                });
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Invalid mode: ${mode}`);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
