import { ZipArchive } from "archiver";
import { PassThrough, Readable } from "node:stream";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// Synchronous streaming ZIP export — appropriate for a single event's worth
// of media (dozens to low hundreds of items). If a gallery grows large
// enough to blow past Vercel's function duration, this is the swap point
// for a pgmq/pg_cron background-job version (same request contract).
const MAX_ITEMS = 500;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;

  // RLS-scoped read proves the caller owns this gallery before we do any
  // privileged Storage downloads via the admin client below.
  const supabase = await createSupabaseServerClient();
  const { data: gallery } = await supabase
    .from("galleries")
    .select("id, slug")
    .eq("id", galleryId)
    .maybeSingle();
  if (!gallery) {
    return new Response(JSON.stringify({ error: "Not found or not authorized" }), { status: 404 });
  }

  const { data: media, error } = await supabase
    .from("media")
    .select("id, original_url, media_type")
    .eq("gallery_id", galleryId)
    .neq("moderation_status", "removed")
    .limit(MAX_ITEMS);

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to list media" }), { status: 500 });
  }
  if (!media || media.length === 0) {
    return new Response(JSON.stringify({ error: "No media to export" }), { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  (async () => {
    for (const item of media) {
      try {
        const path = new URL(item.original_url).pathname.split(`/${MEDIA_BUCKET}/`)[1];
        if (!path) continue;
        const { data: fileData } = await admin.storage.from(MEDIA_BUCKET).download(path);
        if (!fileData) continue;
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const ext = item.media_type === "video" ? path.split(".").pop() : path.split(".").pop();
        archive.append(buffer, { name: `${item.id}.${ext || "jpg"}` });
      } catch (err) {
        console.error("[export] failed to add media to zip:", item.id, err);
      }
    }
    archive.finalize();
  })();

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${gallery.slug}-gallery.zip"`,
    },
  });
}
