import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkGalleryAllowsGuestWrite } from "@/lib/guest-write-guard";
import { MEDIA_BUCKET, buildVoicePath } from "@/lib/supabase/storage";

const MAX_BYTES = 15 * 1024 * 1024;

// Voice recordings are browser-dependent (webm on Chrome, wav on iOS via
// the WAV fallback). Map the reported mime to a sane extension.
function voiceExt(mime: string) {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

// Step 1 of the direct-to-storage voice upload: mint a signed upload URL so
// the browser can PUT the audio straight to Supabase Storage instead of
// proxying the file through this server (which doubled upload times on
// mobile). POST …/voice-messages (step 2) finalises the row afterwards.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;
  const { mimeType, fileSize } = (await request.json()) as {
    mimeType?: string;
    fileSize?: number;
  };

  if (typeof mimeType !== "string" || !mimeType.startsWith("audio/")) {
    return NextResponse.json({ error: "Unsupported audio type" }, { status: 415 });
  }
  if (typeof fileSize === "number" && fileSize > MAX_BYTES) {
    return NextResponse.json({ error: "Recording is too large" }, { status: 413 });
  }

  const supabase = createSupabaseAdminClient();
  const guard = await checkGalleryAllowsGuestWrite(supabase, galleryId, "allow_voice_messages");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const id = randomUUID();
  const path = buildVoicePath(galleryId, id, voiceExt(mimeType));
  const { data: signed, error: signError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (signError || !signed) {
    console.error("[voice-messages/request] createSignedUploadUrl failed:", signError?.message);
    return NextResponse.json({ error: "Failed to prepare upload" }, { status: 500 });
  }

  return NextResponse.json({
    id,
    path: signed.path,
    token: signed.token,
    signedUrl: signed.signedUrl,
  });
}