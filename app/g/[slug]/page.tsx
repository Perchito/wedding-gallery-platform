import type { Metadata } from "next";
import { GalleryApp } from "./GalleryApp";
import { GalleryResolver } from "./GalleryResolver";
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
  const gallery = getGalleryBySlug(slug);
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
  const gallery = getGalleryBySlug(slug);

  // Known server-side (currently just the "demo" gallery): render directly.
  if (gallery) {
    return (
      <GalleryApp
        gallery={gallery}
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

  // Not a server-known gallery — it may be one created client-side via
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
