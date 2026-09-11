"use client";

import { useEffect, useRef } from "react";
import { listQueuedUploads, removeQueuedUpload, onConnectivityChange, isOnline } from "@/lib/offline-queue";
import { uploadMedia } from "@/lib/upload-media";
import type { MediaItem } from "@/lib/types";

// Drains lib/offline-queue.ts's IndexedDB queue: replays each queued upload
// through the real lib/upload-media.ts pipeline, removing it on success and
// leaving failures queued for the next trigger (connectivity restored, or
// the service worker's Background Sync postMessage).
async function drainQueue(
  galleryId: string,
  gallerySlug: string,
  guestSessionId: string,
  guestName: string | null,
  onUploaded: (items: MediaItem[]) => void
) {
  const queued = await listQueuedUploads(galleryId);
  for (const item of queued) {
    try {
      const file = new File([item.file], item.fileName, { type: item.fileType });
      const mediaItem = await uploadMedia({
        gallerySlug,
        file,
        albumId: item.albumId,
        caption: item.caption,
        guestSessionId,
        guestName: item.guestName ?? guestName,
      });
      await removeQueuedUpload(item.id);
      onUploaded([mediaItem]);
    } catch (err) {
      console.error("[offline-upload-drain] retry failed, leaving queued:", err);
    }
  }
}

export function useOfflineQueueDrain(
  galleryId: string,
  gallerySlug: string,
  guestSessionId: string,
  guestName: string | null,
  onUploaded: (items: MediaItem[]) => void
) {
  const stateRef = useRef({ galleryId, gallerySlug, guestSessionId, guestName, onUploaded });
  useEffect(() => {
    stateRef.current = { galleryId, gallerySlug, guestSessionId, guestName, onUploaded };
  });

  useEffect(() => {
    if (!guestSessionId) return;

    function runDrain() {
      const { galleryId, gallerySlug, guestSessionId, guestName, onUploaded } = stateRef.current;
      if (!isOnline() || !guestSessionId) return;
      void drainQueue(galleryId, gallerySlug, guestSessionId, guestName, onUploaded);
    }

    runDrain();
    const unsubscribe = onConnectivityChange((online) => {
      if (online) runDrain();
    });

    function onMessage(event: MessageEvent) {
      if (event.data?.type === "FLUSH_UPLOAD_QUEUE") runDrain();
    }
    navigator.serviceWorker?.addEventListener("message", onMessage);

    return () => {
      unsubscribe();
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [guestSessionId]);
}
