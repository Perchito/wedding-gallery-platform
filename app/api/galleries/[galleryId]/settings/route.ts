import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GallerySettings } from "@/lib/types";

const FIELD_MAP: Record<keyof GallerySettings, string> = {
  allowUploads: "allow_uploads",
  allowBrowsing: "allow_browsing",
  allowDownloads: "allow_downloads",
  allowGuestbook: "allow_guestbook",
  allowVoiceMessages: "allow_voice_messages",
  allowPhotoHunt: "allow_photo_hunt",
  privacy: "privacy",
};

// Owner-only — the cookie-aware client respects RLS, so a non-owner's
// update simply matches zero rows rather than needing an extra check here.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;
  const patch = (await request.json()) as Partial<GallerySettings>;

  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = FIELD_MAP[key as keyof GallerySettings];
    if (column) row[column] = value;
  }
  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "No valid settings provided" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gallery_settings")
    .update(row)
    .eq("gallery_id", galleryId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
