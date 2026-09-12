"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET } from "@/lib/supabase/storage";
import { captureVideoPoster } from "@/lib/video-poster";
import { readImageDimensions } from "@/lib/image-dimensions";
import type { MediaItem } from "@/lib/types";

export interface UploadMediaInput {
  gallerySlug: string;
  file: File;
  albumId: string;
  caption?: string;
  guestSessionId: string;
  guestName: string | null;
  onProgress?: (pct: number) => void;
}

// Large phone photos (recent iPhones routinely produce 4–12 MB images) take
// a long time up on venue 4G. Above this threshold the photo is re-encoded
// client-side at ≤3024 px on the long edge (JPEG q0.9 — print quality),
// typically cutting size and upload time 3–5×. Smaller photos upload
// byte-for-byte untouched, as do videos and HEIC (which browsers can't
// reliably decode into a canvas anyway).
const COMPRESS_ABOVE_BYTES = 4 * 1024 * 1024;
const COMPRESS_MAX_EDGE = 3024;
const COMPRESS_QUALITY = 0.9;

async function maybeCompressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  if (file.size <= COMPRESS_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, COMPRESS_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", COMPRESS_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file; // no actual gain — keep the original
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    // Optimisation must never block an upload.
    return file;
  }
}

// The storage PUT reports no progress events (supabase-js doesn't expose
// upload progress), so ease the bar from `from` → `to` at an estimated
// mobile rate instead of letting it sit frozen — perceived upload time was
// the actual complaint being fixed here.
function startProgressSmoothing(
  onProgress: ((pct: number) => void) | undefined,
  bytes: number,
  from: number,
  to: number
) {
  if (!onProgress) return () => {};
  const ESTIMATED_BYTES_PER_SEC = 1.5 * 1024 * 1024;
  const estimatedMs = Math.max(4000, (bytes / ESTIMATED_BYTES_PER_SEC) * 1000);
  const start = Date.now();
  const timer = setInterval(() => {
    const ratio = Math.min(1, (Date.now() - start) / estimatedMs);
    // ease-out — decelerates as it approaches the cap rather than sprinting
    const eased = 1 - Math.pow(1 - ratio, 2);
    onProgress(Math.round(from + eased * (to - from)));
  }, 250);
  return () => clearInterval(timer);
}

// The one real-upload code path: request a signed Storage upload URL,
// PUT the file (and, for video, a client-captured poster frame) directly
// to Supabase Storage, then tell the server to finalize the media row.
// Called by both components/upload/UploadSheet.tsx and
// lib/offline-upload-drain.ts so there's a single implementation.
export async function uploadMedia(input: UploadMediaInput): Promise<MediaItem> {
  const { gallerySlug, albumId, caption, guestSessionId, guestName, onProgress } = input;
  const isVideo = input.file.type.startsWith("video/");
  onProgress?.(5);

  const file = await maybeCompressPhoto(input.file);

  const requestRes = await fetch(`/api/galleries/${gallerySlug}/media/request-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      guestSessionId,
      isVideo,
    }),
  });
  if (!requestRes.ok) {
    const err = await requestRes.json().catch(() => ({}));
    throw new Error(err.error || "Failed to request upload URL");
  }
  const { mediaId, galleryId, original, poster } = await requestRes.json();
  onProgress?.(20);

  const supabase = createSupabaseBrowserClient();
  const stopSmoothing = startProgressSmoothing(onProgress, file.size, 20, 88);
  let uploadError: { message: string } | null = null;
  try {
    const result = await supabase.storage
      .from(MEDIA_BUCKET)
      .uploadToSignedUrl(original.path, original.token, file);
    uploadError = result.error;
  } finally {
    stopSmoothing();
  }
  if (uploadError) throw new Error(uploadError.message);
  onProgress?.(90);

  let hasPoster = false;
  let width: number | null = null;
  let height: number | null = null;
  let durationSeconds: number | null = null;

  if (isVideo) {
    try {
      const posterData = await captureVideoPoster(file);
      durationSeconds = posterData.durationSeconds;
      width = posterData.width;
      height = posterData.height;
      if (poster) {
        const { error: posterError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .uploadToSignedUrl(poster.path, poster.token, posterData.posterBlob);
        if (!posterError) hasPoster = true;
      }
    } catch (err) {
      console.error("[upload-media] poster capture failed:", err);
    }
  } else {
    try {
      const dims = await readImageDimensions(file);
      width = dims.width;
      height = dims.height;
    } catch (err) {
      console.error("[upload-media] dimension read failed (e.g. HEIC not decodable in-browser):", err);
    }
  }
  onProgress?.(95);

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const completeRes = await fetch(`/api/media/${mediaId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      galleryId,
      albumId,
      guestSessionId,
      uploaderName: guestName,
      caption: caption || null,
      mediaType: isVideo ? "video" : "photo",
      ext,
      hasPoster,
      width,
      height,
      durationSeconds,
    }),
  });
  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({}));
    throw new Error(err.error || "Failed to finalize upload");
  }
  onProgress?.(100);
  return (await completeRes.json()) as MediaItem;
}