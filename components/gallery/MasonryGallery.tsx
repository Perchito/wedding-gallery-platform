"use client";

import { useEffect, useRef, useState } from "react";
import { MediaCard } from "./MediaCard";
import type { MediaItem } from "@/lib/types";

const PAGE_SIZE = 12;

interface MasonryGalleryProps {
  items: MediaItem[];
  onOpen: (item: MediaItem) => void;
}

export function MasonryGallery({ items, onOpen }: MasonryGalleryProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [prevItems, setPrevItems] = useState(items);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination whenever the filtered set changes (e.g. category switch).
  // Adjusted during render (not an effect) per https://react.dev/learn/you-might-not-need-an-effect
  if (items !== prevItems) {
    setPrevItems(items);
    setVisibleCount(PAGE_SIZE);
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, items.length));
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  const visible = items.slice(0, visibleCount);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center text-ink-muted">
        <p className="font-display text-lg">No media in this category yet</p>
        <p className="text-sm">Be the first to share a photo or video here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="columns-2 gap-3 px-4 py-4 sm:columns-3 sm:px-8 lg:columns-4">
        {visible.map((item) => (
          <MediaCard key={item.id} item={item} onClick={() => onOpen(item)} />
        ))}
      </div>
      {visibleCount < items.length && (
        <div ref={sentinelRef} className="flex justify-center py-6 text-sm text-ink-muted">
          Loading more…
        </div>
      )}
    </div>
  );
}
