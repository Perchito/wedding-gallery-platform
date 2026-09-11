import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    return NextResponse.json({ error: "Failed to create gallery" }, { status: 500 });
  }

  await supabase.from("gallery_settings").insert({ gallery_id: gallery.id });
  await supabase
    .from("albums")
    .insert(DEFAULT_ALBUMS.map((a) => ({ ...a, gallery_id: gallery.id })));

  return NextResponse.json({ id: gallery.id, slug: gallery.slug });
}
