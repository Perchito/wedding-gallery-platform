"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Ask the browser to retry queued offline uploads (see
        // lib/offline-upload-drain.ts) even if the tab isn't open when
        // connectivity returns, where Background Sync is supported.
        const syncRegistration = registration as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        };
        if (syncRegistration.sync) {
          syncRegistration.sync.register("wedding-gallery-upload-sync").catch(() => {});
        }
      })
      .catch(() => {
        // Non-fatal: the app still works fully online without the SW.
      });
  }, []);

  return null;
}
