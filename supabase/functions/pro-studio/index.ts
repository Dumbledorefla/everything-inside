import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function generateText2Img(apiKey: string, modelId: string, prompt: string, ratio: string): Promise<string | null> {
  const model = modelId.replace("together/", "");
  const isSchnell = model.includes("schnell");
  const dims = ratio === "9:16" ? { width: 768, height: 1344 } : ratio === "16:9" ? { width: 1344, height: 768 } : { width: 1024, height: 1024 };
  const resp = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, n: 1, steps: isSchnell ? 4 : 28, ...dims, disable_safety_checker: true }),
  });
  if (!resp.ok) { console.error("together error:", resp.status, await resp.text()); return null; }
  const data = await resp.json();
  return data?.data?.[0]?.url ?? null;
}

async function generateIPAdapter(apiKey: string, modelId: string, prompt: string, referenceUrl: string, ratio: string): Promise<string | null> {
  const imageSize = ratio === "9:16" ? "portrait_16_9" : ratio === "16:9" ? "landscape_16_9" : "square_hd";
  const body = modelId === "fal-ai/ip-adapter-face-id"
    ? { prompt, face_image_url: referenceUrl, image_size: imageSize, num_inference_steps: 28, enable_safety_checker: false }
    : { prompt, image_url: referenceUrl, image_size: imageSize, strength: 0.75, num_inference_steps: 28, enable_safety_checker: false };
  const resp = await fetch(`https://fal.run/${modelId}`, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) { console.error("fal ip-adapter error:", resp.status, await resp.text()); return null; }
  const data = await resp.json();
  return data?.images?.[0]?.url ?? null;
}

async function generateControlNet(apiKey: string, modelId: string, prompt: string, referenceUrl: string, ratio: string): Promise<string | null> {
  const imageSize = ratio === "9:16" ? "portrait_16_9" : ratio === "16:9" ? "landscape_16_9" : "square_hd";
  const resp = await fetch(`https://fal.run/${modelId}`, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, control_image_url: referenceUrl, image_size: imageSize, num_inference_steps: 28, enable_safety_checker: false, controlnet_conditioning_scale: 0.8 }),
  });
  if (!resp.ok) { console.error("fal controlnet error:", resp.status, await resp.text()); return null; }
  const data = await resp.json();
  return data?.images?.[0]?.url ?? null;
}

async function generateLoRA(apiKey: string, prompt: string, loraModelId: string, ratio: string): Promise<string | null> {
  const imageSize = ratio === "9:16" ? "portrait_16_9" : ratio === "16:9" ? "landscape_16_9" : "square_hd";
  const resp = await fetch("https://fal.run/fal-ai/flux-lora", {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, loras: [{ path: loraModelId, scale: 1.0 }], image_size: imageSize, num_inference_steps: 28, enable_safety_checker: false }),
  });
  if (!resp.ok) { console.error("fal lora error:", resp.status, await resp.text()); return null; }
  const data = await resp.json();
  return data?.images?.[0]?.url ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const TOGETHER_API_KEY = Deno.env.get("TOGETHER_API_KEY");
    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { project_id, user_id, mode, model_id, prompt, reference_photo_url, lora_model_id, ratio = "1:1", num_variations = 1 } = await req.json();
    if (!project_id || !user_id || !mode || !model_id || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const results = [];
    for (let i = 0; i < Math.min(num_variations, 4); i++) {
      const { data: job } = await supabase.from("adult_studio_jobs").insert({ project_id, user_id, mode, model: model_id, prompt, reference_photo_url: reference_photo_url ?? null, lora_model_id: lora_model_id ?? null, status: "processing", metadata: { ratio, variation_index: i } }).select().single();
      if (!job) continue;
      let resultUrl: string | null = null;
      try {
        if (mode === "text2img") {
          if (!TOGETHER_API_KEY) throw new Error("TOGETHER_API_KEY not configured");
          resultUrl = await generateText2Img(TOGETHER_API_KEY, model_id, prompt, ratio);
        } else if (mode === "ip_adapter") {
          if (!FAL_API_KEY) throw new Error("FAL_API_KEY not configured");
          if (!reference_photo_url) throw new Error("Reference photo required for IP-Adapter");
          resultUrl = await generateIPAdapter(FAL_API_KEY, model_id, prompt, reference_photo_url, ratio);
        } else if (mode === "controlnet") {
          if (!FAL_API_KEY) throw new Error("FAL_API_KEY not configured");
          if (!reference_photo_url) throw new Error("Reference photo required for ControlNet");
          resultUrl = await generateControlNet(FAL_API_KEY, model_id, prompt, reference_photo_url, ratio);
        } else if (mode === "lora") {
          if (!FAL_API_KEY) throw new Error("FAL_API_KEY not configured");
          if (!lora_model_id) throw new Error("LoRA model ID required");
          resultUrl = await generateLoRA(FAL_API_KEY, prompt, lora_model_id, ratio);
        }
        if (resultUrl) {
          await supabase.from("adult_studio_jobs").update({ status: "completed", result_url: resultUrl }).eq("id", job.id);
          results.push({ job_id: job.id, status: "completed", url: resultUrl });
        } else {
          await supabase.from("adult_studio_jobs").update({ status: "failed", error_message: "No image returned" }).eq("id", job.id);
          results.push({ job_id: job.id, status: "failed", error: "No image returned" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await supabase.from("adult_studio_jobs").update({ status: "failed", error_message: msg }).eq("id", job.id);
        results.push({ job_id: job.id, status: "failed", error: msg });
      }
    }
    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
