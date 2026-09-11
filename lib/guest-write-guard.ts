import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type GuestWriteFlag = "allow_uploads" | "allow_guestbook" | "allow_voice_messages" | "allow_photo_hunt";

// Every guest-write Route Handler (uploads, guestbook, voice, hunt) uses the
// service-role client, which bypasses RLS by design — so unlike public
// reads, these routes have to enforce tenant privacy themselves. Since
// 'private'/'password' galleries have no real access-control path yet
// (README/dashboard flag this), the safe default is: guest writes are only
// ever accepted for `privacy: 'public'` galleries, in addition to the
// specific allow_* flag for the feature being used.
export async function checkGalleryAllowsGuestWrite(
  supabase: AdminClient,
  galleryId: string,
  flag: GuestWriteFlag
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: settings } = await supabase
    .from("gallery_settings")
    .select("privacy, allow_uploads, allow_guestbook, allow_voice_messages, allow_photo_hunt")
    .eq("gallery_id", galleryId)
    .maybeSingle();

  if (!settings) return { ok: false, status: 404, error: "Gallery not found" };
  if (settings.privacy !== "public") {
    return { ok: false, status: 403, error: "This gallery isn't open to public contributions" };
  }
  if (settings[flag] === false) {
    return { ok: false, status: 403, error: "This feature is disabled for this gallery" };
  }
  return { ok: true };
}
