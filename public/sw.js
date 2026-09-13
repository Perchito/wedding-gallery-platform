// Minimal PWA service worker: caches the app shell for offline navigation
// and (best-effort) nudges the offline upload queue when connectivity
// returns via a Background Sync event. The queue itself lives in IndexedDB
// and is drained by the page (lib/offline-queue.ts) — this worker's job is
// just to wake the page/registration up, since Background Sync delivery to
// a closed tab still requires the app's own retry logic once it's open.

// Bumped to v2 so browsers that already cached dashboard/auth pages under
// v1 (before those paths were excluded below) fully purge them via the
// existing activate-time cleanup, instead of leaving unused stale entries
// sitting in the old cache indefinitely.
const CACHE_NAME = "wedding-gallery-shell-v2";
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

// Owner-facing pages (dashboard, auth, API) are dynamic and often behind
// auth — a stale cached copy served on reload would show data that's
// actually wrong, not just old, so these never read from or write to the
// cache. Only the guest-facing gallery and the static shell get the
// offline-friendly cache-first treatment below.
const NEVER_CACHE_PREFIXES = ["/dashboard", "/api", "/login", "/signup", "/create", "/account"];

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const path = new URL(event.request.url).pathname;
  if (NEVER_CACHE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    event.respondWith(fetch(event.request));
    return;
  }

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
