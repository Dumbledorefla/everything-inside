import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Formula = "pas" | "tutorial" | "hero_journey";

interface CarouselRequest {
  projectId: string;
  referenceId?: string;
  slideCount: number;
  topic?: string;
  profile: "economy" | "standard" | "quality";
  ratio: string;
  mode: "storyline" | "generate";
  formula?: Formula;
  approvedStoryline?: SlideStoryline[];
  styleAnchor?: string;
}

interface SlideStoryline {
  slideNumber: number;
  role: string;
  headline: string;
  body?: string;
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

// ── FORMULA DEFINITIONS ────────────────────────────────────────
const FORMULA_PROMPTS: Record<Formula, (slideCount: number) => string> = {
  pas: (n) => `Use a Fórmula PAS (Problema → Agitação → Solução). Estrutura OBRIGATÓRIA:

Slide 1 (PROBLEMA): Visual que espelha a DOR do público-alvo. Headline agressiva que nomeia o problema.
Slide 2 (AGITAÇÃO): Mostra as CONSEQUÊNCIAS de não resolver. Gera desconforto e urgência.
Slide 3 (SOLUÇÃO): Introduz o produto/serviço como o "herói" que resolve a dor.
${n >= 5 ? `Slide 4 (BENEFÍCIO REAL): Mostra o resultado final, a TRANSFORMAÇÃO. Antes vs Depois implícito.` : ""}
Slide ${n} (CTA): Chamada clara e direta para compra, link na bio ou ação específica.

TOM: Direto, persuasivo, focado em conversão. Cada slide deve aumentar a tensão até o alívio da solução.`,

  tutorial: (n) => `Use a Fórmula TUTORIAL/LISTA (Promessa → Entrega → Recapitulação). Estrutura OBRIGATÓRIA:

Slide 1 (A PROMESSA): "Como conseguir [X] em [Y] passos" ou "Os [N] segredos para [resultado]". Visual ultra-limpo e chamativo.
Slides 2 a ${n - 2} (ENTREGA): Conteúdo prático, direto, visualmente rico. Cada slide = 1 dica/passo numerado. Informação ACIONÁVEL.
Slide ${n - 1} (RECAPITULAÇÃO): Resumo visual rápido de todos os pontos para o usuário SALVAR o post.
Slide ${n} (CTA): "Salve para não esquecer" ou "Compartilhe com quem precisa" ou "Siga para mais dicas".

TOM: Educativo, acessível, generoso. O objetivo é viralizar por valor. Estética nativa de Instagram.`,

  hero_journey: (n) => `Use a Fórmula JORNADA DO HERÓI (Gancho → Conflito → Epifania → Resultado). Estrutura OBRIGATÓRIA:

Slide 1 (O GANCHO): Uma afirmação contraintuitiva, polêmica suave ou início de história pessoal que PARA o scroll.
Slides 2 a ${Math.min(3, n - 3)} (O CONFLITO): O desafio enfrentado, o erro comum do mercado, ou a "mentira" que todos acreditam.
Slide ${Math.min(4, n - 2)} (A EPIFANIA): O segredo, a virada de chave, o insight que muda tudo. O momento "aha!".
Slide ${n - 1} (RESULTADO): Prova social, dados, screenshot, depoimento. A evidência da transformação.
Slide ${n} (CTA): Convite para seguir, comentar ou "marque alguém que precisa ouvir isso".

TOM: Narrativo, autêntico, inspirador. Construção de autoridade e conexão emocional. Storytelling puro.`,
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
    const { projectId, referenceId, slideCount, topic, profile, ratio, mode, formula, approvedStoryline } = body;

    // Fetch project + DNA
    const [{ data: project }, { data: dna }] = await Promise.all([
      supabase.from("projects").select("name, niche, product, description").eq("id", projectId).single(),
      supabase.from("project_dna").select("*").eq("project_id", projectId)
        .order("version", { ascending: false }).limit(1).single(),
    ]);

    // Fetch reference context
    let refContext = "";
    let refType = "instagram";
    if (referenceId) {
      const { data: ref } = await supabase.from("reference_analyses").select("*").eq("id", referenceId).single();
      if (ref) {
        refType = ref.reference_type || "instagram";
        const raw = ref.raw_analysis as any || {};
        refContext = `\n\nREFERÊNCIA VISUAL ATIVA (Tipo: ${refType.toUpperCase()}):
Arquétipo: ${ref.visual_archetype}
Tom: ${ref.emotional_tone}
Composição: ${ref.composition_intent}
${raw.palette?.length ? `Paleta: ${raw.palette.join(", ")}` : ""}
${raw.lighting_type ? `Iluminação: ${raw.lighting_type}` : ""}
${ref.generated_prompt ? `Direção Visual: ${ref.generated_prompt}` : ""}`;
      }
    }

    // Auto-select formula based on reference type if not provided
    const effectiveFormula: Formula = formula || autoSelectFormula(refType);
    const dnaContext = buildDNAContext(project, dna) + refContext;

    // ── MODE: STORYLINE ─────────────────────────────────────────
    if (mode === "storyline") {
      const formulaPrompt = FORMULA_PROMPTS[effectiveFormula](slideCount);

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

FÓRMULA SELECIONADA: ${effectiveFormula.toUpperCase()}
${formulaPrompt}

Crie um roteiro de carrossel com EXATAMENTE ${slideCount} slides.

REGRAS DE PERSUASÃO:
- Cada slide deve ter uma RAZÃO ESTRATÉGICA para existir na sequência
- A narrativa deve criar CURIOSIDADE PROGRESSIVA (cada slide puxa o próximo)
- O visual deve manter CONSISTÊNCIA ABSOLUTA (mesma luz, estilo, cores, personagem)
- Indique onde o texto deve ficar para NÃO poluir o design (topo, centro, rodapé, lateral)
- Os roles devem seguir: "hook" para gancho, "problem" para problema, "agitation" para agitação, "solution" para solução, "benefit" para benefício, "content" para conteúdo, "recap" para recapitulação, "conflict" para conflito, "epiphany" para epifania, "proof" para prova, "cta" para chamada de ação

REGRAS DE COPY (OBRIGATÓRIO — NÃO OMITIR NENHUM CAMPO):
- CADA slide DEVE ter um "headline" forte e persuasivo (máximo 10 palavras)
- CADA slide DEVE ter um "body" com texto de apoio (1-3 frases curtas que complementam o headline)
- O campo "body" NUNCA pode ser vazio, null, "" ou omitido — é OBRIGATÓRIO para TODOS os slides sem exceção
- O headline captura atenção, o body expande com detalhes práticos ou emocionais
- Para slides de CTA, o body deve conter a instrução específica (ex: "Clique no link da bio e comece agora")

Retorne APENAS JSON válido (sem markdown, sem backticks):
{
  "formula": "${effectiveFormula}",
  "storyline": [
    {
      "slideNumber": 1,
      "role": "hook",
      "headline": "Título impactante e curto",
      "body": "Texto de apoio obrigatório com 1-3 frases. Nunca deixe vazio.",
      "visualDirection": "Descrição detalhada da cena visual para este slide",
      "copyPlacement": "topo-esquerdo"
    }
  ],
  "styleAnchor": "Descrição do estilo visual unificado que deve ser mantido em TODOS os slides"
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
      const storyline = jsonMatch ? JSON.parse(jsonMatch[0]) : { storyline: [], styleAnchor: "", formula: effectiveFormula };

      return new Response(JSON.stringify({ ...storyline, formula: effectiveFormula }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MODE: GENERATE (after storyline approval) ───────────────
    if (mode === "generate" && approvedStoryline?.length) {
      const results: any[] = [];
      const imageModel = IMAGE_MODELS[profile] || IMAGE_MODELS.standard;
      const styleAnchor = body.styleAnchor || "Professional, consistent lighting and color grading across all slides.";

      for (const slide of approvedStoryline) {
        const imagePrompt = `Create slide ${slide.slideNumber} of ${approvedStoryline.length} for an Instagram carousel.

VISUAL CONSISTENCY LOCK (MUST MATCH ALL SLIDES):
${styleAnchor}

THIS SLIDE:
Role: ${getRoleDescription(slide.role)}
Visual Direction: ${slide.visualDirection}
Copy Placement Zone: ${slide.copyPlacement} (leave this area completely clean and empty for text overlay)

${dnaContext}

Aspect ratio: ${ratio || "1:1"}

CRITICAL RULES:
- DO NOT render any text, letters, words, numbers, or typographic elements in the image.
- The image must be a CLEAN visual base — all text (headline, body, CTA) will be added as editable overlays later.
- Leave generous negative space in the "${slide.copyPlacement}" zone for text placement.
- Maintain EXACT SAME lighting, color palette, style, and visual mood as all other slides in this carousel.
- Focus 100% on visual storytelling: lighting, color, texture, composition, and mood.`;

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
              tags: ["carousel", `slide-${slide.slideNumber}`, `formula-${effectiveFormula}`],
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
                formula: effectiveFormula,
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

// ── HELPERS ─────────────────────────────────────────────────────

function autoSelectFormula(refType: string): Formula {
  switch (refType) {
    case "sales": return "pas";
    case "instagram": return "tutorial";
    case "brand": return "hero_journey";
    case "landing": return "pas";
    default: return "tutorial";
  }
}

function getRoleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    hook: "GANCHO — alto impacto visual, para o scroll",
    problem: "PROBLEMA — visual que espelha a dor do público",
    agitation: "AGITAÇÃO — consequências, desconforto, urgência",
    solution: "SOLUÇÃO — o herói que resolve tudo",
    benefit: "BENEFÍCIO — resultado final, transformação",
    content: "CONTEÚDO — desenvolvimento prático e visual",
    recap: "RECAPITULAÇÃO — resumo visual para salvar",
    conflict: "CONFLITO — desafio ou erro comum do mercado",
    epiphany: "EPIFANIA — virada de chave, insight transformador",
    proof: "PROVA — evidência, prova social, autoridade",
    cta: "CTA — chamada para ação clara e direta",
  };
  return descriptions[role] || `${role.toUpperCase()} — desenvolvimento da narrativa`;
}

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
