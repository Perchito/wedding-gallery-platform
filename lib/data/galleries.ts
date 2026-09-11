import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Gallery, GallerySettings } from "@/lib/types";

// Server-side lookup of a gallery that lives in Supabase (created directly
// in the dashboard/SQL editor, or later via a real /create write path once
// there's an owner/auth model — see README "Wiring up a real backend").
// Returns null if Supabase isn't configured, the slug doesn't exist there,
// or the query fails; callers are expected to fall back to mock data /
// localStorage-created galleries in that case (see app/g/[slug]/page.tsx).
export async function getGalleryFromSupabase(slug: string): Promise<Gallery | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("galleries")
      .select("*, gallery_settings(*)")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("[supabase] getGalleryFromSupabase error:", error.message);
      return null;
    }
    if (!data) return null;

    return mapRowToGallery(data as GalleryRow);
  } catch (err) {
    console.error("[supabase] getGalleryFromSupabase threw:", err);
    return null;
  }
}

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
  owner_id: string;
  created_at: string;
  // Supabase returns the embedded one-to-one relation as an array unless
  // the FK's uniqueness is declared — handle both shapes defensively.
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

function mapRowToGallery(row: GalleryRow): Gallery {
  const settingsRow = Array.isArray(row.gallery_settings)
    ? row.gallery_settings[0]
    : row.gallery_settings;

  return {
    id: row.id,
    slug: row.slug,
    eventName: row.event_name,
    partnerNames: [row.partner_a ?? "Partner 1", row.partner_b ?? "Partner 2"],
    eventDate: row.event_date ?? "",
    venue: row.venue ?? undefined,
    heroImageUrl:
      row.hero_image_url ||
      `https://picsum.photos/seed/${encodeURIComponent(row.slug)}-hero/1600/1000`,
    description: row.description ?? undefined,
    // Owner profile isn't surfaced in the UI today, so we don't need a
    // second query to the `users` table just to populate name/email.
    owner: { id: row.owner_id, name: "", email: "" },
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
