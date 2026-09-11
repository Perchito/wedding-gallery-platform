import Link from "next/link";
import { getOwnerGallery } from "@/lib/data/dashboard";
import { DashboardApp } from "./DashboardApp";

export const metadata = { title: "Dashboard — Wedding Gallery Platform" };

export default async function DashboardPage() {
  const result = await getOwnerGallery();

  if (!result) {
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

  return <DashboardApp gallery={result.gallery} stats={result.stats} initialMedia={result.media} />;
}
