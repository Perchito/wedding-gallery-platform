"use client";

// Fire-and-forget analytics event from a client component, for the handful
// of guest actions with no other server round-trip to piggyback on
// (everything else inserts directly inside its own Route Handler).
export function trackEvent(
  galleryId: string,
  eventType: "media_viewed" | "media_downloaded" | "hunt_started",
  guestSessionId: string,
  metadata?: unknown
) {
  fetch(`/api/galleries/${galleryId}/analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, guestSessionId, metadata }),
  }).catch(() => {});
}
