import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GallerySettings } from "@/lib/types";
import type { QrCardSettings } from "@/lib/qr";

const FIELD_MAP: Record<keyof GallerySettings, string> = {
  allowUploads: "allow_uploads",
  allowBrowsing: "allow_browsing",
  allowDownloads: "allow_downloads",
  allowGuestbook: "allow_guestbook",
  allowVoiceMessages: "allow_voice_messages",
  allowPhotoHunt: "allow_photo_hunt",
  privacy: "privacy",
  qrCardSettings: "qr_card_settings",
};

// Owner-only — the cookie-aware client respects RLS, so a non-owner's
// update simply matches zero rows rather than needing an extra check here.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;
  const patch = (await request.json()) as Partial<GallerySettings>;

  const supabase = await createSupabaseServerClient();

  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "qrCardSettings" && value && typeof value === "object") {
      // The QR card customizer only sends the fields that actually changed
      // (its center-image upload can be tens of KB, not worth retransmitting
      // on every keystroke elsewhere), so this column is merged rather than
      // replaced outright — a plain overwrite would null out every field the
      // client left unsent.
      const { data: existing } = await supabase
        .from("gallery_settings")
        .select("qr_card_settings")
        .eq("gallery_id", galleryId)
        .maybeSingle();
      row.qr_card_settings = {
        ...((existing?.qr_card_settings as Partial<QrCardSettings> | null) ?? {}),
        ...(value as Partial<QrCardSettings>),
      };
      continue;
    }
    const column = FIELD_MAP[key as keyof GallerySettings];
    if (column) row[column] = value;
  }
  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "No valid settings provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("gallery_settings")
    .update(row)
    .eq("gallery_id", galleryId)
    .select("gallery_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
