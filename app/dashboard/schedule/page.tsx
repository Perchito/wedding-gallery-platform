import Link from "next/link";
import { getOwnerSchedule } from "@/lib/data/schedule";
import { ScheduleManager } from "./ScheduleManager";

export const metadata = { title: "Order of the Day — Wedding Gallery Platform" };

export default async function SchedulePage() {
  const data = await getOwnerSchedule();

  if (!data) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">No gallery yet</h1>
        <p className="text-sm text-ink-muted">
          Create a gallery first, then come back to set up its schedule.
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

  return <ScheduleManager {...data} />;
}
