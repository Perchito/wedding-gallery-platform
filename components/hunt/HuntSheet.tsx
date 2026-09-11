"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Camera, Images, ChevronLeft, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/sheets/BottomSheet";
import { cn } from "@/lib/utils";
import { uploadMedia } from "@/lib/upload-media";
import { trackEvent } from "@/lib/track-event";
import type { HuntCategory, HuntChallenge, MediaItem } from "@/lib/types";

interface HuntSheetProps {
  open: boolean;
  onClose: () => void;
  categories: HuntCategory[];
  challenges: HuntChallenge[];
  completed: Set<string>;
  onComplete: (challengeId: string, media: MediaItem) => void;
  galleryId: string;
  gallerySlug: string;
  defaultAlbumId: string;
  guestSessionId: string;
  guestName: string | null;
}

export function HuntSheet({
  open,
  onClose,
  categories,
  challenges,
  completed,
  onComplete,
  galleryId,
  gallerySlug,
  defaultAlbumId,
  guestSessionId,
  guestName,
}: HuntSheetProps) {
  const [active, setActive] = useState<HuntChallenge | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pct = Math.round((completed.size / challenges.length) * 100);

  async function handleFile(file: File | null) {
    if (!file || !active || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const media = await uploadMedia({
        gallerySlug,
        file,
        albumId: defaultAlbumId,
        guestSessionId,
        guestName,
      });
      const res = await fetch(`/api/hunt/${active.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestSessionId, mediaId: media.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to record submission");
      onComplete(active.id, media);
      setActive(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture challenge");
    } finally {
      setUploading(false);
    }
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
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-ink-muted">
            <Loader2 size={22} className="animate-spin text-blush-dark" />
            Uploading…
          </div>
        ) : (
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
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
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
                      onClick={() => {
                        if (isDone) return;
                        trackEvent(galleryId, "hunt_started", guestSessionId, { challengeId: ch.id });
                        setActive(ch);
                      }}
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
