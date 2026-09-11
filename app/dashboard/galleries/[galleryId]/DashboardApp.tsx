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
  Loader2,
  ExternalLink,
  CalendarClock,
  QrCode,
  BarChart3,
} from "lucide-react";
import { cn, formatEventDate } from "@/lib/utils";
import type { Gallery, GalleryStats, GallerySettings, MediaItem } from "@/lib/types";

interface DashboardAppProps {
  gallery: Gallery;
  stats: GalleryStats;
  initialMedia: MediaItem[];
}

type ExportState = "idle" | "pending" | "done" | "failed";

export function DashboardApp({ gallery, stats, initialMedia }: DashboardAppProps) {
  const [media, setMedia] = useState(initialMedia);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<GallerySettings>(gallery.settings);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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
    const ids = Array.from(selected);
    const allCurrentlyHidden = ids.every(
      (id) => media.find((m) => m.id === id)?.moderationStatus === "removed"
    );
    const action = allCurrentlyHidden ? "restore" : "hide";
    setMedia((prev) =>
      prev.map((m) =>
        selected.has(m.id)
          ? { ...m, moderationStatus: action === "hide" ? "removed" : "approved" }
          : m
      )
    );
    fetch(`/api/galleries/${gallery.id}/media/bulk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaIds: ids, action }),
    }).catch(() => {});
  }

  function deleteSelected() {
    const ids = Array.from(selected);
    setMedia((prev) => prev.filter((m) => !selected.has(m.id)));
    setSelected(new Set());
    fetch(`/api/galleries/${gallery.id}/media/bulk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaIds: ids, action: "delete" }),
    }).catch(() => {});
  }

  function toggleSetting(key: keyof GallerySettings) {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      fetch(`/api/galleries/${gallery.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      }).catch(() => {});
      return next;
    });
  }

  function setPrivacy(privacy: GallerySettings["privacy"]) {
    setSettings((prev) => ({ ...prev, privacy }));
    fetch(`/api/galleries/${gallery.id}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privacy }),
    }).catch(() => {});
  }

  async function startExport() {
    setExportState("pending");
    setExportError(null);
    setExportUrl(null);
    try {
      const res = await fetch(`/api/galleries/${gallery.id}/export`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to start export");
      const { jobId } = await res.json();

      // The background worker runs on a ~2 minute cron tick, so this can
      // take a little while — poll rather than block on one long request.
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await fetch(`/api/galleries/${gallery.id}/export/${jobId}`);
        if (!statusRes.ok) continue;
        const job = await statusRes.json();
        if (job.status === "done") {
          setExportState("done");
          setExportUrl(job.downloadUrl);
          return;
        }
        if (job.status === "failed") {
          setExportState("failed");
          setExportError(job.error || "Export failed");
          return;
        }
      }
      setExportState("failed");
      setExportError("Export is taking longer than expected — try again shortly.");
    } catch (err) {
      setExportState("failed");
      setExportError(err instanceof Error ? err.message : "Failed to start export");
    }
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
      <Link href="/dashboard" className="mb-3 inline-block text-sm font-medium text-ink-muted hover:text-blush-dark">
        &larr; All galleries
      </Link>
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
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/galleries/${gallery.id}/analytics`}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-blush-dark/40"
          >
            <BarChart3 size={14} /> Analytics
          </Link>
          <Link
            href={`/dashboard/galleries/${gallery.id}/schedule`}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-blush-dark/40"
          >
            <CalendarClock size={14} /> Order of the Day
          </Link>
          <Link
            href={`/dashboard/galleries/${gallery.id}/qr-card`}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-blush-dark/40"
          >
            <QrCode size={14} /> QR Card
          </Link>
          <Link
            href={`/g/${gallery.slug}`}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-blush-dark/40"
          >
            <ExternalLink size={14} /> View Public Gallery
          </Link>
        </div>
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
        <p className="mt-2 text-xs text-ink-muted">Showing 24 of {media.length} items.</p>
        {exportState === "done" && exportUrl ? (
          <a
            href={exportUrl}
            className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-blush-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Download size={14} /> Download ready — click to save
          </a>
        ) : (
          <button
            onClick={startExport}
            disabled={exportState === "pending"}
            className="mt-3 flex w-fit items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-blush-dark/40 disabled:opacity-60"
          >
            {exportState === "pending" ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Preparing ZIP…
              </>
            ) : (
              <>
                <Download size={14} /> Download Gallery (ZIP)
              </>
            )}
          </button>
        )}
        {exportState === "pending" && (
          <p className="mt-1.5 text-xs text-ink-muted">
            Runs as a background job — this can take a minute or two for larger galleries.
          </p>
        )}
        {exportState === "failed" && exportError && (
          <p className="mt-1.5 text-xs text-red-600">{exportError}</p>
        )}
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
                onClick={() => setPrivacy(p)}
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
          {settings.privacy !== "public" && (
            <p className="mt-2 flex items-center gap-1 text-xs text-amber-700">
              <Eye size={12} /> Private/password galleries aren&apos;t enforced by the public
              gallery page yet — only &quot;public&quot; is fully secured today.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
