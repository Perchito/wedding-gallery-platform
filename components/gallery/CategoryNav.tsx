"use client";

import { cn } from "@/lib/utils";
import type { Category, CategoryId } from "@/lib/types";

interface CategoryNavProps {
  categories: Category[];
  counts: Record<CategoryId, number>;
  active: CategoryId;
  onChange: (id: CategoryId) => void;
}

export function CategoryNav({ categories, counts, active, onChange }: CategoryNavProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3 sm:px-8">
        {categories.map((c) => {
          const isActive = c.id === active;
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition",
                isActive
                  ? "border-blush-dark bg-blush-dark text-white"
                  : "border-border bg-surface text-ink-muted hover:border-blush-dark/40"
              )}
            >
              {c.label}
              <span
                className={cn(
                  "text-xs",
                  isActive ? "text-white/80" : "text-ink-muted/70"
                )}
              >
                {counts[c.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
