"use client";

import Image from "next/image";
import { Camera, BookHeart, MapPin, Mic } from "lucide-react";
import type { Gallery } from "@/lib/types";
import { formatEventDate } from "@/lib/utils";

interface GalleryHeroProps {
  gallery: Gallery;
  photoCount: number;
  videoCount: number;
  onShare: () => void;
  onGuestbook: () => void;
  onVoice: () => void;
}

export function GalleryHero({
  gallery,
  photoCount,
  videoCount,
  onShare,
  onGuestbook,
  onVoice,
}: GalleryHeroProps) {
  return (
    <div className="relative">
      <div className="relative h-[52vh] min-h-[360px] w-full overflow-hidden sm:h-[60vh]">
        <Image
          src={gallery.heroImageUrl}
          alt={gallery.eventName}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_32%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        <div className="absolute inset-x-0 bottom-0 px-5 pb-10 text-white sm:px-8 sm:pb-14">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/80">
            Wedding Gallery
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-6xl">
            {gallery.partnerNames[0]}{" "}
            <span className="font-script text-3xl font-normal text-gold-soft sm:text-5xl">
              &amp;
            </span>{" "}
            {gallery.partnerNames[1]}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/90">
            <span>{formatEventDate(gallery.eventDate)}</span>
            {gallery.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} /> {gallery.venue}
              </span>
            )}
            <span>
              {photoCount.toLocaleString()} photos &middot; {videoCount.toLocaleString()} videos
            </span>
          </div>
        </div>
      </div>

      <div className="relative -mt-4 px-5 sm:-mt-6 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-lg shadow-black/5 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={onShare}
            className="flex items-center justify-center gap-2 rounded-xl bg-blush-dark px-5 py-3 font-semibold text-white shadow-sm transition hover:opacity-90 sm:flex-1"
          >
            <Camera size={18} />
            Share Your Memories
          </button>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
            <SecondaryAction icon={<BookHeart size={16} />} label="Guestbook" onClick={onGuestbook} />
            <SecondaryAction icon={<Mic size={16} />} label="Voice" onClick={onVoice} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-center text-[11px] font-medium text-ink-muted hover:bg-surface-muted sm:flex-row sm:text-sm"
    >
      <span className="text-blush-dark">{icon}</span>
      <span className="line-clamp-1">{label}</span>
    </button>
  );
}
