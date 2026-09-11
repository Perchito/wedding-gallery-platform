"use client";

import { Camera, BookHeart, Trophy, Mic, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type BottomNavAction = "upload" | "guestbook" | "hunt" | "voice" | "more";

interface BottomNavProps {
  onAction: (action: BottomNavAction) => void;
  active?: BottomNavAction | null;
}

const ITEMS: { id: BottomNavAction; label: string; icon: React.ReactNode }[] = [
  { id: "upload", label: "Upload", icon: <Camera size={20} /> },
  { id: "guestbook", label: "Guestbook", icon: <BookHeart size={20} /> },
  { id: "hunt", label: "Hunt", icon: <Trophy size={20} /> },
  { id: "voice", label: "Voice", icon: <Mic size={20} /> },
  { id: "more", label: "More", icon: <MoreHorizontal size={20} /> },
];

export function BottomNav({ onAction, active }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur safe-bottom sm:hidden">
      <div className="mx-auto flex max-w-md justify-between px-2 py-1.5">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onAction(item.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium",
              active === item.id ? "text-blush-dark" : "text-ink-muted"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
