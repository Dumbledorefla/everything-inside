import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractImageUrl, uploadImageToStorage } from "../_shared/ai-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function generateImage(apiKey: string, prompt: string, referenceImageUrl?: string | null): Promise<string | null> {
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
    const errorText = await response.text();
    console.error("AI response error:", response.status, errorText);
    return null;
  }

  const data = await response.json();
  return extractImageUrl(data.choices?.[0]?.message);
}

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch pending jobs (process up to 3 at a time)
    const { data: jobs, error: fetchError } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(3);

    if (fetchError) {
      console.error("Error fetching jobs:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch jobs" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No pending jobs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const job of jobs) {
      console.log(`Processing job ${job.id} (${job.job_type})`);

      // Mark as processing
      await supabase.from("generation_jobs").update({ status: "processing" }).eq("id", job.id);

      try {
        // Generate the image
        const imageData = await generateImage(LOVABLE_API_KEY, job.prompt, job.reference_image_url);

        if (!imageData) {
          await supabase.from("generation_jobs")
            .update({ status: "failed", error_message: "AI returned no image data" })
            .eq("id", job.id);
          results.push({ job_id: job.id, status: "failed" });
          continue;
        }

        // Upload to storage
        const subFolder = job.job_type === "character_variation" ? "variations/" : "";
        const path = `characters/${job.project_id}/${subFolder}${crypto.randomUUID()}.png`;
        const imageUrl = await uploadImageToStorage(supabase, imageData, "assets", path);

        if (!imageUrl) {
          await supabase.from("generation_jobs")
            .update({ status: "failed", error_message: "Failed to upload image to storage" })
            .eq("id", job.id);
          results.push({ job_id: job.id, status: "failed" });
          continue;
        }

        // Build asset title
        const meta = job.metadata as any || {};
        const originalPrompt = meta.original_prompt || job.prompt.substring(0, 50);
        const variationIndex = (meta.variation_index ?? 0) + 1;

        let title: string;
        if (job.job_type === "character_candidate") {
          title = `Candidato ${variationIndex} - ${originalPrompt.substring(0, 50)}`;
        } else if (job.job_type === "character_evaluation") {
          title = `Personagem ${variationIndex} - ${originalPrompt.substring(0, 50)}`;
        } else {
          title = `Variação - ${originalPrompt.substring(0, 50)}`;
        }

        // Find reference asset for variations
        let referenceAssetId: string | null = null;
        if (job.job_type === "character_variation" && job.reference_image_url) {
          const { data: refAsset } = await supabase
            .from("assets")
            .select("id")
            .eq("final_render_url", job.reference_image_url)
            .eq("project_id", job.project_id)
            .limit(1)
            .maybeSingle();
          referenceAssetId = refAsset?.id || null;
        }

        // Create asset record
        const { data: asset, error: assetError } = await supabase
          .from("assets")
          .insert({
            project_id: job.project_id,
            user_id: job.user_id,
            title,
            output: "image",
            status: "draft",
            persona_type: job.job_type,
            reference_asset_id: referenceAssetId,
            final_render_url: imageUrl,
          })
          .select()
          .single();

        if (assetError) {
          console.error("Asset insert error:", assetError);
          await supabase.from("generation_jobs")
            .update({ status: "failed", error_message: `Asset insert error: ${assetError.message}` })
            .eq("id", job.id);
          results.push({ job_id: job.id, status: "failed" });
          continue;
        }

        // Create asset version
        await supabase.from("asset_versions").insert({
          asset_id: asset.id,
          image_url: imageUrl,
          headline: originalPrompt.substring(0, 100),
          version: 1,
        });

        // Mark job as completed
        await supabase.from("generation_jobs")
          .update({ status: "completed", asset_id: asset.id })
          .eq("id", job.id);

        console.log(`Job ${job.id} completed. Asset: ${asset.id}`);
        results.push({ job_id: job.id, status: "completed", asset_id: asset.id });
      } catch (err) {
        console.error(`Job ${job.id} failed:`, err);
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        await supabase.from("generation_jobs")
          .update({ status: "failed", error_message: errorMsg })
          .eq("id", job.id);
        results.push({ job_id: job.id, status: "failed", error: errorMsg });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("job-processor error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
