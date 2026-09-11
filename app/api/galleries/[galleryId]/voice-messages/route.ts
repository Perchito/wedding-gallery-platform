import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkGalleryAllowsGuestWrite } from "@/lib/guest-write-guard";
import { MEDIA_BUCKET, buildVoicePath, getPublicMediaUrl } from "@/lib/supabase/storage";

const MAX_SECONDS = 60;
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;
  const formData = await request.formData();
  const audio = formData.get("audio");
  const guestSessionId = formData.get("guestSessionId")?.toString() ?? null;
  const guestName = formData.get("guestName")?.toString() || null;
  const durationSeconds = Number(formData.get("durationSeconds") ?? 0);

  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "Recording is too large" }, { status: 413 });
  }
  if (durationSeconds > MAX_SECONDS + 2) {
    return NextResponse.json({ error: "Recording exceeds 60 seconds" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const guard = await checkGalleryAllowsGuestWrite(supabase, galleryId, "allow_voice_messages");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const id = randomUUID();
  const path = buildVoicePath(galleryId, id);
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, audio, { contentType: "audio/webm" });
  if (uploadError) {
    console.error("[voice-messages] storage upload failed:", uploadError.message);
    return NextResponse.json({ error: "Failed to store recording" }, { status: 500 });
  }

  const audioUrl = getPublicMediaUrl(path);
  const { data, error } = await supabase
    .from("voice_messages")
    .insert({
      id,
      gallery_id: galleryId,
      guest_session_id: guestSessionId,
      guest_name: guestName,
      audio_url: audioUrl,
      duration_seconds: durationSeconds,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[voice-messages] insert failed:", error?.message);
    return NextResponse.json({ error: "Failed to save voice message" }, { status: 500 });
  }

  await supabase.from("analytics_events").insert({
    gallery_id: galleryId,
    guest_session_id: guestSessionId,
    event_type: "voice_message",
  });

  return NextResponse.json({
    id: data.id,
    galleryId: data.gallery_id,
    guestSessionId: data.guest_session_id,
    guestName: data.guest_name,
    audioUrl: data.audio_url,
    durationSeconds: data.duration_seconds,
    createdAt: data.created_at,
  });
}
