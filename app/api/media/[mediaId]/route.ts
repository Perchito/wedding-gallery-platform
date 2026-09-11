import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/lib/supabase/storage";

// Owner-only (hide/restore/edit caption/change album, or hard delete).
// RLS on `media` scopes every row to the caller's own galleries, so an
// update/delete for a gallery the caller doesn't own just matches nothing.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const patch = await request.json();
  const row: Record<string, unknown> = {};
  if (typeof patch.moderationStatus === "string") row.moderation_status = patch.moderationStatus;
  if (typeof patch.caption === "string" || patch.caption === null) row.caption = patch.caption;
  if (typeof patch.albumId === "string") row.album_id = patch.albumId;

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media")
    .update(row)
    .eq("id", mediaId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Failed to update media" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: media, error: fetchError } = await supabase
    .from("media")
    .select("gallery_id")
    .eq("id", mediaId)
    .maybeSingle();
  if (fetchError || !media) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("media").delete().eq("id", mediaId);
  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete media" }, { status: 500 });
  }

  // Best-effort Storage cleanup — RLS-scoped delete above already proved
  // ownership, so use the admin client here (no storage RLS policies grant
  // authenticated users delete rights on objects, by design).
  const admin = createSupabaseAdminClient();
  await admin.storage.from(MEDIA_BUCKET).remove([
    `${media.gallery_id}/media/${mediaId}/original.jpg`,
    `${media.gallery_id}/media/${mediaId}/original.jpeg`,
    `${media.gallery_id}/media/${mediaId}/original.png`,
    `${media.gallery_id}/media/${mediaId}/original.heic`,
    `${media.gallery_id}/media/${mediaId}/original.mp4`,
    `${media.gallery_id}/media/${mediaId}/original.mov`,
    `${media.gallery_id}/media/${mediaId}/poster.jpg`,
  ]);

  return NextResponse.json({ ok: true });
}
