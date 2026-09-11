"use client";

import { CalendarClock, ScanFace, Images, ArrowUpToLine, Share2 } from "lucide-react";
import { BottomSheet } from "@/components/sheets/BottomSheet";

interface MoreMenuSheetProps {
  open: boolean;
  onClose: () => void;
  onSchedule: () => void;
  onFindMe: () => void;
  onViewAll: () => void;
  onJumpToGallery: () => void;
  onShare: () => void;
}

export function MoreMenuSheet({
  open,
  onClose,
  onSchedule,
  onFindMe,
  onViewAll,
  onJumpToGallery,
  onShare,
}: MoreMenuSheetProps) {
  const items = [
    { icon: <CalendarClock size={18} />, label: "Order of the Day", onClick: onSchedule },
    { icon: <ScanFace size={18} />, label: "Find My Photos", onClick: onFindMe },
    { icon: <ArrowUpToLine size={18} />, label: "Jump to Gallery", onClick: onJumpToGallery },
    { icon: <Images size={18} />, label: "View All Photos", onClick: onViewAll },
    { icon: <Share2 size={18} />, label: "Share Gallery", onClick: onShare },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="More">
      <div className="flex flex-col divide-y divide-border">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="flex items-center gap-3 py-3.5 text-left font-medium"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-blush-dark">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
