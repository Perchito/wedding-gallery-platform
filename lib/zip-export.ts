import "server-only";
import archiver from "archiver";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET, storagePathFromPublicUrl } from "@/lib/supabase/storage";

const MAX_ITEMS = 500;

export interface BuildGalleryZipResult {
  buffer: Buffer;
  itemCount: number;
}

// Shared by both the (legacy, still-referenced-for-logic) idea of a
// synchronous export and the background worker in
// app/api/cron/process-zip-jobs/route.ts — buffers the whole archive in
// memory, which is fine at "one event's worth of media" scale.
export async function buildGalleryZip(galleryId: string): Promise<BuildGalleryZipResult> {
  const admin = createSupabaseAdminClient();

  const { data: media, error } = await admin
    .from("media")
    .select("id, original_url, media_type")
    .eq("gallery_id", galleryId)
    .neq("moderation_status", "removed")
    .limit(MAX_ITEMS);

  if (error) throw new Error(`Failed to list media: ${error.message}`);
  if (!media || media.length === 0) throw new Error("No media to export");

  const archive = archiver("zip", { zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  let addedCount = 0;
  for (const item of media) {
    try {
      const path = storagePathFromPublicUrl(item.original_url);
      if (!path) {
        console.error("[buildGalleryZip] could not parse storage path:", item.id, item.original_url);
        continue;
      }
      const { data: fileData, error: downloadError } = await admin.storage.from(MEDIA_BUCKET).download(path);
      if (downloadError || !fileData) {
        console.error("[buildGalleryZip] download failed:", item.id, path, downloadError?.message);
        continue;
      }
      const buffer = Buffer.from(await fileData.arrayBuffer());
      const ext = path.split(".").pop();
      archive.append(buffer, { name: `${item.id}.${ext || "jpg"}` });
      addedCount++;
    } catch (err) {
      console.error("[buildGalleryZip] failed to add media to zip:", item.id, err);
    }
  }

  if (addedCount === 0) {
    throw new Error("Every media file failed to download — see logs for per-item errors");
  }

  // archiver v8's finalize() returns a promise tied to the internal
  // module's actual completion — awaiting it (rather than a hand-rolled
  // listener on the wrong event source) is what reliably signals that
  // every queued entry has been fully written before we read `chunks`.
  await archive.finalize();

  return { buffer: Buffer.concat(chunks), itemCount: addedCount };
}
