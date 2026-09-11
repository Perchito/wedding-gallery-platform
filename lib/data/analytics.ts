import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DailyViewCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface ContributorRank {
  guestName: string;
  mediaCount: number;
}

export interface GalleryAnalytics {
  eventName: string;
  countsByType: Record<string, number>;
  dailyViews: DailyViewCount[];
  topContributors: ContributorRank[];
}

const WINDOW_DAYS = 90;
const CHART_DAYS = 14;

export async function getGalleryAnalytics(galleryId: string): Promise<GalleryAnalytics | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: gallery } = await supabase
    .from("galleries")
    .select("event_name")
    .eq("id", galleryId)
    .maybeSingle();
  if (!gallery) return null;

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: events } = await supabase
    .from("analytics_events")
    .select("event_type, created_at")
    .eq("gallery_id", galleryId)
    .gte("created_at", since)
    .limit(20000);

  const countsByType: Record<string, number> = {};
  const dayBuckets = new Map<string, number>();
  for (const e of events ?? []) {
    countsByType[e.event_type] = (countsByType[e.event_type] ?? 0) + 1;
    if (e.event_type === "gallery_view") {
      const day = e.created_at.slice(0, 10);
      dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
    }
  }

  const dailyViews: DailyViewCount[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyViews.push({ date: key, count: dayBuckets.get(key) ?? 0 });
  }

  const { data: mediaRows } = await supabase
    .from("media")
    .select("uploader_name")
    .eq("gallery_id", galleryId)
    .neq("moderation_status", "removed");
  const contributorCounts = new Map<string, number>();
  for (const row of mediaRows ?? []) {
    const name = row.uploader_name || "Guest";
    contributorCounts.set(name, (contributorCounts.get(name) ?? 0) + 1);
  }
  const topContributors = Array.from(contributorCounts.entries())
    .map(([guestName, mediaCount]) => ({ guestName, mediaCount }))
    .sort((a, b) => b.mediaCount - a.mediaCount)
    .slice(0, 8);

  return {
    eventName: gallery.event_name,
    countsByType,
    dailyViews,
    topContributors,
  };
}
