"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Images,
  Video,
  Users,
  MessageSquareText,
  Mic,
  HardDrive,
  Trophy,
  Eye,
  EyeOff,
  Trash2,
  Download,
  ExternalLink,
} from "lucide-react";
import { cn, formatEventDate } from "@/lib/utils";
import type { Gallery, GalleryStats, GallerySettings, MediaItem } from "@/lib/types";

interface DashboardAppProps {
  gallery: Gallery;
  stats: GalleryStats;
  initialMedia: MediaItem[];
}

export function DashboardApp({ gallery, stats, initialMedia }: DashboardAppProps) {
  const [media, setMedia] = useState(initialMedia);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<GallerySettings>(gallery.settings);

  const allSelected = selected.size > 0 && selected.size === media.length;

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(media.map((m) => m.id)));
  }

  function hideSelected() {
    setMedia((prev) =>
      prev.map((m) =>
        selected.has(m.id)
          ? { ...m, moderationStatus: m.moderationStatus === "removed" ? "approved" : "removed" }
          : m
      )
    );
  }

  function deleteSelected() {
    setMedia((prev) => prev.filter((m) => !selected.has(m.id)));
    setSelected(new Set());
  }

  function toggleSetting(key: keyof GallerySettings) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const statCards = useMemo(
    () => [
      { icon: <Images size={18} />, label: "Photos", value: stats.photos },
      { icon: <Video size={18} />, label: "Videos", value: stats.videos },
      { icon: <Images size={18} />, label: "Total Media", value: stats.totalMedia },
      { icon: <Users size={18} />, label: "Guests", value: stats.guests },
      { icon: <MessageSquareText size={18} />, label: "Messages", value: stats.messages },
      { icon: <Mic size={18} />, label: "Voice Messages", value: stats.voiceMessages },
      { icon: <HardDrive size={18} />, label: "Storage", value: `${stats.storageUsedGb} GB` },
      { icon: <Trophy size={18} />, label: "Hunt Completion", value: `${stats.huntAvgCompletionPct}%` },
    ],
    [stats]
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Owner Dashboard
          </p>
          <h1 className="font-display text-2xl font-semibold">
            {gallery.partnerNames[0]} &amp; {gallery.partnerNames[1]}
          </h1>
          <p className="text-sm text-ink-muted">{formatEventDate(gallery.eventDate)}</p>
        </div>
        <Link
          href={`/g/${gallery.slug}`}
          className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-blush-dark/40"
        >
          <ExternalLink size={14} /> View Public Gallery
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
            <span className="text-blush-dark">{s.icon}</span>
            <p className="mt-2 text-xl font-semibold">{s.value}</p>
            <p className="text-xs text-ink-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Media Management</h2>
          <div className="flex items-center gap-2">
            <button onClick={toggleSelectAll} className="text-sm font-medium text-ink-muted">
              {allSelected ? "Clear" : "Select all"}
            </button>
            {selected.size > 0 && (
              <>
                <button
                  onClick={hideSelected}
                  className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium"
                >
                  <EyeOff size={12} /> Hide
                </button>
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-1 rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {media.slice(0, 24).map((m) => {
            const isSelected = selected.has(m.id);
            const isHidden = m.moderationStatus === "removed";
            return (
              <button
                key={m.id}
                onClick={() => toggleSelected(m.id)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border-2",
                  isSelected ? "border-blush-dark" : "border-transparent"
                )}
              >
                <Image
                  src={m.thumbnailUrl}
                  alt=""
                  fill
                  sizes="120px"
                  className={cn("object-cover", isHidden && "opacity-40 grayscale")}
                />
                {isHidden && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                    <EyeOff size={16} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Showing 24 of {media.length} items. Full-resolution ZIP export runs as a
          background job — see &quot;Download Gallery&quot; below.
        </p>
        <button className="mt-3 flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-blush-dark/40">
          <Download size={14} /> Download Gallery (ZIP)
        </button>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-lg font-semibold">Gallery Settings</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["allowUploads", "Allow uploads"],
              ["allowBrowsing", "Allow browsing"],
              ["allowDownloads", "Allow downloads"],
              ["allowGuestbook", "Allow guestbook"],
              ["allowVoiceMessages", "Allow voice messages"],
              ["allowPhotoHunt", "Allow Photo Hunt"],
              ["allowFaceSearch", "Allow face search"],
            ] as [keyof GallerySettings, string][]
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
            >
              <span className="text-sm font-medium">{label}</span>
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={() => toggleSetting(key)}
                className="h-4 w-4 accent-[var(--blush-dark)]"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-border px-4 py-3">
          <p className="mb-2 text-sm font-medium">Privacy</p>
          <div className="flex gap-2">
            {(["public", "private", "password"] as GallerySettings["privacy"][]).map((p) => (
              <button
                key={p}
                onClick={() => setSettings((prev) => ({ ...prev, privacy: p }))}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium capitalize",
                  settings.privacy === p
                    ? "border-blush-dark bg-blush-dark text-white"
                    : "border-border text-ink-muted"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1 text-xs text-ink-muted">
          <Eye size={12} /> Settings here update this session only — wire this form to
          `PATCH /api/galleries/:id` once the backend exists.
        </p>
      </section>
    </div>
  );
}
