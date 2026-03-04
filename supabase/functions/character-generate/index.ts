import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function buildCharacterPrompt(prompt: string, attributes: any, dnaContext: string, variationIndex: number, total: number): string {
  const attrParts: string[] = [];
  if (attributes?.ethnicity) attrParts.push(`Ethnicity: ${attributes.ethnicity}`);
  if (attributes?.apparentAge) attrParts.push(`Apparent age: ${attributes.apparentAge}`);
  if (attributes?.hairColor) attrParts.push(`Hair color: ${attributes.hairColor}`);
  if (attributes?.hairStyle) attrParts.push(`Hair style: ${attributes.hairStyle}`);
  if (attributes?.clothingStyle) attrParts.push(`Clothing style: ${attributes.clothingStyle}`);

  return `Generate a photorealistic portrait photo for a virtual influencer/brand ambassador.

BRAND CONTEXT:
${dnaContext}

CHARACTER DESCRIPTION:
${prompt}

${attrParts.length > 0 ? `PHYSICAL ATTRIBUTES:\n${attrParts.join("\n")}` : ""}

REQUIREMENTS:
- High quality, photorealistic, professional lighting
- Suitable for social media marketing
- The person should look natural and approachable
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
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

async function uploadImage(supabase: any, imageData: string, projectId: string, subfolder = "") {
  const base64Part = imageData.includes(",") ? imageData.split(",")[1] : imageData;
  const imageBytes = Uint8Array.from(atob(base64Part), (c) => c.charCodeAt(0));
  const path = subfolder
    ? `characters/${projectId}/${subfolder}/${crypto.randomUUID()}.png`
    : `characters/${projectId}/${crypto.randomUUID()}.png`;

  const { error } = await supabase.storage
    .from("assets")
    .upload(path, imageBytes, { contentType: "image/png", upsert: true });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  const { data: publicUrl } = supabase.storage.from("assets").getPublicUrl(path);
  return publicUrl.publicUrl;
}

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
      const suggestionPrompt = `You are a creative director for a digital marketing brand.

BRAND CONTEXT:
${dnaContext}

Based on this brand DNA (niche, audience, tone of voice, visual style), create a detailed description for a virtual influencer/brand ambassador that would be the perfect face of this brand.

Describe in detail:
1. Physical appearance (age, ethnicity, facial features)
2. Hair style and color
3. Clothing style and typical outfit
4. Expression and body language
5. A typical scene/background setting

Write the description in a single paragraph, in the same language the brand name suggests (Portuguese if Brazilian brand, English otherwise). Be specific and vivid.`;

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
          const imagePrompt = mode === "generate_base"
            ? buildCharacterPrompt(prompt, character_attributes, dnaContext, i, num_variations)
            : `Generate a photorealistic portrait photo of a person for a testimonial/review.
Description: ${prompt}
Requirements: High quality, photorealistic, professional lighting, natural look.
Variation ${i + 1} of ${num_variations} - slightly different expression or angle.
DO NOT render any text in the image.`;

          const imageData = await generateImage(LOVABLE_API_KEY, imagePrompt);
          if (!imageData) continue;

          const imageUrl = await uploadImage(supabase, imageData, project_id);
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

          const imageUrl = await uploadImage(supabase, imageData, project_id, "variations");
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
