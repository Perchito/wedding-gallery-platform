import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Owner-only poll endpoint — RLS scopes zip_export_jobs to the caller's own
// galleries, so a jobId for another tenant's export simply 404s.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ galleryId: string; jobId: string }> }
) {
  const { galleryId, jobId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: job } = await supabase
    .from("zip_export_jobs")
    .select("status, download_url, error")
    .eq("id", jobId)
    .eq("gallery_id", galleryId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    downloadUrl: job.download_url,
    error: job.error,
  });
}
