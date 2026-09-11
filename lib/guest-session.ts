"use client";

import type { GuestSession } from "./types";

// Anonymous, no-signup guest session — persisted in localStorage per gallery.
// Mirrors the `guest_sessions` table (see db/schema.sql) so the same shape
// can later be minted server-side and synced instead of only living locally.

function storageKey(galleryId: string) {
  return `wgp:guest-session:${galleryId}`;
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `guest_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getOrCreateGuestSession(galleryId: string): GuestSession {
  if (typeof window === "undefined") {
    return {
      galleryId,
      guestSessionId: "server",
      guestName: null,
      createdAt: new Date().toISOString(),
    };
  }

  const key = storageKey(galleryId);
  const existing = window.localStorage.getItem(key);
  if (existing) {
    try {
      return JSON.parse(existing) as GuestSession;
    } catch {
      // fall through and recreate a fresh session
    }
  }

  const session: GuestSession = {
    galleryId,
    guestSessionId: randomId(),
    guestName: null,
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(key, JSON.stringify(session));
  return session;
}

export function updateGuestName(galleryId: string, name: string | null) {
  const session = getOrCreateGuestSession(galleryId);
  const updated: GuestSession = { ...session, guestName: name };
  window.localStorage.setItem(storageKey(galleryId), JSON.stringify(updated));
  return updated;
}

// --- Photo Hunt progress (per guest, per gallery) --------------------------

function huntKey(galleryId: string, guestSessionId: string) {
  return `wgp:hunt-progress:${galleryId}:${guestSessionId}`;
}

export function getHuntProgress(galleryId: string, guestSessionId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  const raw = window.localStorage.getItem(huntKey(galleryId, guestSessionId));
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function markHuntChallengeComplete(
  galleryId: string,
  guestSessionId: string,
  challengeId: string
) {
  const current = getHuntProgress(galleryId, guestSessionId);
  current.add(challengeId);
  window.localStorage.setItem(
    huntKey(galleryId, guestSessionId),
    JSON.stringify(Array.from(current))
  );
  return current;
}
