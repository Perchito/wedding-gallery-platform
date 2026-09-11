import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// The three analytics events with no other server round-trip to piggyback
// on (media_viewed, media_downloaded, hunt_started) — everything else is
// inserted directly inside the route handler that already does the work.
const CLIENT_EVENT_TYPES = new Set(["media_viewed", "media_downloaded", "hunt_started"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;
  const { eventType, guestSessionId, metadata } = await request.json();

  if (!CLIENT_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: "Unsupported event type" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  await supabase.from("analytics_events").insert({
    gallery_id: galleryId,
    guest_session_id: guestSessionId ?? null,
    event_type: eventType,
    metadata: metadata ?? null,
  });

  return NextResponse.json({ ok: true });
}
