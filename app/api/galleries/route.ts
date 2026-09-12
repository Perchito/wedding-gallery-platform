import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnerPlan, PLAN_LIMITS } from "@/lib/plans";

const DEFAULT_ALBUMS = [
  { name: "Main Gallery", icon: "images", sort_order: 0 },
  { name: "Ceremony", icon: "church", sort_order: 1 },
  { name: "Speeches", icon: "mic", sort_order: 2 },
  { name: "Couple", icon: "heart", sort_order: 3 },
];

function slugify(a: string, b: string) {
  const base = `${a}-${b}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "gallery";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { partnerA, partnerB, eventDate, venue, heroImageUrl, description } = body as {
    partnerA: string;
    partnerB: string;
    eventDate: string;
    venue?: string;
    heroImageUrl?: string;
    description?: string;
  };
  if (!partnerA || !partnerB || !eventDate) {
    return NextResponse.json({ error: "partnerA, partnerB, and eventDate are required" }, { status: 400 });
  }

  const plan = await getOwnerPlan(supabase, user.id);
  const { count: galleryCount } = await supabase
    .from("galleries")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((galleryCount ?? 0) >= PLAN_LIMITS[plan].maxGalleries) {
    return NextResponse.json(
      { error: `Your ${plan} plan allows up to ${PLAN_LIMITS[plan].maxGalleries} gallery${PLAN_LIMITS[plan].maxGalleries === 1 ? "" : "ies"}. Upgrade to create more.` },
      { status: 403 }
    );
  }

  let slug = slugify(partnerA, partnerB);
  const { data: existing } = await supabase.from("galleries").select("slug").eq("slug", slug).maybeSingle();
  if (existing || slug === "demo") {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: gallery, error: galleryError } = await supabase
    .from("galleries")
    .insert({
      owner_id: user.id,
      slug,
      event_name: `${partnerA} & ${partnerB}`,
      partner_a: partnerA,
      partner_b: partnerB,
      event_date: eventDate,
      venue: venue || null,
      hero_image_url: heroImageUrl || null,
      description: description || null,
    })
    .select()
    .single();

  if (galleryError || !gallery) {
    console.error("[galleries] insert failed:", galleryError?.message);
    // Surface the underlying message to the owner — a swallowed error here
    // is how 'album not found'-style broken states get created.
    return NextResponse.json(
      { error: `Failed to create gallery: ${galleryError?.message ?? "unknown error"}` },
      { status: 500 }
    );
  }

  // Default settings + albums are part of what makes a gallery usable, so
  // verify they actually landed instead of letting the owner discover a
  // broken gallery later (a gallery with no albums fails every upload with
  // 'Album does not belong to this gallery'). Roll the gallery back if
  // either fails so nothing half-created is left behind.
  const rollback = async () => {
    await supabase.from("gallery_settings").delete().eq("gallery_id", gallery.id);
    await supabase.from("albums").delete().eq("gallery_id", gallery.id);
    await supabase.from("galleries").delete().eq("id", gallery.id);
  };
  const migrationsHint =
    "Make sure every migration in supabase/migrations/ (especially 00009_fix_galleries_rls_recursion.sql) is applied to your Supabase project — see GOING-LIVE.md.";

  const { error: settingsError } = await supabase
    .from("gallery_settings")
    .insert({ gallery_id: gallery.id });
  if (settingsError) {
    await rollback();
    console.error("[galleries] settings insert failed:", settingsError.message);
    return NextResponse.json(
      { error: `Failed to initialise gallery settings: ${settingsError.message}. ${migrationsHint}` },
      { status: 500 }
    );
  }

  const { data: albums, error: albumsError } = await supabase
    .from("albums")
    .insert(DEFAULT_ALBUMS.map((a) => ({ ...a, gallery_id: gallery.id })))
    .select();
  if (albumsError || !albums || albums.length !== DEFAULT_ALBUMS.length) {
    await rollback();
    console.error("[galleries] albums insert failed:", albumsError?.message);
    return NextResponse.json(
      {
        error: `Failed to create the default albums: ${albumsError?.message ?? "no rows returned"}. ${migrationsHint}`,
      },
      { status: 500 }
    );
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  await supabase.from("qr_codes").insert({ gallery_id: gallery.id, url: `${origin}/g/${slug}` });

  return NextResponse.json({ id: gallery.id, slug: gallery.slug });
}