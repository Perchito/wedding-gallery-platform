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

// The one real-upload code path: request a signed Storage upload URL,
// PUT the file (and, for video, a client-captured poster frame) directly
// to Supabase Storage, then tell the server to finalize the media row.
// Called by both components/upload/UploadSheet.tsx and
// lib/offline-upload-drain.ts so there's a single implementation.
export async function uploadMedia(input: UploadMediaInput): Promise<MediaItem> {
  const { gallerySlug, file, albumId, caption, guestSessionId, guestName, onProgress } = input;
  const isVideo = file.type.startsWith("video/");
  onProgress?.(5);

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
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .uploadToSignedUrl(original.path, original.token, file);
  if (uploadError) throw new Error(uploadError.message);
  onProgress?.(60);

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
  onProgress?.(85);

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
