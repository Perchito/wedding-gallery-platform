import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Guests never authenticate, so this upserts the client-generated
// guestSessionId (lib/guest-session.ts, localStorage) into a real
// guest_sessions row using the service-role client — the only way this
// anonymous, no-signup identity model can have a row that other tables'
// foreign keys (media, guestbook_messages, hunt_submissions, ...) can
// reference.
export async function POST(request: Request) {
  const { galleryId, guestSessionId, guestName } = await request.json();

  if (!galleryId || !guestSessionId) {
    return NextResponse.json({ error: "galleryId and guestSessionId are required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("guest_sessions")
    .upsert(
      { id: guestSessionId, gallery_id: galleryId, guest_name: guestName ?? null },
      { onConflict: "id" }
    );

  if (error) {
    console.error("[guest-sessions] upsert failed:", error.message);
    return NextResponse.json({ error: "Failed to create guest session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
