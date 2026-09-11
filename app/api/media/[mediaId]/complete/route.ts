import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkGalleryAllowsGuestWrite } from "@/lib/guest-write-guard";
import { MEDIA_BUCKET, buildOriginalPath, buildPosterPath, getPublicMediaUrl } from "@/lib/supabase/storage";
import type { CategoryId } from "@/lib/types";

interface CompleteBody {
  galleryId: string;
  albumId: string;
  guestSessionId: string;
  uploaderName: string | null;
  caption: string | null;
  mediaType: "photo" | "video";
  ext: string;
  hasPoster: boolean;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const body = (await request.json()) as CompleteBody;
  const {
    galleryId,
    albumId,
    guestSessionId,
    uploaderName,
    caption,
    mediaType,
    ext,
    hasPoster,
    width,
    height,
    durationSeconds,
  } = body;

  const supabase = createSupabaseAdminClient();

  // /complete is independently callable (not just reachable via
  // request-upload), so re-check the gallery actually allows uploads here
  // too rather than trusting that request-upload's earlier check still holds.
  const guard = await checkGalleryAllowsGuestWrite(supabase, galleryId, "allow_uploads");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // The album must actually belong to this gallery — otherwise a caller
  // could pass another tenant's albumId and have their media categorized/
  // attributed into a gallery they don't own.
  const { data: album } = await supabase
    .from("albums")
    .select("name, gallery_id")
    .eq("id", albumId)
    .maybeSingle();
  if (!album || album.gallery_id !== galleryId) {
    return NextResponse.json({ error: "Album does not belong to this gallery" }, { status: 400 });
  }

  const originalPath = buildOriginalPath(galleryId, mediaId, ext);
  const { data: exists } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(`${galleryId}/media/${mediaId}`);
  const originalEntry = exists?.find((e) => e.name.startsWith("original."));
  if (!originalEntry) {
    return NextResponse.json({ error: "Uploaded file not found in storage" }, { status: 400 });
  }
  // Trust Storage's own record of the uploaded size, not whatever the
  // client claims — the client already proved it can write this exact
  // object (via its signed URL), so this is the real size either way.
  const fileSize = (originalEntry.metadata?.size as number | undefined) ?? 0;

  const originalUrl = getPublicMediaUrl(originalPath);
  const posterUrl = hasPoster ? getPublicMediaUrl(buildPosterPath(galleryId, mediaId)) : null;

  const categories: CategoryId[] = [mediaType === "video" ? "videos" : "photos"];
  const albumCategory = album?.name?.toLowerCase();
  if (albumCategory === "speeches" || albumCategory === "ceremony" || albumCategory === "couple") {
    categories.push(albumCategory as CategoryId);
  }

  const { error: insertError } = await supabase.from("media").insert({
    id: mediaId,
    gallery_id: galleryId,
    album_id: albumId,
    guest_session_id: guestSessionId,
    uploader_name: uploaderName,
    media_type: mediaType,
    original_url: originalUrl,
    thumbnail_url: mediaType === "video" ? posterUrl : originalUrl,
    preview_url: mediaType === "video" ? posterUrl : originalUrl,
    width,
    height,
    duration_seconds: durationSeconds,
    caption,
    processing_status: "ready",
    moderation_status: "approved",
  });

  if (insertError) {
    console.error("[media/complete] insert failed:", insertError.message);
    return NextResponse.json({ error: "Failed to save media" }, { status: 500 });
  }

  await supabase.from("media_categories").insert(
    categories.map((category) => ({ media_id: mediaId, category }))
  );

  const { data: usage } = await supabase
    .from("storage_usage")
    .select("bytes_used")
    .eq("gallery_id", galleryId)
    .maybeSingle();
  await supabase
    .from("storage_usage")
    .upsert(
      { gallery_id: galleryId, bytes_used: (usage?.bytes_used ?? 0) + fileSize, updated_at: new Date().toISOString() },
      { onConflict: "gallery_id" }
    );

  await supabase.from("analytics_events").insert({
    gallery_id: galleryId,
    guest_session_id: guestSessionId,
    event_type: "upload_completed",
    metadata: { mediaType, fileSize },
  });

  return NextResponse.json({
    id: mediaId,
    galleryId,
    albumId,
    guestSessionId,
    uploaderName: uploaderName ?? "You",
    type: mediaType,
    originalUrl,
    thumbnailUrl: mediaType === "video" ? posterUrl : originalUrl,
    previewUrl: mediaType === "video" ? posterUrl : originalUrl,
    width,
    height,
    durationSeconds,
    caption: caption ?? undefined,
    categories,
    liked: false,
    processingStatus: "ready",
    moderationStatus: "approved",
    createdAt: new Date().toISOString(),
  });
}
