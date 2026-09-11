import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ScheduleEntry } from "@/lib/types";

export interface OwnerScheduleData {
  galleryId: string;
  gallerySlug: string;
  eventName: string;
  entries: ScheduleEntry[];
}

export async function getOwnerSchedule(): Promise<OwnerScheduleData | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: gallery } = await supabase
    .from("galleries")
    .select("id, slug, event_name")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!gallery) return null;

  const { data: entries } = await supabase
    .from("event_schedule")
    .select("*")
    .eq("gallery_id", gallery.id)
    .order("sort_order");

  return {
    galleryId: gallery.id,
    gallerySlug: gallery.slug,
    eventName: gallery.event_name,
    entries: (entries ?? []).map(
      (e): ScheduleEntry => ({
        id: e.id,
        galleryId: e.gallery_id,
        time: e.time,
        title: e.title,
        description: e.description ?? undefined,
        sortOrder: e.sort_order,
      })
    ),
  };
}
