// Removes the seeded demo gallery (slug "demo") and everything attached to
// it: database rows across all child tables, and the uploaded files from
// Supabase Storage. Run manually when you're done with the demo event:
//
//   node scripts/remove-demo-gallery.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (loaded
// from .env.local if present). This is DESTRUCTIVE and unrecoverable.

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local or env).");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: gallery, error: lookupError } = await supabase
    .from("galleries")
    .select("id, slug, event_name")
    .eq("slug", "demo")
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!gallery) {
    console.log("No 'demo' gallery found — nothing to do.");
    return;
  }
  const galleryId = gallery.id;
  console.log(`Removing demo gallery "${gallery.event_name}" (${galleryId})…`);

  // --- Storage objects (bucket files don't cascade with DB rows) ---
  const paths = [];
  const { data: mediaRows } = await supabase.from("media").select("id").eq("gallery_id", galleryId);
  for (const m of mediaRows ?? []) {
    const { data: objects } = await supabase.storage
      .from("media")
      .list(`${galleryId}/media/${m.id}`, { limit: 100 });
    for (const o of objects ?? []) paths.push(`${galleryId}/media/${m.id}/${o.name}`);
  }
  const { data: voiceRows } = await supabase
    .from("voice_messages")
    .select("id")
    .eq("gallery_id", galleryId);
  for (const v of voiceRows ?? []) paths.push(`${galleryId}/voice/${v.id}.webm`);
  if (paths.length) {
    const { error } = await supabase.storage.from("media").remove(paths);
    if (error) console.warn("Storage cleanup warning:", error.message);
    else console.log(`Removed ${paths.length} file(s) from Storage.`);
  }

  // --- Database rows: children first, gallery last ---
  const { data: challengeRows } = await supabase
    .from("hunt_challenges")
    .select("id")
    .eq("gallery_id", galleryId);
  const challengeIds = (challengeRows ?? []).map((c) => c.id);
  if (challengeIds.length) {
    await supabase.from("hunt_submissions").delete().in("challenge_id", challengeIds);
  }
  const mediaIds = (mediaRows ?? []).map((m) => m.id);
  if (mediaIds.length) {
    await supabase.from("media_categories").delete().in("media_id", mediaIds);
    await supabase.from("media_likes").delete().in("media_id", mediaIds);
  }

  // Ordered roughly by FK dependency; only tables that can reference the
  // gallery. Each delete is best-effort with a logged (not fatal) error.
  const tables = [
    "media",
    "hunt_challenges",
    "hunt_categories",
    "event_schedule",
    "guestbook_messages",
    "voice_messages",
    "guest_sessions",
    "storage_usage",
    "analytics_events",
    "qr_codes",
    "albums",
    "gallery_settings",
  ];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("gallery_id", galleryId);
    if (error) {
      console.warn(`Warning deleting from ${table}: ${error.message} (continuing)`);
    }
  }

  const { error: galleryError } = await supabase.from("galleries").delete().eq("id", galleryId);
  if (galleryError) throw galleryError;

  console.log("Done. The demo gallery is gone — /g/demo now shows the not-found page.");
  console.log("Note: the seeded owner auth account (if any) still exists; remove it in");
  console.log("Supabase Dashboard → Authentication → Users if you no longer need it.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
