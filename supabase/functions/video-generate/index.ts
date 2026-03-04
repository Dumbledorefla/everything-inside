import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FAL_API_URL = "https://queue.fal.run";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    if (!FAL_API_KEY) throw new Error("FAL_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { mode, project_id } = body;

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, niche")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single();
    if (!project) throw new Error("Project not found");

    let videoTitle = "";
    let videoUrl = "";
    let videoType = mode;
    let sourceAssetId = null;
    let promptUsed = "";

    if (mode === "freeform") {
      const { prompt, duration = "5", aspect_ratio = "16:9", image_url, negative_prompt } = body;
      promptUsed = prompt;

      const isImageToVideo = !!image_url;
      const endpoint = isImageToVideo
        ? "fal-ai/kling-video/v1.6/pro/image-to-video"
        : "fal-ai/kling-video/v1.6/pro/text-to-video";

      const falPayload: any = {
        prompt,
        duration,
        aspect_ratio,
      };
      if (negative_prompt) falPayload.negative_prompt = negative_prompt;
      if (isImageToVideo) {
        falPayload.image_url = image_url;
        delete falPayload.aspect_ratio; // Kling i2v infers aspect ratio from image
      }

      const result = await callFalApi(FAL_API_KEY, endpoint, falPayload);
      videoUrl = result.video?.url || result.output?.url || "";
      videoTitle = `Vídeo Livre: ${prompt.substring(0, 50)}...`;

    } else if (mode === "quick_ad") {
      const { source_asset_id, headline_text } = body;
      sourceAssetId = source_asset_id;

      // Fetch asset image
      const { data: assetVersion } = await supabase
        .from("asset_versions")
        .select("image_url, headline")
        .eq("asset_id", source_asset_id)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (!assetVersion?.image_url) throw new Error("Asset image not found");

      const adPrompt = `Gentle cinematic zoom animation on the product image. The headline "${headline_text || assetVersion.headline || ''}" appears elegantly with a fade-in effect. Professional advertising video.`;
      promptUsed = adPrompt;

      const result = await callFalApi(FAL_API_KEY, "fal-ai/kling-video/v1.6/pro/image-to-video", {
        prompt: adPrompt,
        image_url: assetVersion.image_url,
        duration: "5",
      });
      videoUrl = result.video?.url || result.output?.url || "";
      videoTitle = `Anúncio: ${headline_text || assetVersion.headline || "Quick Ad"}`;

    } else if (mode === "talking_avatar" || mode === "testimonial") {
      const { character_asset_id, script_text, voice_id = "Bella" } = body;
      sourceAssetId = character_asset_id;

      // Fetch character image
      const { data: charVersion } = await supabase
        .from("asset_versions")
        .select("image_url")
        .eq("asset_id", character_asset_id)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (!charVersion?.image_url) throw new Error("Character image not found");
      promptUsed = script_text;

      const result = await callFalApi(FAL_API_KEY, "fal-ai/heygen/avatar4/image-to-video", {
        image_url: charVersion.image_url,
        prompt: script_text,
        voice_id,
      });
      videoUrl = result.video?.url || result.output?.url || "";
      videoTitle = mode === "testimonial"
        ? `Depoimento: ${script_text.substring(0, 40)}...`
        : `Avatar: ${script_text.substring(0, 40)}...`;

    } else {
      throw new Error(`Unknown mode: ${mode}`);
    }

    // Save to videos table
    const { data: newVideo, error: insertError } = await supabase
      .from("videos")
      .insert({
        project_id,
        user_id: user.id,
        title: videoTitle,
        video_url: videoUrl || null,
        status: videoUrl ? "completed" : "processing",
        video_type: videoType,
        source_asset_id: sourceAssetId,
        prompt: promptUsed,
        aspect_ratio: body.aspect_ratio || (mode === 'quick_ad' ? '9:16' : '16:9'),
        duration: body.duration || '5',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, video: newVideo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("video-generate error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callFalApi(apiKey: string, endpoint: string, payload: any) {
  console.log(`[fal.ai] Submitting to queue: ${endpoint}`, JSON.stringify(payload).substring(0, 200));

  // Step 1: Submit to queue
  const submitResponse = await fetch(`${FAL_API_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!submitResponse.ok) {
    const errorBody = await submitResponse.text();
    console.error(`[fal.ai] Submit error ${submitResponse.status}: ${errorBody}`);
    throw new Error(`fal.ai API error (${submitResponse.status}): ${errorBody.substring(0, 200)}`);
  }

  const submitResult = await submitResponse.json();
  const requestId = submitResult.request_id;
  const statusUrl = submitResult.status_url;
  const responseUrl = submitResult.response_url;

  if (!requestId) {
    // Might be a synchronous response (unlikely for video, but handle it)
    console.log("[fal.ai] Got synchronous response");
    return submitResult;
  }

  console.log(`[fal.ai] Queued request: ${requestId}`);

  // Step 2: Poll for completion (max ~4 minutes)
  const MAX_POLLS = 48;
  const POLL_INTERVAL_MS = 5000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusResp = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });

    if (!statusResp.ok) {
      console.error(`[fal.ai] Status poll error: ${statusResp.status}`);
      continue;
    }

    const status = await statusResp.json();
    console.log(`[fal.ai] Poll ${i + 1}/${MAX_POLLS}: ${status.status}`);

    if (status.status === "COMPLETED" || status.status === "SUCCEEDED") {
      // Step 3: Fetch result
      const resultResp = await fetch(responseUrl, {
        headers: { Authorization: `Key ${apiKey}` },
      });

      if (!resultResp.ok) {
        throw new Error(`fal.ai result fetch failed: ${resultResp.status}`);
      }

      const result = await resultResp.json();
      console.log("[fal.ai] Success:", JSON.stringify(result).substring(0, 300));
      return result;
    }

    if (status.status === "FAILED") {
      throw new Error(`fal.ai processing failed: ${JSON.stringify(status).substring(0, 200)}`);
    }
  }

  throw new Error("fal.ai processing timed out after 4 minutes");
}
