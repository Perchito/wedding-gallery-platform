import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET, buildOriginalPath, buildPosterPath, extFromMimeOrName } from "@/lib/supabase/storage";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "video/mp4",
  "video/quicktime",
]);

export async function POST(
  request: Request,
  // Named `galleryId` to match sibling routes under app/api/galleries/[galleryId]/**
  // (Next.js requires one dynamic segment name per path level) — the value
  // is actually the gallery's slug, since the client only knows the slug.
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId: gallerySlug } = await params;
  const body = await request.json();
  const { fileName, mimeType, fileSize, guestSessionId, isVideo } = body as {
    fileName: string;
    mimeType: string;
    fileSize: number;
    guestSessionId: string;
    isVideo: boolean;
  };

  if (!fileName || !mimeType || !fileSize || !guestSessionId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: "File exceeds the size limit" }, { status: 413 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: gallery, error: galleryError } = await supabase
    .from("galleries")
    .select("id, gallery_settings(allow_uploads)")
    .eq("slug", gallerySlug)
    .maybeSingle();

  if (galleryError || !gallery) {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }
  const settings = Array.isArray(gallery.gallery_settings)
    ? gallery.gallery_settings[0]
    : gallery.gallery_settings;
  if (settings && settings.allow_uploads === false) {
    return NextResponse.json({ error: "Uploads are disabled for this gallery" }, { status: 403 });
  }

  const mediaId = randomUUID();
  const ext = extFromMimeOrName(mimeType, fileName);
  const originalPath = buildOriginalPath(gallery.id, mediaId, ext);

  const { data: signed, error: signError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(originalPath);

  if (signError || !signed) {
    console.error("[request-upload] createSignedUploadUrl failed:", signError?.message);
    return NextResponse.json({ error: "Failed to prepare upload" }, { status: 500 });
  }

  let posterUpload: { path: string; token: string; signedUrl: string } | null = null;
  if (isVideo) {
    const posterPath = buildPosterPath(gallery.id, mediaId);
    const { data: posterSigned, error: posterError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(posterPath);
    if (posterError || !posterSigned) {
      console.error("[request-upload] poster createSignedUploadUrl failed:", posterError?.message);
    } else {
      posterUpload = { path: posterPath, token: posterSigned.token, signedUrl: posterSigned.signedUrl };
    }
  }

  return NextResponse.json({
    mediaId,
    galleryId: gallery.id,
    original: { path: originalPath, token: signed.token, signedUrl: signed.signedUrl },
    poster: posterUpload,
  });
}
