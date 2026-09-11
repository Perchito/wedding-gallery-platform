"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  widthClass?: string;
}

// Renders as a bottom sheet on mobile widths and a centered modal on larger
// screens — one component covers upload, guestbook, voice, hunt, find-me,
// schedule and share, per the spec's "sheet" pattern.
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  widthClass,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 animate-fade-in"
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface animate-slide-up sm:max-h-[85vh] sm:rounded-3xl sm:m-4",
          widthClass ?? "sm:max-w-md"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-2 text-ink-muted hover:bg-surface-muted"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 safe-bottom">{children}</div>
      </div>
    </div>
  );
}
