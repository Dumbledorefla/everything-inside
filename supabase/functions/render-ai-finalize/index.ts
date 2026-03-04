import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface TextLayerMeta {
  type: "headline" | "body" | "cta";
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  textAlign: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const { imageUrl, layers, niche, ratio, lightAngle, isDarkBackground, maskDataUrl, projectId } = await req.json() as {
      imageUrl: string;
      layers: TextLayerMeta[];
      niche?: string;
      ratio?: string;
      lightAngle?: number;
      isDarkBackground?: boolean;
      maskDataUrl?: string;
      projectId?: string;
    };

    if (!imageUrl) throw new Error("imageUrl is required");
    if (!layers || layers.length === 0) throw new Error("At least one text layer is required");
    if (!projectId) throw new Error("projectId is required");

    // Build text placement description
    const textDescription = layers.map((l) => {
      const position = describePosition(l.x, l.y);
      const fontDesc = l.fontFamily.replace(/'/g, "").split(",")[0].trim();
      return `- ${l.type.toUpperCase()}: "${l.content}" | Position: ${position} | Font: ${fontDesc} ${l.fontWeight >= 700 ? "Bold" : "Regular"} | Color: ${l.color} | Size: ${l.fontSize}pt | Align: ${l.textAlign}`;
    }).join("\n");

    const angle = lightAngle ?? 315;
    const dark = isDarkBackground ?? false;
    const sceneContext = `A iluminação principal vem de um ângulo de ${angle}°. O fundo é predominantemente ${dark ? "escuro" : "claro"}.`;
    const nicheContext = niche ? ` O estilo visual é "${niche}".` : "";
    const ratioContext = ratio ? ` O aspect ratio da imagem é ${ratio}.` : "";

    const prompt = `Usando a imagem principal fornecida${maskDataUrl ? ", e usando a imagem de máscara para saber a área exata de edição," : ","} integre permanentemente os seguintes elementos de texto na cena. O texto NÃO deve parecer um adesivo. Ele precisa respeitar a física da imagem original.

Contexto da Cena: ${sceneContext}${nicheContext}${ratioContext}

REGRAS CRÍTICAS DE INTEGRAÇÃO:
1.  **Fidelidade à Máscara**: ${maskDataUrl ? "Altere APENAS as áreas brancas da imagem de máscara. O resto da imagem deve permanecer 100% intacto." : "Preserve toda a composição original da imagem — NÃO altere o cenário, sujeitos ou objetos."}
2.  **Integração Física**: O texto deve herdar a textura, o grão e a iluminação da superfície onde está sendo aplicado.
3.  **Sombras Realistas**: O texto deve projetar sombras sutis e realistas, opostas à direção da luz principal (${angle}°).
4.  **Tipografia Exata**: Use as fontes e pesos exatos especificados para cada camada de texto.

ELEMENTOS DE TEXTO PARA RENDERIZAR:
${textDescription}`;

    const contentParts: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageUrl } },
    ];
    if (maskDataUrl) {
      contentParts.push({ type: "image_url", image_url: { url: maskDataUrl } });
    }

    console.log("[RENDER-AI-FINALIZE] Calling AI Gateway...");

    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: contentParts }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[RENDER-AI-FINALIZE] AI error:", response.status, errText.slice(0, 300));
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || "";

    // ── Extract image from response ─────────────────────────────
    let imageBytes: Uint8Array | null = null;
    let contentType = "image/png";

    // Try images array (Gemini image output)
    const imageEntry = data.choices?.[0]?.message?.images?.[0];
    if (imageEntry?.image_url?.url) {
      const imgUrl = imageEntry.image_url.url;
      if (imgUrl.startsWith("data:")) {
        // data:image/png;base64,xxxx
        const match = imgUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          contentType = match[1];
          imageBytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        }
      } else {
        // Direct URL — download it
        const dl = await fetch(imgUrl);
        if (dl.ok) {
          contentType = dl.headers.get("content-type") || "image/png";
          imageBytes = new Uint8Array(await dl.arrayBuffer());
        }
      }
    }

    // Fallback: inline_data in content parts
    if (!imageBytes) {
      const parts = data.choices?.[0]?.message?.content;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.inline_data?.data) {
            contentType = part.inline_data.mime_type || "image/png";
            imageBytes = Uint8Array.from(atob(part.inline_data.data), (c) => c.charCodeAt(0));
            break;
          }
        }
      }
    }

    if (!imageBytes) {
      console.error("[RENDER-AI-FINALIZE] No image in AI response:", JSON.stringify(data).slice(0, 500));
      throw new Error("AI did not return a rendered image. Try again.");
    }

    console.log("[RENDER-AI-FINALIZE] Image extracted, size:", imageBytes.length);

    // ── Save to Supabase Storage ────────────────────────────────
    const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
    const fileName = `renders/${projectId}/render_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(fileName, imageBytes, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[RENDER-AI-FINALIZE] Storage upload error:", uploadError);
      throw new Error(`Failed to save rendered image: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from("assets")
      .getPublicUrl(fileName);

    const renderedImageUrl = publicUrlData.publicUrl;
    console.log("[RENDER-AI-FINALIZE] Saved to storage:", renderedImageUrl);

    // ── Log to cos_ledger and activity_log ──────────────────────
    await supabase.from("cos_ledger").insert({
      project_id: projectId,
      user_id: user.id,
      operation_type: "RENDER_FINALIZE",
      provider_used: "google/gemini-3-pro-image-preview",
      credits_cost: 10,
      estimated_usd: 0.10,
      metadata: { layers_count: layers.length, niche, ratio, has_mask: !!maskDataUrl },
    });

    await supabase.from("activity_log").insert({
      project_id: projectId,
      user_id: user.id,
      action: "Renderização IA finalizada",
      entity_type: "render",
      metadata: { layers_count: layers.length, niche, ratio, storage_path: fileName },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: aiMessage || "In-painting concluído com sucesso.",
        renderedImageUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[RENDER-AI-FINALIZE] Error:", e instanceof Error ? e.message : e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function describePosition(x: number, y: number): string {
  const vPos = y < 25 ? "top" : y < 45 ? "upper-center" : y < 60 ? "center" : y < 80 ? "lower-center" : "bottom";
  const hPos = x < 25 ? "left" : x < 45 ? "center-left" : x < 60 ? "center" : x < 80 ? "center-right" : "right";
  return `${vPos} ${hPos} (${Math.round(x)}%, ${Math.round(y)}%)`;
}
