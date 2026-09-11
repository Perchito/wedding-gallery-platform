import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkGalleryAllowsGuestWrite } from "@/lib/guest-write-guard";

// The client uploads the photo through the normal media pipeline first
// (lib/upload-media.ts), then calls this to link the resulting mediaId to
// a Photo Hunt challenge for this guest.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  const { challengeId } = await params;
  const { guestSessionId, mediaId } = await request.json();

  if (!guestSessionId || !mediaId) {
    return NextResponse.json({ error: "guestSessionId and mediaId are required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: challenge } = await supabase
    .from("hunt_challenges")
    .select("gallery_id")
    .eq("id", challengeId)
    .maybeSingle();
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  const guard = await checkGalleryAllowsGuestWrite(supabase, challenge.gallery_id, "allow_photo_hunt");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // The media being submitted must actually belong to this gallery and this
  // guest session — otherwise any guest could complete a challenge by
  // pointing at someone else's (or another gallery's) media id.
  const { data: media } = await supabase
    .from("media")
    .select("gallery_id, guest_session_id")
    .eq("id", mediaId)
    .maybeSingle();
  if (!media || media.gallery_id !== challenge.gallery_id || media.guest_session_id !== guestSessionId) {
    return NextResponse.json({ error: "Media does not belong to this guest or gallery" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("hunt_submissions")
    .upsert(
      { challenge_id: challengeId, guest_session_id: guestSessionId, media_id: mediaId },
      { onConflict: "challenge_id,guest_session_id" }
    )
    .select()
    .single();

  if (error || !data) {
    console.error("[hunt/submissions] upsert failed:", error?.message);
    return NextResponse.json({ error: "Failed to record submission" }, { status: 500 });
  }

  return NextResponse.json({
    challengeId: data.challenge_id,
    guestSessionId: data.guest_session_id,
    mediaId: data.media_id,
    completedAt: data.completed_at,
  });
}
