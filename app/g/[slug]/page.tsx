import type { Metadata } from "next";
import { GalleryApp } from "./GalleryApp";
import { GalleryResolver } from "./GalleryResolver";
import { getGalleryFromSupabase } from "@/lib/data/galleries";
import { getGalleryContent } from "@/lib/data/gallery-content";
import { CATEGORIES } from "@/lib/mock-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gallery = await getGalleryFromSupabase(slug);
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

  const gallery = await getGalleryFromSupabase(slug);
  if (!gallery) {
    return <GalleryResolver />;
  }

  const content = await getGalleryContent(gallery.id);

  return (
    <GalleryApp
      gallery={gallery}
      albums={content.albums}
      categories={CATEGORIES}
      initialMedia={content.media}
      initialMessages={content.messages}
      initialVoiceMessages={content.voiceMessages}
      huntCategories={content.huntCategories}
      huntChallenges={content.huntChallenges}
      schedule={content.schedule}
    />
  );
}
