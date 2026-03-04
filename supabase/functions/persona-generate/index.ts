import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);

    // Auth
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { mode, project_id, prompt, num_variations = 4, reference_image_url } = body;

    if (!project_id || !prompt) {
      return new Response(JSON.stringify({ error: "project_id and prompt are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, niche")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    if (mode === "generate_base" || mode === "generate_evaluation") {
      // Text-to-image generation for base personas
      const personaType = mode === "generate_base" ? "persona_candidate" : "persona_evaluation";

      for (let i = 0; i < num_variations; i++) {
        try {
          const imagePrompt = `Generate a photorealistic portrait photo for a virtual influencer/persona. 
Description: ${prompt}
Requirements: High quality, photorealistic, professional lighting, suitable for social media marketing.
The person should look natural and approachable. Variation ${i + 1} of ${num_variations} - make each variation slightly different in expression, angle, or styling.`;

          const aiResponse = await fetch(AI_GATEWAY, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-pro-image-preview",
              messages: [{ role: "user", content: imagePrompt }],
              modalities: ["image", "text"],
            }),
          });

          if (!aiResponse.ok) {
            console.error(`Image generation failed for variation ${i + 1}:`, aiResponse.status);
            continue;
          }

          const aiData = await aiResponse.json();
          const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (!imageData) {
            console.error(`No image in response for variation ${i + 1}`);
            continue;
          }

          // Upload to storage
          const imageBytes = Uint8Array.from(atob(imageData.split(",")[1] || imageData), (c) => c.charCodeAt(0));
          const fileName = `personas/${project_id}/${crypto.randomUUID()}.png`;

          const { error: uploadError } = await supabase.storage
            .from("assets")
            .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            continue;
          }

          const { data: publicUrl } = supabase.storage.from("assets").getPublicUrl(fileName);
          const imageUrl = publicUrl.publicUrl;

          // Create asset record
          const { data: asset, error: assetError } = await supabase
            .from("assets")
            .insert({
              project_id,
              user_id: user.id,
              title: `Persona ${i + 1} - ${prompt.substring(0, 50)}`,
              output: "image",
              status: "draft",
              persona_type: personaType,
              final_render_url: imageUrl,
            })
            .select()
            .single();

          if (assetError) {
            console.error("Asset insert error:", assetError);
            continue;
          }

          // Create asset version
          await supabase.from("asset_versions").insert({
            asset_id: asset.id,
            image_url: imageUrl,
            headline: prompt.substring(0, 100),
            version: 1,
          });

          results.push({
            id: asset.id,
            imageUrl,
            title: asset.title,
            personaType,
          });
        } catch (err) {
          console.error(`Error generating variation ${i + 1}:`, err);
        }
      }
    } else if (mode === "generate_variation") {
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
- Variation ${i + 1} of ${num_variations}`;

          const aiResponse = await fetch(AI_GATEWAY, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-pro-image-preview",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: variationPrompt },
                  { type: "image_url", image_url: { url: reference_image_url } },
                ],
              }],
              modalities: ["image", "text"],
            }),
          });

          if (!aiResponse.ok) {
            console.error(`Variation generation failed ${i + 1}:`, aiResponse.status);
            continue;
          }

          const aiData = await aiResponse.json();
          const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (!imageData) {
            console.error(`No image in variation response ${i + 1}`);
            continue;
          }

          // Upload
          const base64Part = imageData.includes(",") ? imageData.split(",")[1] : imageData;
          const imageBytes = Uint8Array.from(atob(base64Part), (c) => c.charCodeAt(0));
          const fileName = `personas/${project_id}/variations/${crypto.randomUUID()}.png`;

          const { error: uploadError } = await supabase.storage
            .from("assets")
            .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

          if (uploadError) {
            console.error("Upload error:", uploadError);
            continue;
          }

          const { data: publicUrl } = supabase.storage.from("assets").getPublicUrl(fileName);
          const imageUrl = publicUrl.publicUrl;

          // Find the reference asset id from the reference_image_url
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
              persona_type: "persona_variation",
              reference_asset_id: refAsset?.id || null,
              final_render_url: imageUrl,
            })
            .select()
            .single();

          if (assetError) {
            console.error("Asset insert error:", assetError);
            continue;
          }

          await supabase.from("asset_versions").insert({
            asset_id: asset.id,
            image_url: imageUrl,
            headline: prompt.substring(0, 100),
            version: 1,
          });

          results.push({
            id: asset.id,
            imageUrl,
            title: asset.title,
            personaType: "persona_variation",
          });
        } catch (err) {
          console.error(`Error generating variation ${i + 1}:`, err);
        }
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode. Use generate_base, generate_variation, or generate_evaluation" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      project_id,
      user_id: user.id,
      action: `persona_${mode}`,
      entity_type: "persona",
      metadata: { count: results.length, prompt: prompt.substring(0, 200) },
    });

    return new Response(JSON.stringify({ results, count: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("persona-generate error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
