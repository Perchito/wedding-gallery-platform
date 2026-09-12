import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkGalleryAllowsGuestWrite } from "@/lib/guest-write-guard";
import { MEDIA_BUCKET, buildVoicePath, getPublicMediaUrl } from "@/lib/supabase/storage";

const MAX_SECONDS = 60;

function voiceExt(mime: string) {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

// Step 2 of the direct-to-storage voice upload (step 1:
// …/voice-messages/request). The audio itself went straight from the
// browser to Storage; this just verifies it landed and records the row.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;
  const { voiceMessageId, guestSessionId, guestName, durationSeconds, mimeType } =
    (await request.json()) as {
      voiceMessageId?: string;
      guestSessionId?: string | null;
      guestName?: string | null;
      durationSeconds?: number;
      mimeType?: string;
    };

  if (!voiceMessageId) {
    return NextResponse.json({ error: "voiceMessageId is required" }, { status: 400 });
  }
  if (typeof durationSeconds === "number" && durationSeconds > MAX_SECONDS + 2) {
    return NextResponse.json({ error: "Recording exceeds 60 seconds" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const guard = await checkGalleryAllowsGuestWrite(supabase, galleryId, "allow_voice_messages");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const ext = voiceExt(mimeType || "audio/webm");
  const expectedName = `${voiceMessageId}.${ext}`;
  const { data: files } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(`${galleryId}/voice`);
  if (!files?.some((f) => f.name === expectedName)) {
    return NextResponse.json({ error: "Uploaded recording not found in storage" }, { status: 400 });
  }

  const audioUrl = getPublicMediaUrl(buildVoicePath(galleryId, voiceMessageId, ext));
  const { data, error } = await supabase
    .from("voice_messages")
    .insert({
      id: voiceMessageId,
      gallery_id: galleryId,
      guest_session_id: guestSessionId ?? null,
      guest_name: guestName ?? null,
      audio_url: audioUrl,
      duration_seconds: durationSeconds ?? 0,
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