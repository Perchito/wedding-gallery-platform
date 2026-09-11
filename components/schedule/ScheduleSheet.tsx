"use client";

import { BottomSheet } from "@/components/sheets/BottomSheet";
import { formatEventDate } from "@/lib/utils";
import type { ScheduleEntry } from "@/lib/types";

interface ScheduleSheetProps {
  open: boolean;
  onClose: () => void;
  eventDate: string;
  entries: ScheduleEntry[];
}

export function ScheduleSheet({ open, onClose, eventDate, entries }: ScheduleSheetProps) {
  const sorted = entries.slice().sort((a, b) => a.sortOrder - b.sortOrder);

  if (sorted.length === 0) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Order of the Day" subtitle={formatEventDate(eventDate)}>
        <p className="py-6 text-center text-sm text-ink-muted">
          The couple hasn&apos;t published a schedule yet — check back closer to
          the day.
        </p>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Order of the Day" subtitle={formatEventDate(eventDate)}>
      <div className="relative flex flex-col gap-5 pl-4">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
        {sorted.map((entry) => (
          <div key={entry.id} className="relative">
            <span className="absolute -left-4 top-1 h-2.5 w-2.5 rounded-full bg-blush-dark" />
            <p className="text-xs font-semibold uppercase tracking-wide text-blush-dark">
              {entry.time}
            </p>
            <p className="font-display text-base font-semibold">{entry.title}</p>
            {entry.description && (
              <p className="text-sm text-ink-muted">{entry.description}</p>
            )}
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
