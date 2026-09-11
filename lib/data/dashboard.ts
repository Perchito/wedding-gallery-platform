import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Gallery, GalleryStats, GallerySettings, MediaItem } from "@/lib/types";

interface SettingsRow {
  allow_uploads: boolean;
  allow_browsing: boolean;
  allow_downloads: boolean;
  allow_guestbook: boolean;
  allow_voice_messages: boolean;
  allow_photo_hunt: boolean;
  allow_face_search: boolean;
  privacy: GallerySettings["privacy"];
}

// One gallery per owner for the MVP admin dashboard — resolves via the
// authenticated session (middleware.ts already redirects to /login if
// there isn't one) rather than a slug in the URL. RLS scopes every query
// here to the caller's own rows regardless.
export async function getOwnerGallery(): Promise<{
  gallery: Gallery;
  stats: GalleryStats;
  media: MediaItem[];
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: galleryRow } = await supabase
    .from("galleries")
    .select("*, gallery_settings(*)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!galleryRow) return null;

  const settingsRow = (
    Array.isArray(galleryRow.gallery_settings) ? galleryRow.gallery_settings[0] : galleryRow.gallery_settings
  ) as SettingsRow | null;

  const gallery: Gallery = {
    id: galleryRow.id,
    slug: galleryRow.slug,
    eventName: galleryRow.event_name,
    partnerNames: [galleryRow.partner_a ?? "Partner 1", galleryRow.partner_b ?? "Partner 2"],
    eventDate: galleryRow.event_date ?? "",
    venue: galleryRow.venue ?? undefined,
    heroImageUrl: galleryRow.hero_image_url || "",
    description: galleryRow.description ?? undefined,
    owner: { id: user.id, name: user.user_metadata?.name ?? "", email: user.email ?? "" },
    settings: settingsRow
      ? {
          allowUploads: settingsRow.allow_uploads,
          allowBrowsing: settingsRow.allow_browsing,
          allowDownloads: settingsRow.allow_downloads,
          allowGuestbook: settingsRow.allow_guestbook,
          allowVoiceMessages: settingsRow.allow_voice_messages,
          allowPhotoHunt: settingsRow.allow_photo_hunt,
          allowFaceSearch: settingsRow.allow_face_search,
          privacy: settingsRow.privacy,
        }
      : {
          allowUploads: true,
          allowBrowsing: true,
          allowDownloads: true,
          allowGuestbook: true,
          allowVoiceMessages: true,
          allowPhotoHunt: true,
          allowFaceSearch: true,
          privacy: "public",
        },
    createdAt: galleryRow.created_at,
  };

  const [mediaRes, guestCountRes, messageCountRes, voiceCountRes, storageRes, huntChallengeCountRes, huntSubmissionCountRes] =
    await Promise.all([
      supabase
        .from("media")
        .select("*, media_categories(category)")
        .eq("gallery_id", gallery.id)
        .order("created_at", { ascending: false }),
      supabase.from("guest_sessions").select("id", { count: "exact", head: true }).eq("gallery_id", gallery.id),
      supabase
        .from("guestbook_messages")
        .select("id", { count: "exact", head: true })
        .eq("gallery_id", gallery.id),
      supabase.from("voice_messages").select("id", { count: "exact", head: true }).eq("gallery_id", gallery.id),
      supabase.from("storage_usage").select("bytes_used").eq("gallery_id", gallery.id).maybeSingle(),
      supabase.from("hunt_challenges").select("id", { count: "exact", head: true }).eq("gallery_id", gallery.id),
      supabase
        .from("hunt_submissions")
        .select("id, hunt_challenges!inner(gallery_id)", { count: "exact", head: true })
        .eq("hunt_challenges.gallery_id", gallery.id),
    ]);

  const media: MediaItem[] = (mediaRes.data ?? []).map((m) => ({
    id: m.id,
    galleryId: m.gallery_id,
    albumId: m.album_id,
    guestSessionId: m.guest_session_id ?? "",
    uploaderName: m.uploader_name ?? "Guest",
    type: m.media_type,
    originalUrl: m.original_url,
    thumbnailUrl: m.thumbnail_url ?? m.original_url,
    previewUrl: m.preview_url ?? m.original_url,
    width: m.width ?? 4,
    height: m.height ?? 5,
    durationSeconds: m.duration_seconds ?? undefined,
    caption: m.caption ?? undefined,
    categories: (m.media_categories ?? []).map((c: { category: MediaItem["categories"][number] }) => c.category),
    liked: false,
    processingStatus: m.processing_status,
    moderationStatus: m.moderation_status,
    createdAt: m.created_at,
  }));

  const photos = media.filter((m) => m.type === "photo" && m.moderationStatus !== "removed").length;
  const videos = media.filter((m) => m.type === "video" && m.moderationStatus !== "removed").length;
  const guests = guestCountRes.count ?? 0;
  const huntChallengeCount = huntChallengeCountRes.count ?? 0;
  const huntSubmissionCount = huntSubmissionCountRes.count ?? 0;
  const huntAvgCompletionPct =
    guests > 0 && huntChallengeCount > 0
      ? Math.round((huntSubmissionCount / (guests * huntChallengeCount)) * 100)
      : 0;

  const stats: GalleryStats = {
    photos,
    videos,
    totalMedia: photos + videos,
    guests,
    messages: messageCountRes.count ?? 0,
    voiceMessages: voiceCountRes.count ?? 0,
    storageUsedGb: Math.round(((storageRes.data?.bytes_used ?? 0) / 1e9) * 100) / 100,
    huntAvgCompletionPct,
  };

  return { gallery, stats, media };
}
