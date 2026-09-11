import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  Album,
  CategoryId,
  GuestbookMessage,
  HuntCategory,
  HuntChallenge,
  MediaItem,
  ScheduleEntry,
  VoiceMessage,
} from "@/lib/types";

export interface GalleryContent {
  albums: Album[];
  media: MediaItem[];
  messages: GuestbookMessage[];
  voiceMessages: VoiceMessage[];
  huntCategories: HuntCategory[];
  huntChallenges: HuntChallenge[];
  schedule: ScheduleEntry[];
}

const EMPTY: GalleryContent = {
  albums: [],
  media: [],
  messages: [],
  voiceMessages: [],
  huntCategories: [],
  huntChallenges: [],
  schedule: [],
};

// Everything a public gallery page needs beyond the gallery row itself
// (lib/data/galleries.ts). One place so app/g/[slug]/page.tsx stays thin.
export async function getGalleryContent(galleryId: string): Promise<GalleryContent> {
  if (!isSupabaseConfigured()) return EMPTY;

  try {
    const supabase = await createSupabaseServerClient();

    const [albumsRes, mediaRes, messagesRes, voiceRes, huntCatRes, huntChallengeRes, scheduleRes] =
      await Promise.all([
        supabase.from("albums").select("*").eq("gallery_id", galleryId).order("sort_order"),
        supabase
          .from("media")
          .select("*, media_categories(category)")
          .eq("gallery_id", galleryId)
          .order("created_at", { ascending: false }),
        supabase
          .from("guestbook_messages")
          .select("*")
          .eq("gallery_id", galleryId)
          .order("created_at"),
        supabase.from("voice_messages").select("*").eq("gallery_id", galleryId).order("created_at"),
        supabase.from("hunt_categories").select("*").eq("gallery_id", galleryId).order("sort_order"),
        supabase
          .from("hunt_challenges")
          .select("*")
          .eq("gallery_id", galleryId)
          .order("sort_order"),
        supabase.from("event_schedule").select("*").eq("gallery_id", galleryId).order("sort_order"),
      ]);

    return {
      albums: (albumsRes.data ?? []).map(
        (a): Album => ({
          id: a.id,
          galleryId: a.gallery_id,
          name: a.name,
          icon: a.icon ?? "image",
          sortOrder: a.sort_order,
          visibility: a.visibility,
        })
      ),
      media: (mediaRes.data ?? []).map(
        (m): MediaItem => ({
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
          categories: (m.media_categories ?? []).map(
            (c: { category: CategoryId }) => c.category
          ),
          liked: false,
          processingStatus: m.processing_status,
          moderationStatus: m.moderation_status,
          createdAt: m.created_at,
        })
      ),
      messages: (messagesRes.data ?? [])
        .filter((msg) => msg.approval_status === "approved")
        .map(
          (msg): GuestbookMessage => ({
            id: msg.id,
            galleryId: msg.gallery_id,
            guestSessionId: msg.guest_session_id ?? "",
            guestName: msg.guest_name,
            message: msg.message,
            createdAt: msg.created_at,
            approvalStatus: msg.approval_status,
          })
        ),
      voiceMessages: (voiceRes.data ?? []).map(
        (v): VoiceMessage => ({
          id: v.id,
          galleryId: v.gallery_id,
          guestSessionId: v.guest_session_id ?? "",
          guestName: v.guest_name,
          audioUrl: v.audio_url,
          durationSeconds: v.duration_seconds ?? 0,
          createdAt: v.created_at,
        })
      ),
      huntCategories: (huntCatRes.data ?? []).map(
        (c): HuntCategory => ({ id: c.id, label: c.label })
      ),
      huntChallenges: (huntChallengeRes.data ?? []).map(
        (c): HuntChallenge => ({
          id: c.id,
          categoryId: c.category_id ?? "",
          title: c.title,
          prompt: c.prompt ?? "",
        })
      ),
      schedule: (scheduleRes.data ?? []).map(
        (s): ScheduleEntry => ({
          id: s.id,
          galleryId: s.gallery_id,
          time: s.time,
          title: s.title,
          description: s.description ?? undefined,
          sortOrder: s.sort_order,
        })
      ),
    };
  } catch (err) {
    console.error("[supabase] getGalleryContent threw:", err);
    return EMPTY;
  }
}
