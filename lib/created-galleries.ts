"use client";

import type { Gallery } from "./types";

// Until a real backend exists, owner-created galleries live in the browser's
// localStorage. The shape matches `Gallery` exactly so this can be swapped
// for a Supabase `galleries` table insert/select without touching callers —
// see db/schema.sql and README "Wiring up a real backend".

const STORAGE_KEY = "wgp:created-galleries";

export interface CreateGalleryInput {
  partnerA: string;
  partnerB: string;
  eventDate: string; // ISO date
  venue?: string;
  heroImageUrl?: string;
  description?: string;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readAll(): Gallery[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Gallery[]) : [];
  } catch {
    return [];
  }
}

function writeAll(galleries: Gallery[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(galleries));
}

export function getCreatedGalleries(): Gallery[] {
  return readAll();
}

export function getCreatedGalleryBySlug(slug: string): Gallery | null {
  return readAll().find((g) => g.slug === slug) ?? null;
}

function uniqueSlug(base: string, existing: Gallery[]) {
  const taken = new Set(existing.map((g) => g.slug));
  let slug = base || "gallery";
  let n = 2;
  while (taken.has(slug) || slug === "demo") {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export function createGallery(input: CreateGalleryInput): Gallery {
  const existing = readAll();
  const id = `gallery_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const slug = uniqueSlug(slugify(`${input.partnerA}-${input.partnerB}`), existing);

  const gallery: Gallery = {
    id,
    slug,
    eventName: `${input.partnerA} & ${input.partnerB}`,
    partnerNames: [input.partnerA, input.partnerB],
    eventDate: input.eventDate,
    venue: input.venue || undefined,
    heroImageUrl:
      input.heroImageUrl?.trim() ||
      `https://picsum.photos/seed/${encodeURIComponent(slug)}-hero/1600/1000`,
    description: input.description || undefined,
    owner: {
      id: "owner_local",
      name: input.partnerA,
      email: "",
    },
    settings: {
      allowUploads: true,
      allowBrowsing: true,
      allowDownloads: true,
      allowGuestbook: true,
      allowVoiceMessages: true,
      allowPhotoHunt: true,
      allowFaceSearch: true,
      privacy: "public",
    },
    createdAt: new Date().toISOString(),
  };

  writeAll([...existing, gallery]);
  return gallery;
}

export function updateGallerySettings(
  slug: string,
  patch: Partial<Gallery["settings"]>
): Gallery | null {
  const all = readAll();
  const idx = all.findIndex((g) => g.slug === slug);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], settings: { ...all[idx].settings, ...patch } };
  writeAll(all);
  return all[idx];
}

export function deleteCreatedGallery(slug: string) {
  writeAll(readAll().filter((g) => g.slug !== slug));
}
