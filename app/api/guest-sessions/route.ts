import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function cookieName(galleryId: string) {
  return `gs_${galleryId}`;
}

// Guests never authenticate, so this mints/updates a real guest_sessions
// row matching the client-generated guestSessionId (lib/guest-session.ts,
// localStorage) — the only way this anonymous identity model can have a
// row that other tables' foreign keys can reference.
//
// The client-supplied id alone isn't proof of ownership — media rows (and
// therefore guest_session_id values) are visible to every guest browsing
// the gallery, so anyone could otherwise rename another guest by replaying
// their session id here. An httpOnly cookie records which session id this
// browser has legitimately claimed for this gallery.
//
// This only blocks a *mismatch* (this browser already claims a different
// session, now trying to overwrite someone else's) — an *absent* cookie is
// treated as unverifiable-but-allowed, so a guest who cleared cookies, is on
// a new device, or had a session created before this cookie existed isn't
// permanently locked out of renaming themselves. That keeps the realistic
// griefing case blocked without turning a low-stakes display-name field
// into a hard account system.
export async function POST(request: Request) {
  const { galleryId, guestSessionId, guestName } = await request.json();

  if (!galleryId || !guestSessionId) {
    return NextResponse.json({ error: "galleryId and guestSessionId are required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const cookieStore = await cookies();
  const ownershipCookie = cookieStore.get(cookieName(galleryId))?.value;

  if (ownershipCookie && ownershipCookie !== guestSessionId) {
    return NextResponse.json({ error: "Not authorized to modify this guest session" }, { status: 403 });
  }

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

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName(galleryId), guestSessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
