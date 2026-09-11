"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Download,
  Share2,
} from "lucide-react";
import type { MediaItem } from "@/lib/types";

interface MediaViewerProps {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onToggleLike: (id: string) => void;
  canDownload: boolean;
}

export function MediaViewer({
  items,
  index,
  onClose,
  onIndexChange,
  onToggleLike,
  canDownload,
}: MediaViewerProps) {
  const item = items[index];
  const touchStartX = useRef<number | null>(null);
  const [scale, setScale] = useState(1);
  const [prevIndex, setPrevIndex] = useState(index);
  const pinchStartDist = useRef<number | null>(null);

  // Reset zoom when navigating to a different item — adjusted during render
  // rather than in an effect, per https://react.dev/learn/you-might-not-need-an-effect
  if (index !== prevIndex) {
    setPrevIndex(index);
    setScale(1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length]);

  if (!item) return null;

  function goPrev() {
    onIndexChange((index - 1 + items.length) % items.length);
  }
  function goNext() {
    onIndexChange((index + 1) % items.length);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchStartDist.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    } else if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchStartDist.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const nextScale = Math.min(3, Math.max(1, scale * (dist / pinchStartDist.current)));
      setScale(nextScale);
      pinchStartDist.current = dist;
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    pinchStartDist.current = null;
    if (scale > 1) return; // don't swipe-navigate while zoomed in
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) > 60) {
      if (delta > 0) goPrev();
      else goNext();
    }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Wedding memory", url });
      } catch {
        // user cancelled — no-op
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 safe-bottom">
        <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/10">
          <X size={22} />
        </button>
        <div className="text-sm text-white/80">
          {index + 1} / {items.length}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleLike(item.id)}
            aria-label="Like"
            className="rounded-full p-2 hover:bg-white/10"
          >
            <Heart size={20} className={item.liked ? "fill-blush text-blush" : ""} />
          </button>
          {canDownload && (
            <a
              href={item.originalUrl}
              download
              aria-label="Download"
              className="rounded-full p-2 hover:bg-white/10"
            >
              <Download size={20} />
            </a>
          )}
          <button onClick={handleShare} aria-label="Share" className="rounded-full p-2 hover:bg-white/10">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={goPrev}
          aria-label="Previous"
          className="absolute left-2 z-10 hidden rounded-full bg-black/30 p-2 hover:bg-black/50 sm:block"
        >
          <ChevronLeft size={26} />
        </button>

        {item.type === "video" ? (
          <video
            key={item.id}
            src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
            poster={item.previewUrl}
            controls
            playsInline
            className="max-h-full max-w-full"
          />
        ) : (
          <div
            className="relative h-full w-full transition-transform duration-150"
            style={{ transform: `scale(${scale})` }}
          >
            <Image
              src={item.previewUrl}
              alt={item.caption ?? "Wedding photo"}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
        )}

        <button
          onClick={goNext}
          aria-label="Next"
          className="absolute right-2 z-10 hidden rounded-full bg-black/30 p-2 hover:bg-black/50 sm:block"
        >
          <ChevronRight size={26} />
        </button>
      </div>

      <div className="px-4 py-3 text-center safe-bottom">
        <p className="text-sm text-white/70">
          {item.uploaderName}
          {item.caption ? ` — ${item.caption}` : ""}
        </p>
      </div>
    </div>
  );
}
