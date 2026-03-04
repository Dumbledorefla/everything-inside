import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOGETHER_API_BASE = "https://api.together.xyz/v1/images/generations";
const FAL_API_BASE = "https://fal.run";

// ── Modelos disponíveis por modo ──────────────────────────────────────────────
export const ADULT_STUDIO_MODELS = {
  text2img: [
    {
      id: "together/black-forest-labs/FLUX.1-schnell",
      name: "FLUX.1 Schnell",
      provider: "together",
      cost: "pago",
      quality: "boa",
      description: "Rápido, sem filtros. Ideal para testes.",
      free: false,
    },
    {
      id: "together/black-forest-labs/FLUX.1-krea-dev",
      name: "FLUX.1 Krea Dev",
      provider: "together",
      cost: "pago",
      quality: "ótima",
      description: "Mais detalhado, sem filtros. Melhor qualidade.",
      free: false,
    },
    {
      id: "together/black-forest-labs/FLUX.2-dev",
      name: "FLUX.2 Dev",
      provider: "together",
      cost: "pago",
      quality: "máxima",
      description: "Última geração FLUX, sem filtros. Qualidade máxima.",
      free: false,
    },
  ],
  ip_adapter: [
    {
      id: "fal-ai/ip-adapter-face-id",
      name: "IP-Adapter Face ID",
      provider: "fal",
      cost: "pago",
      quality: "ótima",
      description: "Preserva identidade facial com alta fidelidade. Recomendado.",
      free: false,
    },
    {
      id: "fal-ai/flux/dev/image-to-image",
      name: "FLUX img2img",
      provider: "fal",
      cost: "pago",
      quality: "boa",
      description: "Usa sua foto como base e transforma a cena.",
      free: false,
    },
  ],
  controlnet: [
    {
      id: "fal-ai/controlnet-union-sdxl",
      name: "ControlNet SDXL",
      provider: "fal",
      cost: "pago",
      quality: "boa",
      description: "Preserva a pose do corpo. Boa para replicar posições.",
      free: false,
    },
    {
      id: "fal-ai/flux-controlnet",
      name: "FLUX ControlNet",
      provider: "fal",
      cost: "pago",
      quality: "ótima",
      description: "FLUX com preservação de pose. Melhor qualidade.",
      free: false,
    },
  ],
  lora: [
    {
      id: "fal-ai/flux-lora",
      name: "FLUX LoRA (treinado)",
      provider: "fal",
      cost: "premium",
      quality: "máxima",
      description: "Treina o modelo com suas fotos. Identidade 100% fiel.",
      free: false,
      requiresTraining: true,
    },
    {
      id: "together/lora",
      name: "Together LoRA (treinado)",
      provider: "together",
      cost: "premium",
      quality: "máxima",
      description: "LoRA na together.ai. Sem filtros, identidade completa.",
      free: false,
      requiresTraining: true,
    },
  ],
};

// ── Geração text2img via together.ai ─────────────────────────────────────────
async function generateText2Img(
  apiKey: string,
  modelId: string,
  prompt: string,
  ratio: string
): Promise<string | null> {
  const modelReal = modelId.replace("together/", "");
  const isSchnell = modelReal.includes("schnell");
  const dimensions =
    ratio === "9:16"
      ? { width: 768, height: 1344 }
      : ratio === "16:9"
      ? { width: 1344, height: 768 }
      : { width: 1024, height: 1024 };

  const resp = await fetch(TOGETHER_API_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelReal,
      prompt,
      n: 1,
      steps: isSchnell ? 4 : 28,
      ...dimensions,
      disable_safety_checker: true,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("together.ai error:", resp.status, err);
    return null;
  }
  const data = await resp.json();
  return data?.data?.[0]?.url ?? null;
}

// ── Geração IP-Adapter via fal.ai ─────────────────────────────────────────────
async function generateIPAdapter(
  apiKey: string,
  modelId: string,
  prompt: string,
  referencePhotoUrl: string,
  ratio: string
): Promise<string | null> {
  const imageSize =
    ratio === "9:16"
      ? "portrait_16_9"
      : ratio === "16:9"
      ? "landscape_16_9"
      : "square_hd";

  let body: Record<string, unknown>;

  if (modelId === "fal-ai/ip-adapter-face-id") {
    body = {
      prompt,
      face_image_url: referencePhotoUrl,
      image_size: imageSize,
      num_inference_steps: 28,
      enable_safety_checker: false,
    };
  } else {
    // flux/dev/image-to-image
    body = {
      prompt,
      image_url: referencePhotoUrl,
      image_size: imageSize,
      strength: 0.75,
      num_inference_steps: 28,
      enable_safety_checker: false,
    };
  }

  const endpoint = `${FAL_API_BASE}/${modelId}`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("fal.ai IP-Adapter error:", resp.status, err);
    return null;
  }
  const data = await resp.json();
  return data?.images?.[0]?.url ?? null;
}

// ── Geração ControlNet via fal.ai ─────────────────────────────────────────────
async function generateControlNet(
  apiKey: string,
  modelId: string,
  prompt: string,
  referencePhotoUrl: string,
  ratio: string
): Promise<string | null> {
  const imageSize =
    ratio === "9:16"
      ? "portrait_16_9"
      : ratio === "16:9"
      ? "landscape_16_9"
      : "square_hd";

  const body: Record<string, unknown> = {
    prompt,
    control_image_url: referencePhotoUrl,
    image_size: imageSize,
    num_inference_steps: 28,
    enable_safety_checker: false,
    controlnet_conditioning_scale: 0.8,
  };

  const endpoint = `${FAL_API_BASE}/${modelId}`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("fal.ai ControlNet error:", resp.status, err);
    return null;
  }
  const data = await resp.json();
  return data?.images?.[0]?.url ?? null;
}

// ── Geração LoRA via fal.ai ───────────────────────────────────────────────────
async function generateLoRA(
  apiKey: string,
  prompt: string,
  loraModelId: string,
  ratio: string
): Promise<string | null> {
  const imageSize =
    ratio === "9:16"
      ? "portrait_16_9"
      : ratio === "16:9"
      ? "landscape_16_9"
      : "square_hd";

  const resp = await fetch(`${FAL_API_BASE}/fal-ai/flux-lora`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      loras: [{ path: loraModelId, scale: 1.0 }],
      image_size: imageSize,
      num_inference_steps: 28,
      enable_safety_checker: false,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("fal.ai LoRA error:", resp.status, err);
    return null;
  }
  const data = await resp.json();
  return data?.images?.[0]?.url ?? null;
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TOGETHER_API_KEY = Deno.env.get("TOGETHER_API_KEY");
    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      project_id,
      user_id,
      mode, // 'text2img' | 'ip_adapter' | 'controlnet' | 'lora'
      model_id,
      prompt,
      reference_photo_url,
      lora_model_id,
      ratio = "1:1",
      num_variations = 1,
    } = body;

    if (!project_id || !user_id || !mode || !model_id || !prompt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: project_id, user_id, mode, model_id, prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (let i = 0; i < Math.min(num_variations, 4); i++) {
      // Create job record
      const { data: job, error: jobError } = await supabase
        .from("adult_studio_jobs")
        .insert({
          project_id,
          user_id,
          mode,
          model: model_id,
          prompt,
          reference_photo_url: reference_photo_url ?? null,
          lora_model_id: lora_model_id ?? null,
          status: "processing",
          metadata: { ratio, variation_index: i },
        })
        .select()
        .single();

      if (jobError || !job) {
        console.error("Job insert error:", jobError);
        continue;
      }

      let resultUrl: string | null = null;

      try {
        if (mode === "text2img") {
          if (!TOGETHER_API_KEY) throw new Error("TOGETHER_API_KEY não configurada");
          resultUrl = await generateText2Img(TOGETHER_API_KEY, model_id, prompt, ratio);
        } else if (mode === "ip_adapter") {
          if (!FAL_API_KEY) throw new Error("FAL_API_KEY não configurada");
          if (!reference_photo_url) throw new Error("Foto de referência obrigatória para IP-Adapter");
          resultUrl = await generateIPAdapter(FAL_API_KEY, model_id, prompt, reference_photo_url, ratio);
        } else if (mode === "controlnet") {
          if (!FAL_API_KEY) throw new Error("FAL_API_KEY não configurada");
          if (!reference_photo_url) throw new Error("Foto de referência obrigatória para ControlNet");
          resultUrl = await generateControlNet(FAL_API_KEY, model_id, prompt, reference_photo_url, ratio);
        } else if (mode === "lora") {
          if (!FAL_API_KEY) throw new Error("FAL_API_KEY não configurada");
          if (!lora_model_id) throw new Error("ID do modelo LoRA obrigatório");
          resultUrl = await generateLoRA(FAL_API_KEY, prompt, lora_model_id, ratio);
        }

        if (resultUrl) {
          await supabase
            .from("adult_studio_jobs")
            .update({ status: "completed", result_url: resultUrl })
            .eq("id", job.id);
          results.push({ job_id: job.id, status: "completed", url: resultUrl });
        } else {
          await supabase
            .from("adult_studio_jobs")
            .update({ status: "failed", error_message: "Modelo não retornou imagem" })
            .eq("id", job.id);
          results.push({ job_id: job.id, status: "failed", error: "Modelo não retornou imagem" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        await supabase
          .from("adult_studio_jobs")
          .update({ status: "failed", error_message: msg })
          .eq("id", job.id);
        results.push({ job_id: job.id, status: "failed", error: msg });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("adult-studio error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
