// Minimal PWA service worker: caches the app shell for offline navigation
// and (best-effort) nudges the offline upload queue when connectivity
// returns via a Background Sync event. The queue itself lives in IndexedDB
// and is drained by the page (lib/offline-queue.ts) — this worker's job is
// just to wake the page/registration up, since Background Sync delivery to
// a closed tab still requires the app's own retry logic once it's open.

const CACHE_NAME = "wedding-gallery-shell-v1";
const APP_SHELL = ["/", "/g/demo", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "wedding-gallery-upload-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "FLUSH_UPLOAD_QUEUE" });
        }
      })
    );
  }
});
