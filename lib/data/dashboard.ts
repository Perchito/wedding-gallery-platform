import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnerPlan, PLAN_LIMITS, type PlanId } from "@/lib/plans";
import type { Gallery, GalleryStats, GallerySettings, MediaItem } from "@/lib/types";

interface SettingsRow {
  allow_uploads: boolean;
  allow_browsing: boolean;
  allow_downloads: boolean;
  allow_guestbook: boolean;
  allow_voice_messages: boolean;
  allow_photo_hunt: boolean;
  privacy: GallerySettings["privacy"];
}

interface GalleryRow {
  id: string;
  slug: string;
  event_name: string;
  partner_a: string | null;
  partner_b: string | null;
  event_date: string | null;
  venue: string | null;
  hero_image_url: string | null;
  description: string | null;
  created_at: string;
  gallery_settings: SettingsRow[] | SettingsRow | null;
}

const DEFAULT_SETTINGS: GallerySettings = {
  allowUploads: true,
  allowBrowsing: true,
  allowDownloads: true,
  allowGuestbook: true,
  allowVoiceMessages: true,
  allowPhotoHunt: true,
  privacy: "public",
};

function mapGalleryRow(row: GalleryRow, owner: { id: string; name: string; email: string }): Gallery {
  const settingsRow = Array.isArray(row.gallery_settings) ? row.gallery_settings[0] : row.gallery_settings;
  return {
    id: row.id,
    slug: row.slug,
    eventName: row.event_name,
    partnerNames: [row.partner_a ?? "Partner 1", row.partner_b ?? "Partner 2"],
    eventDate: row.event_date ?? "",
    venue: row.venue ?? undefined,
    heroImageUrl: row.hero_image_url || "",
    description: row.description ?? undefined,
    owner,
    settings: settingsRow
      ? {
          allowUploads: settingsRow.allow_uploads,
          allowBrowsing: settingsRow.allow_browsing,
          allowDownloads: settingsRow.allow_downloads,
          allowGuestbook: settingsRow.allow_guestbook,
          allowVoiceMessages: settingsRow.allow_voice_messages,
          allowPhotoHunt: settingsRow.allow_photo_hunt,
          privacy: settingsRow.privacy,
        }
      : DEFAULT_SETTINGS,
    createdAt: row.created_at,
  };
}

export interface OwnerGalleryListItem {
  id: string;
  slug: string;
  eventName: string;
  partnerNames: [string, string];
  eventDate: string;
  heroImageUrl: string;
}

// Lightweight list of every gallery the signed-in user owns — RLS already
// scopes `galleries` to `owner_id = auth.uid()`, so no extra filter needed.
export async function getOwnerGalleries(): Promise<OwnerGalleryListItem[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("galleries")
    .select("id, slug, event_name, partner_a, partner_b, event_date, hero_image_url")
    .order("created_at", { ascending: false });
  if (error) console.error("[getOwnerGalleries] query failed:", error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    eventName: row.event_name,
    partnerNames: [row.partner_a ?? "Partner 1", row.partner_b ?? "Partner 2"],
    eventDate: row.event_date ?? "",
    heroImageUrl: row.hero_image_url || "",
  }));
}

// Gallery identity + settings only — for pages (schedule, QR card) that
// don't need the heavier stats/media queries below.
export async function getOwnerGalleryBasic(galleryId: string): Promise<Gallery | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: galleryRow } = await supabase
    .from("galleries")
    .select("*, gallery_settings(*)")
    .eq("id", galleryId)
    .maybeSingle();
  if (!galleryRow) return null;

  return mapGalleryRow(galleryRow as GalleryRow, {
    id: user.id,
    name: user.user_metadata?.name ?? "",
    email: user.email ?? "",
  });
}

// Full per-gallery admin dashboard data: gallery + computed stats + media
// list. RLS scopes every query to the caller's own galleries regardless.
export async function getOwnerGalleryWithStats(galleryId: string): Promise<{
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
    .eq("id", galleryId)
    .maybeSingle();
  if (!galleryRow) return null;

  const gallery = mapGalleryRow(galleryRow as GalleryRow, {
    id: user.id,
    name: user.user_metadata?.name ?? "",
    email: user.email ?? "",
  });

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

export interface OwnerPlanUsage {
  plan: PlanId;
  galleryCount: number;
  maxGalleries: number;
  storageUsedBytes: number;
  maxStorageBytes: number;
}

// Account-level plan + usage summary (not gallery-scoped) for the gallery
// list page's plan card.
export async function getOwnerPlanUsage(): Promise<OwnerPlanUsage | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const plan = await getOwnerPlan(supabase, user.id);
  const { count: galleryCount } = await supabase
    .from("galleries")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  const { data: usageRows } = await supabase
    .from("storage_usage")
    .select("bytes_used, galleries!inner(owner_id)")
    .eq("galleries.owner_id", user.id);
  const storageUsedBytes = (usageRows ?? []).reduce((sum, row) => sum + (row.bytes_used ?? 0), 0);

  return {
    plan,
    galleryCount: galleryCount ?? 0,
    maxGalleries: PLAN_LIMITS[plan].maxGalleries,
    storageUsedBytes,
    maxStorageBytes: PLAN_LIMITS[plan].maxStorageBytes,
  };
}
