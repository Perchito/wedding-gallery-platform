import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Owner-only — RLS scopes `event_schedule` to the caller's own galleries.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;
  const { time, title, description, sortOrder } = await request.json();

  if (!time || !title) {
    return NextResponse.json({ error: "time and title are required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_schedule")
    .insert({
      gallery_id: galleryId,
      time,
      title,
      description: description || null,
      sort_order: sortOrder ?? 0,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[schedule] insert failed:", error?.message);
    return NextResponse.json({ error: "Failed to add schedule entry" }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    galleryId: data.gallery_id,
    time: data.time,
    title: data.title,
    description: data.description ?? undefined,
    sortOrder: data.sort_order,
  });
}
