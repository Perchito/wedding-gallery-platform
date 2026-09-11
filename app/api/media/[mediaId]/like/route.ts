import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const { guestSessionId } = await request.json();
  if (!guestSessionId) {
    return NextResponse.json({ error: "guestSessionId is required" }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("media_likes")
    .upsert({ media_id: mediaId, guest_session_id: guestSessionId }, { onConflict: "media_id,guest_session_id" });
  if (error) {
    return NextResponse.json({ error: "Failed to like" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const { guestSessionId } = await request.json();
  if (!guestSessionId) {
    return NextResponse.json({ error: "guestSessionId is required" }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("media_likes")
    .delete()
    .eq("media_id", mediaId)
    .eq("guest_session_id", guestSessionId);
  if (error) {
    return NextResponse.json({ error: "Failed to unlike" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
