import type { Metadata } from "next";
import { GalleryApp } from "./GalleryApp";
import { GalleryResolver } from "./GalleryResolver";
import { getGalleryFromSupabase } from "@/lib/data/galleries";
import {
  ALBUMS,
  CATEGORIES,
  MEDIA_ITEMS,
  GUESTBOOK_MESSAGES,
  VOICE_MESSAGES,
  HUNT_CATEGORIES,
  HUNT_CHALLENGES,
  SCHEDULE,
  getGalleryBySlug,
} from "@/lib/mock-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gallery = getGalleryBySlug(slug) ?? (await getGalleryFromSupabase(slug));
  if (!gallery) return { title: "Gallery not found" };
  return {
    title: `${gallery.partnerNames[0]} & ${gallery.partnerNames[1]} — Wedding Gallery`,
    description: gallery.description,
  };
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // The demo gallery is fully mock-populated (media, guestbook, schedule…)
  // and always wins so the showcase route never depends on Supabase.
  const mockGallery = getGalleryBySlug(slug);
  if (mockGallery) {
    return (
      <GalleryApp
        gallery={mockGallery}
        albums={ALBUMS}
        categories={CATEGORIES}
        initialMedia={MEDIA_ITEMS}
        initialMessages={GUESTBOOK_MESSAGES}
        initialVoiceMessages={VOICE_MESSAGES}
        huntCategories={HUNT_CATEGORIES}
        huntChallenges={HUNT_CHALLENGES}
        schedule={SCHEDULE}
      />
    );
  }

  // Not the demo — check Supabase next (a gallery created directly in the
  // dashboard/SQL editor). It starts with no media/guestbook/schedule rows
  // yet, so it renders with the same empty states as a freshly /create'd
  // gallery.
  const supabaseGallery = await getGalleryFromSupabase(slug);
  if (supabaseGallery) {
    return (
      <GalleryApp
        gallery={supabaseGallery}
        albums={ALBUMS}
        categories={CATEGORIES}
        initialMedia={[]}
        initialMessages={[]}
        initialVoiceMessages={[]}
        huntCategories={HUNT_CATEGORIES}
        huntChallenges={HUNT_CHALLENGES}
        schedule={[]}
      />
    );
  }

  // Not known to the server at all — it may be one created client-side via
  // /create (stored in localStorage, see lib/created-galleries.ts).
  // GalleryResolver checks for that after mount before showing not-found.
  return (
    <GalleryResolver
      slug={slug}
      serverGallery={null}
      albums={ALBUMS}
      categories={CATEGORIES}
      huntCategories={HUNT_CATEGORIES}
      huntChallenges={HUNT_CHALLENGES}
    />
  );
}
