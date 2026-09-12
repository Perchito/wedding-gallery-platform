import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET, getPublicMediaUrl } from "@/lib/supabase/storage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// Owner-authenticated hero-photo upload for the /create wizard.
// The guest upload pipeline (media/request-upload) needs an existing
// gallery, which doesn't exist yet while one is being created — so hero
// photos get their own endpoint. Files live under the owner's id in the
// media bucket; the public URL is stored on galleries.hero_image_url.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const mime = (file as File).type;
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: "Hero photo must be a JPG, PNG, or WebP image" },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Hero photo must be under 10 MB" }, { status: 413 });
  }

  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `heroes/${user.id}/${randomUUID()}.${ext}`;

  // Owners don't hold Storage write policies by design (guest media writes
  // go through per-upload signed URLs only), so after the auth check above
  // has proven who's calling, the upload itself uses the service-role
  // client — same pattern as voice-messages.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: mime,
  });
  if (error) {
    console.error("[hero-upload] storage upload failed:", error.message);
    return NextResponse.json({ error: "Failed to store hero photo" }, { status: 500 });
  }

  return NextResponse.json({ url: getPublicMediaUrl(path) });
}