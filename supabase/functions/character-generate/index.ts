import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractImageUrl, uploadImageToStorage } from "../_shared/ai-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function authenticateUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

async function verifyProjectOwnership(supabase: any, projectId: string, userId: string) {
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, niche, description, product")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();
  if (!project) throw new Error("Project not found");
  return project;
}

async function getProjectDNA(supabase: any, projectId: string) {
  const { data } = await supabase
    .from("project_dna")
    .select("identity, audience, strategy, visual")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  return data;
}

function buildDNAContext(project: any, dna: any): string {
  if (!dna) return `Project: ${project.name}. Niche: ${project.niche || "general"}.`;
  const identity = dna.identity || {};
  const audience = dna.audience || {};
  const strategy = dna.strategy || {};
  return `Brand: ${identity.brandName || project.name}.
Niche: ${project.niche || "general"}.
Product: ${project.product || "not specified"}.
Tone of Voice: ${identity.toneOfVoice || "professional"}.
Target Audience: ${audience.demographics || "general audience"}.
Visual Style: ${(dna.visual?.colorPalette || []).join(", ") || "not defined"}.
Strategy: ${strategy.positioning || "not defined"}.`;
}

function buildAttributesPrompt(attributes: any): string {
  const attrParts: string[] = [];
  if (attributes?.ethnicity) attrParts.push(`Ethnicity: ${attributes.ethnicity}`);
  if (attributes?.apparentAge) attrParts.push(`Apparent age: ${attributes.apparentAge}`);
  if (attributes?.hairColor) attrParts.push(`Hair color: ${attributes.hairColor}`);
  if (attributes?.hairStyle) attrParts.push(`Hair style: ${attributes.hairStyle}`);
  if (attributes?.clothingStyle) attrParts.push(`Clothing style: ${attributes.clothingStyle}`);
  if (attributes?.bodyType) attrParts.push(`Body type: ${attributes.bodyType}`);
  if (attributes?.eyeColor) attrParts.push(`Eye color: ${attributes.eyeColor}`);
  if (attributes?.facialFeatures?.length) attrParts.push(`Facial features: ${attributes.facialFeatures.join(", ")}`);
  return attrParts.length > 0 ? `PHYSICAL ATTRIBUTES:\n${attrParts.join("\n")}` : "";
}

function buildCharacterPrompt(prompt: string, attributes: any, dnaContext: string, variationIndex: number, total: number): string {
  const attrsBlock = buildAttributesPrompt(attributes);

  return `Generate a photorealistic portrait photo for a virtual influencer/brand ambassador.

BRAND CONTEXT:
${dnaContext}

CHARACTER DESCRIPTION:
${prompt}

${attrsBlock}

REQUIREMENTS:
- High quality, photorealistic, cinematic lighting with depth
- Captured with an 85mm f/1.4 lens for soft bokeh background
- Suitable for social media marketing — avoid stock photo look
- The person should look natural, approachable and authentic
- The character should visually align with the brand identity described above
- Variation ${variationIndex + 1} of ${total} — make each variation slightly different in expression, angle, or styling
- DO NOT render any text in the image`;
}

async function generateImage(apiKey: string, prompt: string, referenceImageUrl?: string) {
  const messages: any[] = [];
  if (referenceImageUrl) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: referenceImageUrl } },
      ],
    });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  const response = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-image-preview",
      messages,
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    console.error("AI response error:", response.status);
    return null;
  }

  const data = await response.json();
  return extractImageUrl(data.choices?.[0]?.message);
}

// uploadImage is now handled by uploadImageToStorage from _shared/ai-utils.ts

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const user = await authenticateUser(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    const body = await req.json();
    const { mode, project_id, prompt, num_variations = 4, reference_image_url, character_attributes } = body;

    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const project = await verifyProjectOwnership(supabase, project_id, user.id);
    const dna = await getProjectDNA(supabase, project_id);
    const dnaContext = buildDNAContext(project, dna);

    // ═══ MODE: generate_prompt_suggestion ═══
    if (mode === "generate_prompt_suggestion") {
      const suggestionPrompt = `You are an AI Photography Director. Your mission is to create an extremely detailed image prompt to generate a character (influencer or customer) that is the face of a project.

PROJECT DNA:
${dnaContext}

INSTRUCTIONS:
Create a detailed character description divided into 5 clear sections. Be specific and creative to generate a unique, professional image — avoid the "stock photo" look.

FORMAT YOUR RESPONSE AS FOLLOWS:

**1. Main Subject:** [Describe the main character concisely. E.g.: Photorealistic portrait of a fitness influencer.]

**2. Detailed Character Description:** [Be very specific about appearance, including ethnicity, age, hair, eye color, body type, and unique facial features. E.g.: 28-year-old African-American woman with short blonde afro, brown eyes, athletic body, light freckles on nose.]

**3. Wardrobe & Style:** [Describe clothing and accessories in detail, aligned with the project DNA. E.g.: Wearing a Nike sport top and yoga leggings, smartwatch on wrist.]

**4. Scene & Composition:** [Where is the photo taken? Background? Framing? E.g.: In a modern, well-lit gym during sunrise. Medium close-up, character looking directly at camera with confident expression.]

**5. Lighting & Photographic Style:** [Light source? Photo style? E.g.: Soft natural light from large side window. Cinematic style, 85mm f/1.4 lens with soft bokeh. Vibrant colors, high contrast.]

Write the description in the same language the brand name suggests (Portuguese if Brazilian brand, English otherwise). Be vivid and specific.`;

      const aiResponse = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: suggestionPrompt }],
        }),
      });

      if (!aiResponse.ok) {
        return new Response(JSON.stringify({ error: "AI suggestion failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const suggestion = aiData.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ suggestion }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    // ═══ MODE: generate_base / generate_evaluation ═══
    if (mode === "generate_base" || mode === "generate_evaluation") {
      const characterType = mode === "generate_base" ? "character_candidate" : "character_evaluation";

      for (let i = 0; i < num_variations; i++) {
        try {
          let imagePrompt: string;
          if (mode === "generate_base") {
            imagePrompt = buildCharacterPrompt(prompt, character_attributes, dnaContext, i, num_variations);
          } else {
            // Evaluation mode: build intelligent prompt with DNA + attributes
            const attrsBlock = buildAttributesPrompt(character_attributes);

            imagePrompt = `Generate a photorealistic portrait photo of a SATISFIED CUSTOMER for use in a testimonial/review.

BRAND CONTEXT:
${dnaContext}

CHARACTER DESCRIPTION:
${prompt}

${attrsBlock}

REQUIREMENTS:
- High quality, photorealistic, soft natural lighting with warmth
- Captured with an 85mm f/1.4 lens for cinematic depth
- The person should look authentic and genuine, NOT like a stock photo
- Expression should convey genuine satisfaction, trust and warmth
- The character should look like a real customer of the brand described above
- Variation ${i + 1} of ${num_variations} — each variation should be a DIFFERENT person to create a diverse set of "customers"
- DO NOT render any text in the image`;
          }

          const imageData = await generateImage(LOVABLE_API_KEY, imagePrompt);
          if (!imageData) continue;

          const path = `characters/${project_id}/${crypto.randomUUID()}.png`;
          const imageUrl = await uploadImageToStorage(supabase, imageData, "assets", path);
          if (!imageUrl) continue;

          const { data: asset, error: assetError } = await supabase
            .from("assets")
            .insert({
              project_id,
              user_id: user.id,
              title: `${mode === "generate_base" ? "Candidato" : "Personagem"} ${i + 1} - ${prompt.substring(0, 50)}`,
              output: "image",
              status: "draft",
              persona_type: characterType,
              final_render_url: imageUrl,
            })
            .select()
            .single();

          if (assetError) { console.error("Asset insert error:", assetError); continue; }

          await supabase.from("asset_versions").insert({
            asset_id: asset.id,
            image_url: imageUrl,
            headline: prompt.substring(0, 100),
            version: 1,
          });

          results.push({ id: asset.id, imageUrl, title: asset.title, characterType });
        } catch (err) {
          console.error(`Error generating variation ${i + 1}:`, err);
        }
      }
    }
    // ═══ MODE: generate_variation ═══
    else if (mode === "generate_variation") {
      if (!reference_image_url) {
        return new Response(JSON.stringify({ error: "reference_image_url is required for generate_variation mode" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (let i = 0; i < num_variations; i++) {
        try {
          const variationPrompt = `You are given a reference image of a person. Generate a NEW image of THE SAME PERSON in a different scene/context.

New scene description: ${prompt}

CRITICAL RULES:
- The person must look EXACTLY the same (same face, same features, same ethnicity, same approximate age)
- Only change the scene, clothing, expression, or context as described
- Maintain photorealistic quality
- DO NOT render any text in the image
- Variation ${i + 1} of ${num_variations}`;

          const imageData = await generateImage(LOVABLE_API_KEY, variationPrompt, reference_image_url);
          if (!imageData) continue;

          const varPath = `characters/${project_id}/variations/${crypto.randomUUID()}.png`;
          const imageUrl = await uploadImageToStorage(supabase, imageData, "assets", varPath);
          if (!imageUrl) continue;

          const { data: refAsset } = await supabase
            .from("assets")
            .select("id")
            .eq("final_render_url", reference_image_url)
            .eq("project_id", project_id)
            .limit(1)
            .single();

          const { data: asset, error: assetError } = await supabase
            .from("assets")
            .insert({
              project_id,
              user_id: user.id,
              title: `Variação - ${prompt.substring(0, 50)}`,
              output: "image",
              status: "draft",
              persona_type: "character_variation",
              reference_asset_id: refAsset?.id || null,
              final_render_url: imageUrl,
            })
            .select()
            .single();

          if (assetError) { console.error("Asset insert error:", assetError); continue; }

          await supabase.from("asset_versions").insert({
            asset_id: asset.id,
            image_url: imageUrl,
            headline: prompt.substring(0, 100),
            version: 1,
          });

          results.push({ id: asset.id, imageUrl, title: asset.title, characterType: "character_variation" });
        } catch (err) {
          console.error(`Error generating variation ${i + 1}:`, err);
        }
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode. Use generate_prompt_suggestion, generate_base, generate_variation, or generate_evaluation" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      project_id,
      user_id: user.id,
      action: `character_${mode}`,
      entity_type: "character",
      metadata: { count: results.length, prompt: (prompt || "").substring(0, 200) },
    });

    return new Response(JSON.stringify({ results, count: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("character-generate error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    const status = msg === "Unauthorized" ? 401 : msg === "Project not found" ? 404 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
