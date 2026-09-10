// Shared client-side image upload helper: resize/compress via
// resizeForDevices (see ./responsive-image.ts), then push the compressed
// rendition to Supabase Storage and hand back its public URL.
//
// Every image-upload field in the app should go through this rather than
// storing an uploaded file at its original resolution — a phone photo or an
// AI-generated image can run several MB and several thousand pixels wide,
// which is wasted bandwidth when the same URL is reused for a small grid
// thumbnail.
import { supabase } from "@/integrations/supabase/client";
import { resizeForDevices, type SizedImage } from "@/lib/responsive-image";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header ?? "")?.[1] ?? "image/jpeg";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export type UploadCompressedImageResult = SizedImage & { url: string };

/**
 * Resize an uploaded file to the given device rendition (Desktop by default
 * — plenty for a hero/cover/thumbnail, a fraction of most camera originals),
 * upload it to `bucket`/`path`, and return its public URL.
 */
export async function uploadCompressedImage(
  file: File,
  bucket: string,
  path: string,
  rendition: SizedImage["label"] = "Desktop",
): Promise<UploadCompressedImageResult> {
  const sizes = await resizeForDevices(file);
  const picked = sizes.find((s) => s.label === rendition) ?? sizes[sizes.length - 1];
  const blob = dataUrlToBlob(picked.dataUrl);
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { ...picked, url: data.publicUrl };
}
