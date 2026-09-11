"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import type { ScheduleEntry } from "@/lib/types";

interface ScheduleManagerProps {
  galleryId: string;
  gallerySlug: string;
  eventName: string;
  entries: ScheduleEntry[];
}

function randomId() {
  return `local_${Math.random().toString(36).slice(2)}`;
}

export function ScheduleManager({ galleryId, gallerySlug, eventName, entries: initial }: ScheduleManagerProps) {
  const [entries, setEntries] = useState(
    [...initial].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateLocal(id: string, patch: Partial<ScheduleEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function saveEntry(entry: ScheduleEntry) {
    setSavingId(entry.id);
    try {
      if (entry.id.startsWith("local_")) {
        const res = await fetch(`/api/galleries/${galleryId}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            time: entry.time,
            title: entry.title,
            description: entry.description || null,
            sortOrder: entry.sortOrder,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
        const saved: ScheduleEntry = await res.json();
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? saved : e)));
      } else {
        const res = await fetch(`/api/schedule/${entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            time: entry.time,
            title: entry.title,
            description: entry.description ?? null,
            sortOrder: entry.sortOrder,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteEntry(entry: ScheduleEntry) {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    if (!entry.id.startsWith("local_")) {
      fetch(`/api/schedule/${entry.id}`, { method: "DELETE" }).catch(() => {});
    }
  }

  function addEntry() {
    const nextSortOrder = entries.length ? Math.max(...entries.map((e) => e.sortOrder)) + 1 : 0;
    setEntries((prev) => [
      ...prev,
      {
        id: randomId(),
        galleryId,
        time: "",
        title: "",
        description: "",
        sortOrder: nextSortOrder,
      },
    ]);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-blush-dark"
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <h1 className="font-display text-2xl font-semibold">Order of the Day</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Build the schedule guests see for {eventName} — visible on{" "}
        <Link href={`/g/${gallerySlug}`} className="text-blush-dark hover:underline">
          /g/{gallerySlug}
        </Link>
        .
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-start"
          >
            <GripVertical size={16} className="mt-2.5 hidden shrink-0 text-ink-muted sm:block" />
            <div className="grid flex-1 gap-2 sm:grid-cols-[100px_1fr]">
              <input
                type="time"
                value={entry.time}
                onChange={(e) => updateLocal(entry.id, { time: e.target.value })}
                onBlur={() => saveEntry(entry)}
                className="input-field"
              />
              <input
                value={entry.title}
                onChange={(e) => updateLocal(entry.id, { title: e.target.value })}
                onBlur={() => saveEntry(entry)}
                placeholder="e.g. Ceremony"
                className="input-field"
              />
              <textarea
                value={entry.description ?? ""}
                onChange={(e) => updateLocal(entry.id, { description: e.target.value })}
                onBlur={() => saveEntry(entry)}
                placeholder="Description (optional)"
                rows={1}
                className="input-field sm:col-start-2"
              />
            </div>
            <button
              onClick={() => deleteEntry(entry)}
              disabled={savingId === entry.id}
              className="flex items-center justify-center gap-1 self-start rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 sm:self-center"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {entries.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">
            No schedule entries yet — add the first one below.
          </p>
        )}
      </div>

      <button
        onClick={addEntry}
        className="mt-4 flex items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-2 text-sm font-medium text-ink-muted hover:border-blush-dark/40 hover:text-blush-dark"
      >
        <Plus size={14} /> Add schedule entry
      </button>
    </div>
  );
}
