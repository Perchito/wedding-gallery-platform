"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// Offline upload queue: when a guest picks photos/videos with no connection
// (or a flaky venue Wi-Fi), files are written to IndexedDB immediately and
// retried automatically once `navigator.onLine` flips back to true. A real
// deployment additionally registers a Background Sync event in the service
// worker (see public/sw.js) so the browser can retry even if the tab closes.

interface QueuedUpload {
  id: string;
  galleryId: string;
  albumId: string;
  caption?: string;
  guestName: string | null;
  file: Blob;
  fileName: string;
  fileType: string;
  createdAt: string;
}

interface QueueDB extends DBSchema {
  uploads: {
    key: string;
    value: QueuedUpload;
  };
}

let dbPromise: Promise<IDBPDatabase<QueueDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<QueueDB>("wedding-gallery-offline-queue", 1, {
      upgrade(db) {
        db.createObjectStore("uploads", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function enqueueOfflineUpload(item: QueuedUpload) {
  const db = await getDb();
  await db.put("uploads", item);
}

export async function listQueuedUploads(galleryId: string) {
  const db = await getDb();
  const all = await db.getAll("uploads");
  return all.filter((u) => u.galleryId === galleryId);
}

export async function removeQueuedUpload(id: string) {
  const db = await getDb();
  await db.delete("uploads", id);
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function onConnectivityChange(cb: (online: boolean) => void) {
  if (typeof window === "undefined") return () => {};
  const on = () => cb(true);
  const off = () => cb(false);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => {
    window.removeEventListener("online", on);
    window.removeEventListener("offline", off);
  };
}

export type { QueuedUpload };
