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
  x: number; // percentage 0-100
  y: number; // percentage 0-100
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

    const { imageUrl, layers, niche, ratio } = await req.json() as {
      imageUrl: string;
      layers: TextLayerMeta[];
      niche?: string;
      ratio?: string;
    };

    if (!imageUrl) throw new Error("imageUrl is required");
    if (!layers || layers.length === 0) throw new Error("At least one text layer is required");

    // Build text placement description for the AI
    const textDescription = layers.map((l) => {
      const position = describePosition(l.x, l.y);
      const fontDesc = l.fontFamily.replace(/'/g, "").split(",")[0].trim();
      return `- ${l.type.toUpperCase()}: "${l.content}" | Position: ${position} | Font: ${fontDesc} ${l.fontWeight >= 700 ? "Bold" : "Regular"} | Color: ${l.color} | Size: ${l.fontSize}pt | Align: ${l.textAlign}`;
    }).join("\n");

    const nicheContext = niche ? `The visual style is "${niche}" (e.g., mystical/tarot uses gold serif typography, tech uses clean sans-serif).` : "";
    const ratioContext = ratio ? `The image aspect ratio is ${ratio}.` : "";

    const prompt = `You are a professional graphic designer. Take this existing image and render the following text elements DIRECTLY INTO the image as if they were part of the original design. The text must look organically integrated — NOT like a sticker or overlay.

CRITICAL RULES:
1. PRESERVE the entire original image composition — do NOT alter the background scene, subjects, objects, or any visual elements
2. The text must appear as if it was PAINTED or PRINTED onto the scene — matching the lighting, shadows, grain, and texture of the image
3. Apply realistic depth: text should cast subtle shadows consistent with the image's light direction
4. If the background has texture (parchment, fabric, stone), the text should appear to be ON that surface
5. Match the grain and noise level of the AI-generated image so text doesn't look artificially clean
6. Use the exact fonts, colors, sizes, and positions specified below
7. Do NOT add any extra text, watermarks, borders, or design elements not specified

${nicheContext}
${ratioContext}

TEXT ELEMENTS TO RENDER:
${textDescription}

POSITION GUIDE:
- X and Y are percentages (0-100) from top-left corner
- Maintain the relative spacing between elements
- Text should flow naturally within the composition

STYLE:
- Headlines: Strong presence, editorial magazine quality, letter-spacing 0.1em
- Body text: Readable but integrated, slightly smaller
- CTA buttons: If present, render as a styled button element with the background color specified

Render this as a single cohesive, professional marketing image where text and image are ONE unified design.`;

    console.log("Sending render request to AI gateway...");

    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

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
    const renderedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const aiMessage = data.choices?.[0]?.message?.content || "";

    if (!renderedImageUrl) {
      console.error("No image in AI response:", JSON.stringify(data).slice(0, 500));
      throw new Error("AI did not return a rendered image. Try again.");
    }

    console.log("AI render successful, image received");

    return new Response(
      JSON.stringify({
        renderedImageUrl,
        message: aiMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("render-ai-finalize error:", e);
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
