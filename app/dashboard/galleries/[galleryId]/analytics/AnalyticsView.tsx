import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  UploadCloud,
  Images,
  ZoomIn,
  Download,
  MessageSquareText,
  Mic,
  Trophy,
  CheckCircle2,
} from "lucide-react";
import type { GalleryAnalytics } from "@/lib/data/analytics";

interface AnalyticsViewProps {
  galleryId: string;
  data: GalleryAnalytics;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Deterministic, locale/timezone-independent formatting — `date` is a plain
// "YYYY-MM-DD" string, so UTC fields always match what was written into it,
// unlike `toLocaleDateString(undefined, ...)`, which depends on the
// server's vs. the browser's locale and can produce a hydration mismatch.
function formatDayLabel(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

const EVENT_CARDS: { type: string; label: string; icon: React.ReactNode }[] = [
  { type: "gallery_view", label: "Gallery Views", icon: <Eye size={18} /> },
  { type: "upload_started", label: "Uploads Started", icon: <UploadCloud size={18} /> },
  { type: "upload_completed", label: "Uploads Completed", icon: <Images size={18} /> },
  { type: "media_viewed", label: "Photos Viewed", icon: <ZoomIn size={18} /> },
  { type: "media_downloaded", label: "Downloads", icon: <Download size={18} /> },
  { type: "guestbook_message", label: "Guestbook Messages", icon: <MessageSquareText size={18} /> },
  { type: "voice_message", label: "Voice Messages", icon: <Mic size={18} /> },
  { type: "hunt_started", label: "Hunt Started", icon: <Trophy size={18} /> },
  { type: "hunt_completed", label: "Hunt Completed", icon: <CheckCircle2 size={18} /> },
];

export function AnalyticsView({ galleryId, data }: AnalyticsViewProps) {
  const maxCount = Math.max(1, ...data.dailyViews.map((d) => d.count));

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <Link
        href={`/dashboard/galleries/${galleryId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-blush-dark"
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <h1 className="font-display text-2xl font-semibold">Analytics</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Guest activity for {data.eventName} over the last 90 days.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {EVENT_CARDS.map((card) => (
          <div key={card.type} className="rounded-xl border border-border bg-surface p-4">
            <span className="text-blush-dark">{card.icon}</span>
            <p className="mt-2 text-xl font-semibold">{data.countsByType[card.type] ?? 0}</p>
            <p className="text-xs text-ink-muted">{card.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-lg font-semibold">Gallery views, last 14 days</h2>
        <div className="rounded-2xl border border-border bg-surface p-4">
          {data.dailyViews.every((d) => d.count === 0) ? (
            <p className="py-6 text-center text-sm text-ink-muted">No views recorded yet.</p>
          ) : (
            <svg viewBox="0 0 280 100" className="h-32 w-full" role="img" aria-label="Gallery views per day">
              {data.dailyViews.map((d, i) => {
                const barWidth = 280 / data.dailyViews.length - 2;
                const x = i * (280 / data.dailyViews.length);
                const height = Math.max(2, (d.count / maxCount) * 80);
                const y = 90 - height;
                const label = formatDayLabel(d.date);
                return (
                  <g key={d.date}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      rx={2}
                      className="fill-[var(--blush-dark)]"
                    >
                      <title>
                        {label}: {d.count} view{d.count === 1 ? "" : "s"}
                      </title>
                    </rect>
                  </g>
                );
              })}
              <line x1={0} y1={90} x2={280} y2={90} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
            </svg>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-lg font-semibold">Most active contributors</h2>
        {data.topContributors.length === 0 ? (
          <p className="text-sm text-ink-muted">No uploads yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.topContributors.map((c, i) => (
              <div
                key={c.guestName}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5"
              >
                <span className="text-sm font-medium">
                  <span className="mr-2 text-ink-muted">#{i + 1}</span>
                  {c.guestName}
                </span>
                <span className="text-sm text-ink-muted">{c.mediaCount} uploads</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
