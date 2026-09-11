import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildGalleryZip } from "@/lib/zip-export";
import { MEDIA_BUCKET } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// Triggered by pg_cron (via pg_net, see supabase/migrations for the
// schedule) roughly every 2 minutes — not by Vercel Cron, since this
// project's Hobby plan historically limits Vercel cron to once-daily
// invocations. Also safe to call manually (e.g. via curl) for testing;
// it's idempotent per-tick (claims at most one pending job each call).
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: jobs, error: claimError } = await supabase.rpc("claim_next_zip_job");
  if (claimError) {
    console.error("[cron/process-zip-jobs] claim failed:", claimError.message);
    return NextResponse.json({ error: "Failed to claim job" }, { status: 500 });
  }

  const job = jobs?.[0];
  if (!job) {
    return NextResponse.json({ ok: true, processed: false });
  }

  try {
    const { buffer, itemCount } = await buildGalleryZip(job.gallery_id);
    const path = `${job.gallery_id}/exports/${job.id}.zip`;
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, buffer, { contentType: "application/zip", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data: signed, error: signError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24); // 24h
    if (signError || !signed) throw new Error(signError?.message || "Failed to sign URL");

    await supabase
      .from("zip_export_jobs")
      .update({ status: "done", download_url: signed.signedUrl, completed_at: new Date().toISOString() })
      .eq("id", job.id);

    return NextResponse.json({ ok: true, processed: true, jobId: job.id, itemCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/process-zip-jobs] job failed:", job.id, message);
    await supabase
      .from("zip_export_jobs")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", job.id);
    return NextResponse.json({ ok: false, processed: true, jobId: job.id, error: message });
  }
}
