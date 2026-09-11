"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { CategoryId, MediaItem } from "@/lib/types";

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

function mapRow(row: MediaRow): MediaItem {
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

// Live-updates the gallery for guests currently viewing it: subscribes to
// new `media` rows for this gallery via Supabase Realtime (Postgres
// Changes) so an upload from one guest appears for everyone else without a
// manual refresh.
export function useGalleryRealtime(galleryId: string, onInsert: (item: MediaItem) => void) {
  const onInsertRef = useRef(onInsert);
  useEffect(() => {
    onInsertRef.current = onInsert;
  });

  useEffect(() => {
    if (!galleryId || !isSupabaseConfigured()) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`gallery-media-${galleryId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "media", filter: `gallery_id=eq.${galleryId}` },
        (payload) => {
          onInsertRef.current(mapRow(payload.new as MediaRow));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [galleryId]);
}
