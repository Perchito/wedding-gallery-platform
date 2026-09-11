"use client";

import { useState } from "react";
import Image from "next/image";
import { Play, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/types";

interface MediaCardProps {
  item: MediaItem;
  onClick: () => void;
}

export function MediaCard({ item, onClick }: MediaCardProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      onClick={onClick}
      className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl bg-surface-muted text-left"
      style={{ aspectRatio: `${item.width} / ${item.height}` }}
    >
      {!loaded && <div className="absolute inset-0 animate-pulse bg-surface-muted" />}
      <Image
        src={item.thumbnailUrl}
        alt={item.caption ?? "Wedding photo"}
        fill
        loading="lazy"
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className={cn(
          "object-cover transition-all duration-300 group-hover:scale-[1.03]",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
      />

      {item.type === "video" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            <Play size={18} fill="currentColor" />
          </span>
        </div>
      )}

      {item.liked && (
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-blush">
          <Heart size={13} fill="currentColor" />
        </span>
      )}

      {item.caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4">
          <p className="line-clamp-1 text-[11px] text-white">{item.caption}</p>
        </div>
      )}
    </button>
  );
}
