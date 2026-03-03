import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VIDEO_API_ENDPOINT = Deno.env.get("VIDEO_GENERATION_API_ENDPOINT");
const VIDEO_API_KEY = Deno.env.get("VIDEO_GENERATION_API_KEY");

interface VideoRequest {
  assetId: string;
  animationStyle: "subtle_zoom" | "dynamic_pan" | "text_focus";
  musicTrack: "corporate" | "ambient" | "energetic";
  videoFormat: "9:16" | "1:1" | "4:5";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!VIDEO_API_ENDPOINT || !VIDEO_API_KEY) {
      throw new Error("API de geração de vídeo não configurada. Configure VIDEO_GENERATION_API_ENDPOINT e VIDEO_GENERATION_API_KEY nos secrets do projeto.");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { assetId, animationStyle, musicTrack, videoFormat }: VideoRequest = await req.json();

    // 1. Fetch latest asset version
    const { data: assetVersion, error: versionError } = await supabase
      .from("asset_versions")
      .select("*")
      .eq("asset_id", assetId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (versionError || !assetVersion) throw new Error("Asset não encontrado.");

    // Fetch asset + project + dna
    const { data: asset } = await supabase
      .from("assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (!asset) throw new Error("Asset não encontrado.");

    const { data: dna } = await supabase
      .from("project_dna")
      .select("visual")
      .eq("project_id", asset.project_id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    // 2. Build video payload
    const visual = dna?.visual as any;
    const videoPayload = {
      template: "AdSimpleAnimation",
      inputProps: {
        imageUrl: assetVersion.image_url,
        headline: assetVersion.headline,
        body: assetVersion.body,
        cta: assetVersion.cta,
        format: videoFormat,
        animationStyle,
        musicTrack,
        brandColors: visual?.colors?.map((c: any) => c.hex) || ["#FFFFFF", "#000000"],
        brandFonts: visual?.fonts?.map((f: any) => f.name) || ["Inter", "Inter"],
      },
    };

    // 3. Call video generation API
    const videoResponse = await fetch(VIDEO_API_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VIDEO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(videoPayload),
    });

    if (!videoResponse.ok) {
      throw new Error(`API de vídeo retornou erro ${videoResponse.status}`);
    }

    const videoResult = await videoResponse.json();
    const videoUrl = videoResult.url;

    if (!videoUrl) throw new Error("URL do vídeo não retornada pela API.");

    // 4. Save new video asset
    const { data: newVideoAsset, error: newAssetError } = await supabase.from("assets").insert({
      project_id: asset.project_id,
      user_id: user.id,
      title: `Vídeo de: ${asset.title}`,
      output: "video",
      status: "draft",
      folder: asset.folder || "Vídeos",
      profile_used: asset.profile_used,
      provider_used: "VideoAPI",
      destination: asset.destination,
      preset: videoFormat,
      operation_mode: asset.operation_mode,
      format_label: `Vídeo ${videoFormat}`,
    }).select().single();

    if (newAssetError) throw newAssetError;

    await supabase.from("asset_versions").insert({
      asset_id: newVideoAsset.id,
      version: 1,
      headline: assetVersion.headline,
      body: assetVersion.body,
      cta: assetVersion.cta,
      video_url: videoUrl,
      image_url: assetVersion.image_url,
    });

    return new Response(JSON.stringify({ success: true, newAsset: newVideoAsset }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
