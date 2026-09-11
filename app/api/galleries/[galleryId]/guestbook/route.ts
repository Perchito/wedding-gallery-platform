import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkGalleryAllowsGuestWrite } from "@/lib/guest-write-guard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;
  const { guestSessionId, guestName, message } = await request.json();

  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const guard = await checkGalleryAllowsGuestWrite(supabase, galleryId, "allow_guestbook");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const id = randomUUID();
  const { data, error } = await supabase
    .from("guestbook_messages")
    .insert({
      id,
      gallery_id: galleryId,
      guest_session_id: guestSessionId ?? null,
      guest_name: guestName ?? null,
      message: message.trim(),
      // No AI moderation in this pass — messages publish immediately;
      // the owner can hide/delete them from the dashboard.
      approval_status: "approved",
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[guestbook] insert failed:", error?.message);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  await supabase.from("analytics_events").insert({
    gallery_id: galleryId,
    guest_session_id: guestSessionId ?? null,
    event_type: "guestbook_message",
  });

  return NextResponse.json({
    id: data.id,
    galleryId: data.gallery_id,
    guestSessionId: data.guest_session_id,
    guestName: data.guest_name,
    message: data.message,
    createdAt: data.created_at,
    approvalStatus: data.approval_status,
  });
}
