// One-off seed script: creates the real owner account + the "demo" gallery
// (Mateo & Genesis) with default albums, Photo Hunt challenges, and Order
// of the Day, plus a handful of placeholder photos, so /g/demo works
// end-to-end against the real Supabase backend instead of lib/mock-data.ts.
//
// Usage: node scripts/seed-demo-gallery.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, loaded
// from .env.local if present.

import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
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

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const OWNER_EMAIL = "lmateocc99@gmail.com";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || "wedding-gallery-demo-2026";

const HUNT_CHALLENGES = [
  { category: "The Couple", title: "First Kiss", prompt: "Capture their first kiss!" },
  { category: "The Couple", title: "First Dance", prompt: "Capture this moment!" },
  { category: "The Couple", title: "Cutting the Cake", prompt: "Get the cake-cutting shot." },
  { category: "The Couple", title: "Happy Tears", prompt: "Someone crying happy tears?" },
  { category: "Ceremony", title: "Big Cheer", prompt: "Capture the crowd cheering." },
  { category: "Food & Drink", title: "Glasses Raised", prompt: "A toast in progress!" },
  { category: "Guests & Fun", title: "Best Dancer", prompt: "Who's owning the dance floor?" },
  { category: "Guests & Fun", title: "The Speech", prompt: "Capture a speech moment." },
  { category: "Details", title: "Golden Hour Shot", prompt: "Catch that golden-hour light." },
  { category: "My Ideas", title: "Group Shot", prompt: "Round up a group photo!" },
];

const SCHEDULE = [
  { time: "13:00", title: "Ceremony" },
  { time: "14:00", title: "Drinks Reception" },
  { time: "15:30", title: "Photography" },
  { time: "17:00", title: "Dinner" },
  { time: "19:00", title: "Speeches" },
  { time: "20:00", title: "First Dance" },
  { time: "20:30", title: "Party" },
];

// Real photos of the couple (Luis & his girlfriend), copied into
// scripts/demo-photos/ — uploaded to Storage the same way a guest upload
// would be, so the demo gallery isn't stocked with stock-photo placeholders.
const DEMO_PHOTOS = [
  {
    file: "couple-02.jpg",
    width: 1932,
    height: 2576,
    album: "Couple",
    category: "couple",
    guest: "Genesis",
    caption: "That kiss at Wembley ❤️",
    hero: true,
  },
  {
    file: "couple-05.png",
    width: 1086,
    height: 1448,
    album: "Couple",
    category: "couple",
    guest: "Mateo",
    caption: "Sagrada Família, Barcelona",
  },
  {
    file: "couple-01.jpg",
    width: 1536,
    height: 2048,
    album: "Main Gallery",
    category: "photos",
    guest: "Genesis",
    caption: "Getting ready for a night out",
  },
  {
    file: "couple-03.jpg",
    width: 2048,
    height: 1536,
    album: "Main Gallery",
    category: "photos",
    guest: "Mateo",
    caption: "Coffee date",
  },
  {
    file: "couple-04.jpg",
    width: 1932,
    height: 2576,
    album: "Main Gallery",
    category: "photos",
    guest: "Genesis",
    caption: "On the train, always leaning on you",
  },
];

async function main() {
  console.log("Creating/finding owner account:", OWNER_EMAIL);
  let ownerId;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    email_confirm: true,
    user_metadata: { name: "Luis" },
  });
  if (createErr) {
    if (createErr.message?.toLowerCase().includes("already been registered") || createErr.code === "email_exists") {
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === OWNER_EMAIL);
      if (!existing) throw createErr;
      ownerId = existing.id;
      console.log("Owner already exists:", ownerId);
    } else {
      throw createErr;
    }
  } else {
    ownerId = created.user.id;
    console.log("Created owner:", ownerId, "— password:", OWNER_PASSWORD);
  }

  console.log("Upserting demo gallery…");
  const { data: gallery, error: galleryErr } = await supabase
    .from("galleries")
    .upsert(
      {
        owner_id: ownerId,
        slug: "demo",
        event_name: "Mateo & Genesis",
        partner_a: "Mateo",
        partner_b: "Genesis",
        event_date: "2026-03-20",
        venue: "The Old Vineyard",
        description: "Thank you for celebrating with us!",
      },
      { onConflict: "slug" }
    )
    .select()
    .single();
  if (galleryErr) throw galleryErr;
  const galleryId = gallery.id;

  await supabase.from("gallery_settings").upsert({ gallery_id: galleryId }, { onConflict: "gallery_id" });

  console.log("Seeding albums…");
  const albumSpecs = [
    { name: "Main Gallery", icon: "images", sort_order: 0 },
    { name: "Ceremony", icon: "church", sort_order: 1 },
    { name: "Speeches", icon: "mic", sort_order: 2 },
    { name: "Couple", icon: "heart", sort_order: 3 },
  ];
  const albums = [];
  for (const spec of albumSpecs) {
    const { data: existing } = await supabase
      .from("albums")
      .select("*")
      .eq("gallery_id", galleryId)
      .eq("name", spec.name)
      .maybeSingle();
    if (existing) {
      albums.push(existing);
      continue;
    }
    const { data: inserted, error } = await supabase
      .from("albums")
      .insert({ ...spec, gallery_id: galleryId })
      .select()
      .single();
    if (error) throw error;
    albums.push(inserted);
  }
  const albumByName = Object.fromEntries(albums.map((a) => [a.name, a]));

  console.log("Seeding Photo Hunt categories + challenges…");
  const categoryNames = [...new Set(HUNT_CHALLENGES.map((c) => c.category))];
  const categoryByName = {};
  for (const [i, name] of categoryNames.entries()) {
    const { data: existing } = await supabase
      .from("hunt_categories")
      .select("*")
      .eq("gallery_id", galleryId)
      .eq("label", name)
      .maybeSingle();
    if (existing) {
      categoryByName[name] = existing;
      continue;
    }
    const { data: inserted, error } = await supabase
      .from("hunt_categories")
      .insert({ gallery_id: galleryId, label: name, sort_order: i })
      .select()
      .single();
    if (error) throw error;
    categoryByName[name] = inserted;
  }
  for (const [i, challenge] of HUNT_CHALLENGES.entries()) {
    const { data: existing } = await supabase
      .from("hunt_challenges")
      .select("id")
      .eq("gallery_id", galleryId)
      .eq("title", challenge.title)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("hunt_challenges").insert({
      gallery_id: galleryId,
      category_id: categoryByName[challenge.category].id,
      title: challenge.title,
      prompt: challenge.prompt,
      sort_order: i,
    });
    if (error) throw error;
  }

  console.log("Seeding Order of the Day…");
  for (const [i, entry] of SCHEDULE.entries()) {
    const { data: existing } = await supabase
      .from("event_schedule")
      .select("id")
      .eq("gallery_id", galleryId)
      .eq("title", entry.title)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase
      .from("event_schedule")
      .insert({ gallery_id: galleryId, time: entry.time, title: entry.title, sort_order: i });
    if (error) throw error;
  }

  console.log("Seeding sample media (real couple photos, uploaded to Storage)…");
  const { count: existingMediaCount } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", galleryId);
  if (!existingMediaCount) {
    let heroUrl = null;
    for (const item of DEMO_PHOTOS) {
      const localPath = new URL(`./demo-photos/${item.file}`, import.meta.url);
      if (!existsSync(localPath)) {
        console.warn(`Skipping missing file: ${item.file}`);
        continue;
      }
      const mediaId = randomUUID();
      const ext = item.file.split(".").pop().toLowerCase();
      const contentType = ext === "png" ? "image/png" : "image/jpeg";
      const storagePath = `${galleryId}/media/${mediaId}/original.${ext}`;

      const bytes = readFileSync(localPath);
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(storagePath, bytes, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const publicUrl = `${url}/storage/v1/object/public/media/${storagePath}`;

      const { data: media, error } = await supabase
        .from("media")
        .insert({
          id: mediaId,
          gallery_id: galleryId,
          album_id: albumByName[item.album].id,
          uploader_name: item.guest,
          media_type: "photo",
          original_url: publicUrl,
          thumbnail_url: publicUrl,
          preview_url: publicUrl,
          width: item.width,
          height: item.height,
          caption: item.caption,
          processing_status: "ready",
          moderation_status: "approved",
        })
        .select()
        .single();
      if (error) throw error;

      const categories = item.category === "photos" ? ["photos"] : ["photos", item.category];
      await supabase
        .from("media_categories")
        .insert(categories.map((category) => ({ media_id: media.id, category })));

      if (item.hero) heroUrl = publicUrl;
      console.log(`Uploaded ${item.file} → ${storagePath}`);
    }

    if (heroUrl) {
      await supabase.from("galleries").update({ hero_image_url: heroUrl }).eq("id", galleryId);
    }
  } else {
    console.log(`Gallery already has ${existingMediaCount} media rows — skipping sample media.`);
  }

  console.log("\nDone. /g/demo is now backed by real Supabase data.");
  console.log(`Owner login: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
