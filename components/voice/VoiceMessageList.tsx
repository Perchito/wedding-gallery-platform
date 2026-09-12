"use client";

import { Mic } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { VoiceMessage } from "@/lib/types";

// Voice guestbook messages as playable cards in the public gallery. Shown
// under the "All" and "Speeches" category views (GalleryApp) — voice notes
// are what most guests mean by "speeches".
export function VoiceMessageList({ items }: { items: VoiceMessage[] }) {
  return (
    <section className="px-4 pb-6 sm:px-8">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
        <Mic size={18} className="text-blush-dark" /> Voice Messages
      </h2>
      <div className="flex flex-col gap-3">
        {items.map((v) => (
          <div key={v.id} className="rounded-xl border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
              <span className="font-medium text-foreground">
                {v.guestName || "Guest"}
              </span>
              <span>
                {formatDuration(v.durationSeconds)} · {formatRelativeTime(v.createdAt)}
              </span>
            </div>
            <audio src={v.audioUrl} controls playsInline preload="metadata" className="w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}