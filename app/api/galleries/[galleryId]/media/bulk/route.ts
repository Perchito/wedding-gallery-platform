import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Owner-only bulk hide/restore/delete, scoped by RLS to the caller's own
// gallery via the `media` policy — an id list containing another tenant's
// media simply matches nothing for those rows.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;
  const { mediaIds, action } = (await request.json()) as {
    mediaIds: string[];
    action: "hide" | "restore" | "delete";
  };

  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    return NextResponse.json({ error: "mediaIds is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  if (action === "delete") {
    const { error } = await supabase
      .from("media")
      .delete()
      .eq("gallery_id", galleryId)
      .in("id", mediaIds);
    if (error) return NextResponse.json({ error: "Bulk delete failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("media")
    .update({ moderation_status: action === "hide" ? "removed" : "approved" })
    .eq("gallery_id", galleryId)
    .in("id", mediaIds);
  if (error) return NextResponse.json({ error: "Bulk update failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
