/**
 * Shared AI utilities for Edge Functions.
 * Centralizes image extraction and upload logic to avoid duplication.
 */

/**
 * Extracts the image URL from an AI API response, handling multiple formats.
 * Supports: images array (url/base64), content array, data array (b64_json/url).
 */
export function extractImageUrl(choice: any): string | null {
  if (!choice) return null;

  // Format 1: images array with image_url.url
  if (choice.images?.[0]?.image_url?.url) {
    return choice.images[0].image_url.url;
  }
  // Format 2: images array with inline base64
  if (choice.images?.[0]?.inline_data) {
    const img = choice.images[0].inline_data;
    return `data:${img.mime_type || "image/png"};base64,${img.data}`;
  }
  // Format 3: content array with image parts
  if (Array.isArray(choice.content)) {
    const imgPart = choice.content.find(
      (p: any) => p.type === "image_url" || p.type === "image"
    );
    if (imgPart?.image_url?.url) {
      return imgPart.image_url.url;
    } else if (imgPart?.inline_data) {
      return `data:${imgPart.inline_data.mime_type || "image/png"};base64,${imgPart.inline_data.data}`;
    }
  }

  return null;
}

/**
 * Extracts the image URL from a full API response object (top-level data field).
 * Handles data[].b64_json and data[].url formats.
 */
export function extractImageUrlFromResponse(data: any): string | null {
  // Try from choices first
  const fromChoice = extractImageUrl(data?.choices?.[0]?.message);
  if (fromChoice) return fromChoice;

  // Format 4: direct base64 in data field
  if (data?.data?.[0]?.b64_json) {
    return `data:image/png;base64,${data.data[0].b64_json}`;
  }
  // Format 5: direct url in data field
  if (data?.data?.[0]?.url) {
    return data.data[0].url;
  }

  return null;
}

/**
 * Uploads a base64 image to Supabase Storage and returns the public URL.
 */
export async function uploadImageToStorage(
  supabase: any,
  imageData: string,
  bucket: string,
  path: string
): Promise<string | null> {
  try {
    const base64Part = imageData.includes(",")
      ? imageData.split(",")[1]
      : imageData;
    const imageBytes = Uint8Array.from(atob(base64Part), (c) =>
      c.charCodeAt(0)
    );

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, imageBytes, { contentType: "image/png", upsert: true });

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    return publicUrl.publicUrl;
  } catch (e) {
    console.error("Error uploading image:", e);
    return null;
  }
}
