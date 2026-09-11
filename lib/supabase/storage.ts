export const MEDIA_BUCKET = "media";

export function buildOriginalPath(galleryId: string, mediaId: string, ext: string) {
  return `${galleryId}/media/${mediaId}/original.${ext}`;
}

export function buildPosterPath(galleryId: string, mediaId: string) {
  return `${galleryId}/media/${mediaId}/poster.jpg`;
}

export function buildVoicePath(galleryId: string, voiceMessageId: string) {
  return `${galleryId}/voice/${voiceMessageId}.webm`;
}

export function getPublicMediaUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

// Inverse of getPublicMediaUrl. Storage paths themselves contain the
// literal segment "media/" (see buildOriginalPath/buildPosterPath above),
// which also happens to be the bucket name — splitting on "/media/"
// generically would match that inner segment instead of the bucket
// boundary. Strip the exact, known prefix instead.
export function storagePathFromPublicUrl(url: string): string | null {
  const prefix = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const pathname = new URL(url).pathname;
  const idx = pathname.indexOf(prefix);
  if (idx === -1) return null;
  return decodeURIComponent(pathname.slice(idx + prefix.length));
}

export function extFromMimeOrName(mimeType: string, fileName: string) {
  const fromName = fileName.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
  };
  return map[mimeType] ?? "bin";
}
