import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Owner-only. Enqueues a background job (app/api/cron/process-zip-jobs)
// instead of streaming the ZIP synchronously — safe for a gallery of any
// size, since building the archive never has to fit inside one HTTP
// request/response cycle. Poll GET .../export/[jobId] for status.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ galleryId: string }> }
) {
  const { galleryId } = await params;

  // RLS-scoped read/write proves the caller owns this gallery.
  const supabase = await createSupabaseServerClient();
  const { data: gallery } = await supabase
    .from("galleries")
    .select("id")
    .eq("id", galleryId)
    .maybeSingle();
  if (!gallery) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  const { data: job, error } = await supabase
    .from("zip_export_jobs")
    .insert({ gallery_id: galleryId })
    .select("id, status")
    .single();

  if (error || !job) {
    console.error("[export] failed to enqueue job:", error?.message);
    return NextResponse.json({ error: "Failed to start export" }, { status: 500 });
  }

  return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
}
