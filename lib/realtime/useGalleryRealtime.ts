"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { CategoryId, GuestbookMessage, MediaItem, VoiceMessage } from "@/lib/types";

interface MediaRow {
  id: string;
  gallery_id: string;
  album_id: string;
  guest_session_id: string | null;
  uploader_name: string | null;
  media_type: "photo" | "video";
  original_url: string;
  thumbnail_url: string | null;
  preview_url: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  caption: string | null;
  processing_status: string;
  moderation_status: string;
  created_at: string;
}

function mapMediaRow(row: MediaRow): MediaItem {
  return {
    id: row.id,
    galleryId: row.gallery_id,
    albumId: row.album_id,
    guestSessionId: row.guest_session_id ?? "",
    uploaderName: row.uploader_name ?? "Guest",
    type: row.media_type,
    originalUrl: row.original_url,
    thumbnailUrl: row.thumbnail_url ?? row.original_url,
    previewUrl: row.preview_url ?? row.original_url,
    width: row.width ?? 4,
    height: row.height ?? 5,
    durationSeconds: row.duration_seconds ?? undefined,
    caption: row.caption ?? undefined,
    // The realtime payload doesn't carry the media_categories join —
    // default to the type-based category; the full set arrives on next
    // full refetch. Good enough for "new item shows up in All / Photos /
    // Videos immediately."
    categories: [row.media_type === "video" ? "videos" : "photos"] as CategoryId[],
    liked: false,
    processingStatus: row.processing_status as MediaItem["processingStatus"],
    moderationStatus: row.moderation_status as MediaItem["moderationStatus"],
    createdAt: row.created_at,
  };
}

interface VoiceMessageRow {
  id: string;
  gallery_id: string;
  guest_session_id: string | null;
  guest_name: string | null;
  audio_url: string;
  duration_seconds: number | null;
  created_at: string;
}

function mapVoiceRow(row: VoiceMessageRow): VoiceMessage {
  return {
    id: row.id,
    galleryId: row.gallery_id,
    guestSessionId: row.guest_session_id ?? "",
    guestName: row.guest_name,
    audioUrl: row.audio_url,
    durationSeconds: row.duration_seconds ?? 0,
    createdAt: row.created_at,
  };
}

interface GuestbookRow {
  id: string;
  gallery_id: string;
  guest_session_id: string | null;
  guest_name: string | null;
  message: string;
  approval_status: string;
  created_at: string;
}

function mapGuestbookRow(row: GuestbookRow): GuestbookMessage {
  return {
    id: row.id,
    galleryId: row.gallery_id,
    guestSessionId: row.guest_session_id ?? "",
    guestName: row.guest_name,
    message: row.message,
    createdAt: row.created_at,
    approvalStatus: row.approval_status,
  };
}

export interface GalleryRealtimeHandlers {
  onMedia?: (item: MediaItem) => void;
  onVoiceMessage?: (item: VoiceMessage) => void;
  onGuestbookMessage?: (item: GuestbookMessage) => void;
}

// Live-updates the gallery for guests currently viewing it: new photos and
// videos, voice messages and guestbook posts appear without a manual
// refresh (Supabase Realtime Postgres Changes — see migration 00004/00012).
export function useGalleryRealtime(galleryId: string, handlers: GalleryRealtimeHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!galleryId || !isSupabaseConfigured()) return;

    const supabase = createSupabaseBrowserClient();
    const filter = `gallery_id=eq.${galleryId}`;
    const channel = supabase
      .channel(`gallery-${galleryId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "media", filter },
        (payload) => handlersRef.current.onMedia?.(mapMediaRow(payload.new as MediaRow))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "voice_messages", filter },
        (payload) => handlersRef.current.onVoiceMessage?.(mapVoiceRow(payload.new as VoiceMessageRow))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "guestbook_messages", filter },
        (payload) => {
          const row = payload.new as GuestbookRow;
          // Manual moderation model: only ever show approved messages live.
          if (row.approval_status !== "approved") return;
          handlersRef.current.onGuestbookMessage?.(mapGuestbookRow(row));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [galleryId]);
}