import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Owner-only — RLS scopes `event_schedule` to the caller's own galleries,
// so an id belonging to another tenant's gallery simply matches nothing.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  const patch = await request.json();
  const row: Record<string, unknown> = {};
  if (typeof patch.time === "string") row.time = patch.time;
  if (typeof patch.title === "string") row.title = patch.title;
  if (typeof patch.description === "string" || patch.description === null) {
    row.description = patch.description;
  }
  if (typeof patch.sortOrder === "number") row.sort_order = patch.sortOrder;

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_schedule")
    .update(row)
    .eq("id", entryId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_schedule")
    .delete()
    .eq("id", entryId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
