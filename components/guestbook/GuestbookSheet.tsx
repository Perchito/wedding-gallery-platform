"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { BottomSheet } from "@/components/sheets/BottomSheet";
import { formatRelativeTime } from "@/lib/utils";
import type { GuestbookMessage } from "@/lib/types";

interface GuestbookSheetProps {
  open: boolean;
  onClose: () => void;
  galleryId: string;
  messages: GuestbookMessage[];
  guestSessionId: string;
  guestName: string | null;
  onGuestNameChange: (name: string) => void;
  onSend: (message: GuestbookMessage) => void;
}

export function GuestbookSheet({
  open,
  onClose,
  galleryId,
  messages,
  guestSessionId,
  guestName,
  onGuestNameChange,
  onSend,
}: GuestbookSheetProps) {
  const [name, setName] = useState(guestName ?? "");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);
    onGuestNameChange(name.trim());
    try {
      const res = await fetch(`/api/galleries/${galleryId}/guestbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestSessionId,
          guestName: name.trim() || null,
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to send");
      const saved: GuestbookMessage = await res.json();
      onSend(saved);
      setMessage("");
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Guestbook" subtitle="Leave a message for the couple">
      <div className="flex flex-col gap-4">
        {sent && (
          <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm text-blush-dark">
            <CheckCircle2 size={16} />
            Message sent! Your note has been shared with the couple.
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <label className="text-sm font-medium">
            Your name <span className="font-normal text-ink-muted">(optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Diego"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium">
            Your message <span className="font-normal text-ink-muted">(required)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Write something heartfelt…"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="rounded-lg bg-blush-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {sending ? "Sending…" : "Send Message"}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-ink-muted">
            {messages.length} message{messages.length === 1 ? "" : "s"}
          </p>
          {messages
            .slice()
            .reverse()
            .map((m) => (
              <div key={m.id} className="rounded-xl bg-surface-muted p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{m.guestName ?? "Anonymous guest"}</p>
                  <p className="text-xs text-ink-muted">{formatRelativeTime(m.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm text-foreground/90">{m.message}</p>
              </div>
            ))}
        </div>
      </div>
    </BottomSheet>
  );
}
