import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { getOwnerGalleries, getOwnerPlanUsage } from "@/lib/data/dashboard";
import { formatBytes } from "@/lib/plans";
import { formatEventDate } from "@/lib/utils";

export const metadata = { title: "Dashboard — Wedding Gallery Platform" };

export default async function DashboardPage() {
  const galleries = await getOwnerGalleries();

  if (galleries.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">No gallery yet</h1>
        <p className="text-sm text-ink-muted">
          You haven&apos;t created a gallery yet — set one up to see your dashboard.
        </p>
        <Link
          href="/create"
          className="rounded-full bg-blush-dark px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Create a gallery
        </Link>
      </div>
    );
  }

  if (galleries.length === 1) {
    redirect(`/dashboard/galleries/${galleries[0].id}`);
  }

  const usage = await getOwnerPlanUsage();

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Your Galleries</h1>
        <Link
          href="/create"
          className="flex items-center gap-1.5 rounded-full bg-blush-dark px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus size={14} /> New gallery
        </Link>
      </div>

      {usage && (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold capitalize">{usage.plan} plan</p>
            <p className="text-xs text-ink-muted">
              {usage.galleryCount}/{usage.maxGalleries} galleries &middot;{" "}
              {formatBytes(usage.storageUsedBytes)}/{formatBytes(usage.maxStorageBytes)} storage
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-blush-dark"
              style={{ width: `${Math.min(100, (usage.storageUsedBytes / usage.maxStorageBytes) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {galleries.map((gallery) => (
          <Link
            key={gallery.id}
            href={`/dashboard/galleries/${gallery.id}`}
            className="group overflow-hidden rounded-2xl border border-border bg-surface hover:border-blush-dark/40"
          >
            <div className="relative h-28 w-full bg-surface-muted">
              {gallery.heroImageUrl && (
                <Image
                  src={gallery.heroImageUrl}
                  alt={gallery.eventName}
                  fill
                  sizes="400px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="p-4">
              <p className="font-display text-lg font-semibold group-hover:text-blush-dark">
                {gallery.partnerNames[0]} &amp; {gallery.partnerNames[1]}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                <CalendarDays size={12} /> {formatEventDate(gallery.eventDate)}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                <MapPin size={12} /> /g/{gallery.slug}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
