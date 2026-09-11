"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeartCrack } from "lucide-react";
import { getCreatedGalleryBySlug } from "@/lib/created-galleries";
import { GalleryApp } from "./GalleryApp";
import GalleryLoading from "./loading";
import type {
  Album,
  Category,
  Gallery,
  HuntCategory,
  HuntChallenge,
} from "@/lib/types";

interface GalleryResolverProps {
  slug: string;
  serverGallery: Gallery | null;
  albums: Album[];
  categories: Category[];
  huntCategories: HuntCategory[];
  huntChallenges: HuntChallenge[];
}

type Status = "checking" | "found" | "not-found";

// The demo gallery is served straight from the server component (mock
// data). Anything else was created client-side via /create and only lives
// in this browser's localStorage (see lib/created-galleries.ts), so it has
// to be resolved after mount — hence the "checking" state, which renders
// identically on server and client to avoid a hydration mismatch.
export function GalleryResolver({
  slug,
  serverGallery,
  albums,
  categories,
  huntCategories,
  huntChallenges,
}: GalleryResolverProps) {
  const [status, setStatus] = useState<Status>(serverGallery ? "found" : "checking");
  const [gallery, setGallery] = useState<Gallery | null>(serverGallery);

  // Reads localStorage, which isn't available during server render, so this
  // must run as a mount effect rather than during render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (serverGallery) return;
    const created = getCreatedGalleryBySlug(slug);
    if (created) {
      setGallery(created);
      setStatus("found");
    } else {
      setStatus("not-found");
    }
  }, [slug, serverGallery]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (status === "checking") return <GalleryLoading />;

  if (status === "not-found" || !gallery) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <HeartCrack size={40} className="text-blush-dark" />
        <h1 className="font-display text-3xl font-semibold">Gallery not found</h1>
        <p className="max-w-sm text-sm text-ink-muted">
          This link may have been mistyped, or the gallery it points to
          isn&apos;t public.
        </p>
        <Link
          href="/g/demo"
          className="mt-2 rounded-full bg-blush-dark px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          View Demo Gallery
        </Link>
      </div>
    );
  }

  return (
    <GalleryApp
      gallery={gallery}
      albums={albums}
      categories={categories}
      initialMedia={[]}
      initialMessages={[]}
      initialVoiceMessages={[]}
      huntCategories={huntCategories}
      huntChallenges={huntChallenges}
      schedule={[]}
    />
  );
}
