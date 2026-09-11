# Wedding Gallery Platform

A mobile-first wedding & event photo-sharing platform: guests scan a QR code
or open a link, land straight in the event gallery, and can take or upload
photos/videos without creating an account. Built as a Next.js PWA.

Live demo route: **`/g/demo`** — *Mateo & Genesis, 20 March 2026*.

## Status: Phase 1 MVP

This repo implements the **Phase 1** feature set end-to-end on the frontend,
plus working previews of most of Phase 2/3, all running on **mock/in-memory
data** (`lib/mock-data.ts`) — there is no backend wired up yet. That means:

- Everything you see in the running app is real, interactive UI (not static
  mockups) — uploads, likes, guestbook posts, voice recordings, Photo Hunt
  progress, and QR/PDF generation all actually work in the browser.
- Data does **not** persist across page reloads except where noted below
  (guest identity and Photo Hunt progress use `localStorage`, offline
  uploads use `IndexedDB`). Nothing is written to a real database yet.
- `db/schema.sql` documents the full target Postgres/Supabase schema so the
  backend can be implemented against the same shapes already used by the UI
  (`lib/types.ts`) without a frontend rewrite.

### Implemented

- **Public gallery** (`/g/[slug]`, demo at `/g/demo`): hero header with
  event name/date/venue/media counts, category filters (All / Photos /
  Videos / Speeches / Ceremony / Couple) with live counts, responsive
  masonry gallery (2 columns mobile → 4 desktop) with lazy-loaded images,
  video thumbnails, and infinite scroll.
- **Media viewer**: full-screen photo/video viewer with prev/next, like,
  download, share, swipe-to-navigate and pinch-to-zoom on touch, native
  `<video>` controls for clips.
- **Share Your Memories** upload flow: camera capture / camera roll /
  multi-select, optional guest name + caption + album, per-file progress
  states (waiting → uploading → processing → complete/failed) with retry,
  and a success screen.
- **Offline upload queue**: if a guest is offline, selected files are
  written to IndexedDB (`lib/offline-queue.ts`) and a service worker
  (`public/sw.js`) listens for connectivity/Background Sync to nudge the
  page into retrying automatically.
- **Guest sessions**: anonymous, no-signup identity persisted in
  `localStorage` (`lib/guest-session.ts`), remembering the guest's name and
  Photo Hunt progress across visits.
- **Guestbook**, **Voice Guestbook** (MediaRecorder API, 60s cap, playback,
  re-record), **Photo Hunt** (categorized challenges, per-guest progress,
  capture-to-complete flow), **Find My Photos** (mocked face-match pipeline
  with a privacy explainer — see `db/schema.sql` for the real
  `face_embeddings` design), and **Order of the Day** schedule.
- **Sharing & QR codes**: copy link, WhatsApp share, native Web Share API,
  QR code generation with PNG/SVG download, and a printable "wedding card"
  PDF (name, date, QR, instructions) via `jspdf`.
- **Mobile bottom navigation** (Upload / Guestbook / Hunt / Voice / More)
  with `env(safe-area-inset-bottom)` handling; a "More" sheet surfaces
  Order of the Day, Find My Photos, Jump to Gallery, View All, Share.
- **Admin dashboard** (`/dashboard`): stats (photos/videos/guests/messages/
  storage/hunt completion), media grid with select/hide/delete, and a
  gallery settings panel (uploads/downloads/guestbook/voice/hunt/face
  search toggles, privacy mode).
- **PWA**: web manifest (`app/manifest.ts`), install-to-home-screen icons,
  and a service worker that caches the app shell for offline navigation.

### Not yet implemented (see `db/schema.sql` + spec for the target design)

Real backend/auth, Supabase/Postgres persistence, presigned-URL uploads to
object storage (R2/S3), a real media-processing pipeline (thumbnailing,
video transcoding, AI moderation), real face recognition (embedding +
vector search), realtime gallery updates for other viewers, background ZIP
export jobs, and multi-tenant account/subscription management. These are
Phase 2/3 per the product spec and are designed for, but intentionally not
built, in this pass.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- `qrcode` (QR generation), `jspdf` (printable wedding card), `idb`
  (IndexedDB wrapper for the offline queue), `lucide-react` (icons)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects nowhere
by default, so go straight to [http://localhost:3000/g/demo](http://localhost:3000/g/demo)
for the gallery, or [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
for the owner dashboard.

Placeholder photos/videos are served from `picsum.photos` and an MDN sample
clip — swap `lib/mock-data.ts` for real uploaded media once storage exists.

## Project structure

```
app/
  page.tsx                 marketing landing page
  g/[slug]/                public gallery (page.tsx + GalleryApp.tsx client shell)
  dashboard/                owner dashboard
  manifest.ts               PWA manifest
components/
  gallery/                 hero, category nav, masonry grid, media viewer, bottom nav
  upload/                  Share Your Memories sheet + progress list
  guestbook/ voice/ hunt/ findme/ schedule/ share/   feature sheets
  sheets/                  shared BottomSheet primitive
lib/
  types.ts                 domain types mirroring db/schema.sql
  mock-data.ts             demo event data (Mateo & Genesis)
  guest-session.ts         anonymous guest identity + Photo Hunt progress
  offline-queue.ts         IndexedDB offline upload queue
  qr.ts                    QR code + wedding card generation
db/
  schema.sql               target Postgres/Supabase schema (Phase 2/3)
public/
  sw.js                    PWA service worker
```

## Wiring up a real backend (Phase 2)

1. Apply `db/schema.sql` to a Postgres instance (Supabase recommended — it
   gives you Postgres + Auth + Storage + Realtime + Edge Functions in one).
2. Replace the mock-data reads in `app/g/[slug]/page.tsx` and
   `app/dashboard/page.tsx` with real queries scoped by `gallery_id`.
3. Replace the simulated upload in `components/upload/UploadSheet.tsx` with
   a presigned-URL flow: request a signed PUT URL from an API route, upload
   directly to object storage, then poll/subscribe for processing status.
4. Add the API routes sketched in the product spec
   (`/api/galleries/:id/media`, `/messages`, `/voice`, `/hunt/:challengeId`,
   `/find-me`, `/schedule`, `/share`, `/qr`) backed by the schema above.
5. Swap the mocked "Find My Photos" delay in `components/findme/FindMeSheet.tsx`
   for a real face-detection + embedding + vector similarity search against
   `face_embeddings`, and delete selfies after processing per
   `face_search_requests`.
