import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface CarouselRequest {
  projectId: string;
  referenceId?: string;
  slideCount: number; // 5-7
  topic?: string;
  profile: "economy" | "standard" | "quality";
  ratio: string;
  mode: "storyline" | "generate"; // Step 1: storyline, Step 2: generate
  approvedStoryline?: SlideStoryline[]; // For mode=generate
}

interface SlideStoryline {
  slideNumber: number;
  role: string; // "hook" | "content" | "cta"
  headline: string;
  visualDirection: string;
  copyPlacement: string;
}

const TEXT_MODELS: Record<string, string> = {
  economy: "google/gemini-2.5-flash-lite",
  standard: "google/gemini-3-flash-preview",
  quality: "google/gemini-2.5-pro",
};

const IMAGE_MODELS: Record<string, string> = {
  economy: "google/gemini-2.5-flash-image",
  standard: "google/gemini-2.5-flash-image",
  quality: "google/gemini-3-pro-image-preview",
};

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
    const body: CarouselRequest = await req.json();
    const { projectId, referenceId, slideCount, topic, profile, ratio, mode, approvedStoryline } = body;

    // Fetch project + DNA
    const [{ data: project }, { data: dna }] = await Promise.all([
      supabase.from("projects").select("name, niche, product, description").eq("id", projectId).single(),
      supabase.from("project_dna").select("*").eq("project_id", projectId)
        .order("version", { ascending: false }).limit(1).single(),
    ]);

    // Fetch reference if provided
    let refContext = "";
    if (referenceId) {
      const { data: ref } = await supabase.from("reference_analyses").select("*").eq("id", referenceId).single();
      if (ref) {
        const raw = ref.raw_analysis as any || {};
        refContext = `\n\nREFERÊNCIA VISUAL ATIVA:
Arquétipo: ${ref.visual_archetype}
Tom: ${ref.emotional_tone}
Composição: ${ref.composition_intent}
${raw.palette?.length ? `Paleta: ${raw.palette.join(", ")}` : ""}
${raw.lighting_type ? `Iluminação: ${raw.lighting_type}` : ""}
${ref.generated_prompt ? `Direção Visual: ${ref.generated_prompt}` : ""}`;
      }
    }

    const dnaContext = buildDNAContext(project, dna) + refContext;

    // ── MODE: STORYLINE ─────────────────────────────────────────
    if (mode === "storyline") {
      const resp = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TEXT_MODELS[profile] || TEXT_MODELS.standard,
          messages: [
            {
              role: "system",
              content: `Você é um Roteirista de Carrosséis de Elite para Instagram/Redes Sociais.
${dnaContext}

Crie um roteiro de carrossel com EXATAMENTE ${slideCount} slides seguindo esta estrutura narrativa:

SLIDE 1 (O GANCHO): Visual de alto impacto com headline disruptiva que PARA o scroll.
SLIDES 2 a ${slideCount - 1} (O CONTEÚDO): Desenvolvimento da ideia, cada slide avançando a narrativa.
SLIDE ${slideCount} (O CTA): Chamada para ação clara (Comentar, Comprar, Seguir, Salvar).

REGRAS:
- Cada slide deve ter uma RAZÃO para existir na sequência
- A narrativa deve criar CURIOSIDADE progressiva
- O visual deve manter CONSISTÊNCIA (mesma luz, estilo, cores)
- Indique onde o texto deve ficar para NÃO poluir o design (topo, centro, rodapé, lateral)

Retorne APENAS JSON (sem markdown):
{
  "storyline": [
    {
      "slideNumber": 1,
      "role": "hook",
      "headline": "...",
      "body": "...",
      "visualDirection": "Descrição detalhada da cena visual para este slide",
      "copyPlacement": "topo-esquerdo" 
    }
  ],
  "styleAnchor": "Descrição do estilo visual unificado que deve ser mantido em TODOS os slides (luz, cor, textura, cenário)"
}`,
            },
            { role: "user", content: topic || `Crie um carrossel estratégico para o nicho ${project?.niche || "geral"}.` },
          ],
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (resp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`Storyline generation failed: ${resp.status}`);
      }

      const data = await resp.json();
      const raw = data.choices?.[0]?.message?.content || "";
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const storyline = jsonMatch ? JSON.parse(jsonMatch[0]) : { storyline: [], styleAnchor: "" };

      return new Response(JSON.stringify(storyline), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MODE: GENERATE (after storyline approval) ───────────────
    if (mode === "generate" && approvedStoryline?.length) {
      const results: any[] = [];
      const imageModel = IMAGE_MODELS[profile] || IMAGE_MODELS.standard;

      // The styleAnchor is the visual consistency seed
      const styleAnchor = (body as any).styleAnchor || "Professional, consistent lighting and color grading across all slides.";

      for (const slide of approvedStoryline) {
        // Generate image with visual consistency lock
        const imagePrompt = `Create slide ${slide.slideNumber} of ${approvedStoryline.length} for an Instagram carousel.

VISUAL CONSISTENCY LOCK (MUST MATCH ALL SLIDES):
${styleAnchor}

THIS SLIDE:
Role: ${slide.role === "hook" ? "GANCHO (alto impacto visual)" : slide.role === "cta" ? "CTA (chamada para ação)" : "CONTEÚDO (desenvolvimento)"}
Visual Direction: ${slide.visualDirection}
Headline: ${slide.headline}
Copy Placement Zone: ${slide.copyPlacement} (leave this area clean for text overlay)

${dnaContext}

Aspect ratio: ${ratio || "1:1"}
CRITICAL: Maintain EXACT SAME lighting, color palette, style, and visual mood as all other slides in this carousel. The only thing that changes is the scene/action, NOT the visual identity.`;

        try {
          const imgResp = await fetch(AI_GATEWAY, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: imageModel,
              messages: [{ role: "user", content: imagePrompt }],
              modalities: ["image", "text"],
            }),
          });

          let imageUrl: string | null = null;
          if (imgResp.ok) {
            const imgData = await imgResp.json();
            imageUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
          }

          // Save as asset
          const { data: savedAsset } = await supabase
            .from("assets")
            .insert({
              project_id: projectId,
              user_id: user.id,
              title: slide.headline,
              output: "both",
              status: "draft",
              folder: "Exploração",
              profile_used: profile,
              provider_used: imageModel,
              destination: "feed",
              preset: ratio || "1:1",
              tags: ["carousel", `slide-${slide.slideNumber}`],
            })
            .select()
            .single();

          if (savedAsset) {
            await supabase.from("asset_versions").insert({
              asset_id: savedAsset.id,
              version: 1,
              headline: slide.headline,
              body: (slide as any).body || "",
              cta: slide.role === "cta" ? slide.headline : "",
              image_url: imageUrl,
              generation_metadata: {
                carousel: true,
                slide_number: slide.slideNumber,
                slide_role: slide.role,
                visual_direction: slide.visualDirection,
                copy_placement: slide.copyPlacement,
                style_anchor: styleAnchor,
              },
            });

            results.push({
              id: savedAsset.id,
              slideNumber: slide.slideNumber,
              role: slide.role,
              headline: slide.headline,
              body: (slide as any).body || "",
              imageUrl,
              copyPlacement: slide.copyPlacement,
            });
          }
        } catch (e: any) {
          console.error(`Slide ${slide.slideNumber} error:`, e);
          results.push({
            slideNumber: slide.slideNumber,
            role: slide.role,
            headline: slide.headline,
            imageUrl: null,
            error: e.message,
          });
        }
      }

      return new Response(JSON.stringify({ slides: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid mode. Use 'storyline' or 'generate'." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("carousel-generate error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("429")) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (msg.includes("402")) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildDNAContext(project: any, dna: any): string {
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
    const visual = dna.visual as any;
    if (identity?.tom) parts.push(`Tom de voz: ${identity.tom}`);
    if (audience?.publico_alvo) parts.push(`Público: ${audience.publico_alvo}`);
    if (visual?.cores) parts.push(`Cores: ${visual.cores}`);
    if (visual?.estilo) parts.push(`Estilo: ${visual.estilo}`);
  }
  return parts.filter(Boolean).join("\n");
}
