"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Camera, Images, ChevronLeft } from "lucide-react";
import { BottomSheet } from "@/components/sheets/BottomSheet";
import { cn } from "@/lib/utils";
import type { HuntCategory, HuntChallenge, MediaItem } from "@/lib/types";

interface HuntSheetProps {
  open: boolean;
  onClose: () => void;
  categories: HuntCategory[];
  challenges: HuntChallenge[];
  completed: Set<string>;
  onComplete: (challengeId: string, media: MediaItem) => void;
  galleryId: string;
  guestSessionId: string;
}

export function HuntSheet({
  open,
  onClose,
  categories,
  challenges,
  completed,
  onComplete,
  galleryId,
  guestSessionId,
}: HuntSheetProps) {
  const [active, setActive] = useState<HuntChallenge | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pct = Math.round((completed.size / challenges.length) * 100);

  function handleFile(file: File | null) {
    if (!file || !active) return;
    const url = URL.createObjectURL(file);
    const media: MediaItem = {
      id: `hunt_media_${Date.now()}`,
      galleryId,
      albumId: "album_main",
      guestSessionId,
      uploaderName: "You",
      type: "photo",
      originalUrl: url,
      thumbnailUrl: url,
      previewUrl: url,
      width: 4,
      height: 5,
      categories: ["photos"],
      liked: false,
      processingStatus: "ready",
      moderationStatus: "approved",
      createdAt: new Date().toISOString(),
    };
    onComplete(active.id, media);
    setActive(null);
  }

  if (active) {
    return (
      <BottomSheet
        open={open}
        onClose={() => setActive(null)}
        title={active.title}
        subtitle={active.prompt}
      >
        <button
          onClick={() => setActive(null)}
          className="mb-3 flex items-center gap-1 text-sm text-ink-muted"
        >
          <ChevronLeft size={16} /> Back to Photo Hunt
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border border-border py-6 text-sm font-medium text-ink-muted hover:border-blush-dark/50 hover:text-blush-dark"
          >
            <Camera size={22} /> Take Photo
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border border-border py-6 text-sm font-medium text-ink-muted hover:border-blush-dark/50 hover:text-blush-dark"
          >
            <Images size={22} /> Choose Photo
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Photo Hunt">
      <div className="mb-5 flex flex-col items-center gap-1 rounded-xl bg-surface-muted py-5 text-center">
        <p className="font-display text-2xl font-semibold">
          {completed.size} of {challenges.length} shots found
        </p>
        <p className="text-sm text-ink-muted">{pct}%</p>
        <div className="mt-2 h-2 w-2/3 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-blush-dark" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {categories.map((cat) => {
          const catChallenges = challenges.filter((c) => c.categoryId === cat.id);
          if (catChallenges.length === 0) return null;
          return (
            <div key={cat.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {cat.label}
              </p>
              <div className="flex flex-col gap-2">
                {catChallenges.map((ch) => {
                  const isDone = completed.has(ch.id);
                  return (
                    <button
                      key={ch.id}
                      onClick={() => !isDone && setActive(ch)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-3 text-left",
                        isDone
                          ? "border-blush-dark/30 bg-blush-dark/5"
                          : "border-border hover:border-blush-dark/40"
                      )}
                    >
                      <span className="text-sm font-medium">{ch.title}</span>
                      {isDone ? (
                        <CheckCircle2 size={18} className="text-blush-dark" />
                      ) : (
                        <span className="text-xs text-ink-muted">Tap to capture</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}
