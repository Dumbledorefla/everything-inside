import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const body = await req.text();

    console.log("[RENDER-AI-FINALIZE] ===== INÍCIO DA REQUISIÇÃO =====");
    console.log(`[RENDER-AI-FINALIZE] Timestamp: ${new Date().toISOString()}`);
    console.log(`[RENDER-AI-FINALIZE] Método: ${req.method}`);
    console.log(`[RENDER-AI-FINALIZE] Payload size: ${body.length} bytes`);

    const { imageUrl, layers, niche, ratio, lightAngle, isDarkBackground, maskDataUrl } = JSON.parse(body) as {
      imageUrl: string;
      layers: TextLayerMeta[];
      niche?: string;
      ratio?: string;
      lightAngle?: number;
      isDarkBackground?: boolean;
      maskDataUrl?: string;
    };

    console.log("[RENDER-AI-FINALIZE] Campos recebidos:", {
      imageUrl: imageUrl ? "✓ presente" : "✗ faltando",
      layers: layers?.length ?? 0,
      niche: niche || "não especificado",
      ratio: ratio || "não especificado",
      lightAngle: lightAngle ?? "não especificado",
      isDarkBackground,
      maskDataUrl: maskDataUrl ? "✓ presente" : "✗ faltando",
    });

    if (!imageUrl) throw new Error("imageUrl is required");
    if (!layers || layers.length === 0) throw new Error("At least one text layer is required");

    console.log("[RENDER-AI-FINALIZE] Validação de entrada: ✓ OK");

    // Build text placement description
    const textDescription = layers.map((l) => {
      const position = describePosition(l.x, l.y);
      const fontDesc = l.fontFamily.replace(/'/g, "").split(",")[0].trim();
      return `- ${l.type.toUpperCase()}: "${l.content}" | Position: ${position} | Font: ${fontDesc} ${l.fontWeight >= 700 ? "Bold" : "Regular"} | Color: ${l.color} | Size: ${l.fontSize}pt | Align: ${l.textAlign}`;
    }).join("\n");

    console.log("[RENDER-AI-FINALIZE] Camadas de texto processadas:", {
      total: layers.length,
      descricao: textDescription.slice(0, 200) + "...",
    });

    // Build scene context from physical data
    const angle = lightAngle ?? 315;
    const dark = isDarkBackground ?? false;
    const sceneContext = `A iluminação principal vem de um ângulo de ${angle}°. O fundo é predominantemente ${dark ? "escuro" : "claro"}.`;

    console.log("[RENDER-AI-FINALIZE] Contexto de cena:", sceneContext);

    const nicheContext = niche ? ` O estilo visual é "${niche}".` : "";
    const ratioContext = ratio ? ` O aspect ratio da imagem é ${ratio}.` : "";

    const prompt = `Usando a imagem principal fornecida${maskDataUrl ? ", e usando a imagem de máscara para saber a área exata de edição," : ","} integre permanentemente os seguintes elementos de texto na cena. O texto NÃO deve parecer um adesivo. Ele precisa respeitar a física da imagem original.

Contexto da Cena: ${sceneContext}${nicheContext}${ratioContext}

REGRAS CRÍTICAS DE INTEGRAÇÃO:
1.  **Fidelidade à Máscara**: ${maskDataUrl ? "Altere APENAS as áreas brancas da imagem de máscara. O resto da imagem deve permanecer 100% intacto." : "Preserve toda a composição original da imagem — NÃO altere o cenário, sujeitos ou objetos."}
2.  **Integração Física**: O texto deve herdar a textura, o grão e a iluminação da superfície onde está sendo aplicado. Se estiver sobre um pergaminho, deve parecer tinta absorvida; se sobre metal, deve ter reflexos.
3.  **Sombras Realistas**: O texto deve projetar sombras sutis e realistas, opostas à direção da luz principal (${angle}°).
4.  **Tipografia Exata**: Use as fontes e pesos exatos especificados para cada camada de texto.

ELEMENTOS DE TEXTO PARA RENDERIZAR:
${textDescription}`;

    console.log("[RENDER-AI-FINALIZE] Prompt construído:", {
      tamanho: prompt.length,
      primeiras_100_chars: prompt.slice(0, 100) + "...",
    });

    // Build content array: prompt + original image + optional mask
    const contentParts: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageUrl } },
    ];
    if (maskDataUrl) {
      contentParts.push({ type: "image_url", image_url: { url: maskDataUrl } });
    }

    console.log("[RENDER-AI-FINALIZE] Chamando AI Gateway...", {
      model: "google/gemini-3-pro-image-preview",
      imagens_no_payload: maskDataUrl ? 2 : 1,
      timestamp: new Date().toISOString(),
    });

    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: contentParts,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    console.log("[RENDER-AI-FINALIZE] Resposta da IA recebida:", {
      status: response.status,
      statusOk: response.ok,
      timestamp: new Date().toISOString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[RENDER-AI-FINALIZE] Erro HTTP da IA Gateway:", {
        status: response.status,
        statusText: response.statusText,
        body: errText.slice(0, 500),
      });

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway returned ${response.status}: ${errText}`);
    }

    const data = await response.json();

    console.log("[RENDER-AI-FINALIZE] Dados da resposta:", {
      choices_length: data.choices?.length,
      message_content_type: typeof data.choices?.[0]?.message?.content,
      images_length: data.choices?.[0]?.message?.images?.length,
      primeira_imagem_url: data.choices?.[0]?.message?.images?.[0]?.image_url?.url ? "✓ presente" : "✗ faltando",
    });

    const renderedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const aiMessage = data.choices?.[0]?.message?.content || "";

    if (!renderedImageUrl) {
      console.error("[RENDER-AI-FINALIZE] No image in AI response:", JSON.stringify(data).slice(0, 500));
      throw new Error("AI did not return a rendered image. Try again.");
    }

    console.log("[RENDER-AI-FINALIZE] ===== SUCESSO =====");
    console.log("[RENDER-AI-FINALIZE] Imagem renderizada:", {
      url_length: renderedImageUrl.length,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        renderedImageUrl,
        message: aiMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[RENDER-AI-FINALIZE] ===== ERRO =====");
    console.error("[RENDER-AI-FINALIZE] Erro completo:", {
      mensagem: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
      tipo: e instanceof Error ? e.constructor.name : typeof e,
      timestamp: new Date().toISOString(),
    });
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
