# Wedding Gallery Platform

A mobile-first wedding & event photo-sharing platform: guests scan a QR code
or open a link, land straight in the event gallery, and can take or upload
photos/videos without creating an account. Built as a Next.js PWA.

Live demo route: **`/g/demo`** — *Mateo & Genesis, 20 March 2026*.

## Status: Phase 1 + 2 on a real Supabase backend

This repo implements the **Phase 1** feature set end-to-end, plus most of
**Phase 2** (guestbook, voice messages, Photo Hunt, Order of the Day,
realtime gallery updates, offline uploads), backed by a real Supabase
project — Postgres with RLS, Auth, and Storage. `lib/mock-data.ts` still
exists as a reference/seed shape but is no longer read by any page.

- Guests never authenticate. All guest writes (uploads, guestbook, voice
  messages, hunt submissions, likes, guest-session creation) go through
  Next.js Route Handlers (`app/api/**`) using the service-role client
  (`lib/supabase/admin.ts`), which validates gallery settings/limits in
  application code — RLS never grants the anon key direct write access to
  guest tables. Public reads (browsing a public gallery) go straight to
  Supabase via RLS `select` policies scoped to `gallery_settings.privacy =
  'public'`.
- Owners sign in with email/password (Supabase Auth) to manage their
  gallery — see `/login`, `/signup`, `proxy.ts` (Next 16 renamed
  `middleware.ts`), and `lib/supabase/middleware.ts`.
- **Phase 3 (real AI face recognition, AI content moderation) is
  intentionally out of scope for this pass** — "Find My Photos" stays a
  mocked UI (`components/findme/FindMeSheet.tsx`), and moderation is
  manual-only (owner hide/delete in `/dashboard`); nothing publishes to
  `face_embeddings`/`face_search_requests`.
- Known limitation: only `privacy: 'public'` galleries have a real secure
  RLS read path today — `'private'`/`'password'` privacy modes aren't
  enforced yet (flagged in the dashboard's Gallery Settings panel).

### Implemented

- **Public gallery** (`/g/[slug]`, demo at `/g/demo`): hero header with
  event name/date/venue/media counts, category filters (All / Photos /
  Videos / Speeches / Ceremony / Couple) with live counts, responsive
  masonry gallery (2 columns mobile → 4 desktop) with lazy-loaded images,
  video thumbnails, and infinite scroll. Data comes from Supabase
  (`lib/data/galleries.ts`, `lib/data/gallery-content.ts`), gated by RLS to
  public galleries only.
- **Media viewer**: full-screen photo/video viewer with prev/next, like,
  download, share, swipe-to-navigate and pinch-to-zoom on touch, native
  `<video>` controls for clips.
- **Real upload pipeline** (`lib/upload-media.ts`): the browser requests a
  signed Supabase Storage upload URL (`/api/galleries/[slug]/media/request-upload`),
  PUTs the file directly to Storage, captures a poster frame + duration for
  video client-side (`lib/video-poster.ts`, no server-side ffmpeg step),
  reads photo dimensions client-side (`lib/image-dimensions.ts`), then
  finalizes the `media` row (`/api/media/[id]/complete`). Photos are served
  through `next/image` against the Storage public URL for responsive/
  optimized delivery — no separate thumbnail-generation pipeline needed.
- **Offline upload queue**: if a guest is offline, selected files are
  written to IndexedDB (`lib/offline-queue.ts`); `lib/offline-upload-drain.ts`
  replays them through the real upload pipeline once connectivity returns
  or the service worker's Background Sync wakes the page.
- **Realtime gallery** (`lib/realtime/useGalleryRealtime.ts`): guests
  currently viewing a gallery see new uploads and guestbook posts appear
  live via Supabase Realtime, no manual refresh.
- **Guest sessions**: anonymous, no-signup identity persisted in
  `localStorage` (`lib/guest-session.ts`) and mirrored server-side via
  `POST /api/guest-sessions` so it can be referenced by other tables' FKs.
- **Guestbook**, **Voice Guestbook** (MediaRecorder API, 60s cap, playback,
  re-record, uploaded to Storage), **Photo Hunt** (categorized challenges,
  per-guest progress via `hunt_submissions`, capture-to-complete flow),
  **Find My Photos** (intentionally mocked — see Phase 3 note above), and
  **Order of the Day** schedule.
- **Sharing & QR codes**: copy link, WhatsApp share, native Web Share API,
  QR code generation with PNG/SVG download, and a printable "wedding card"
  PDF (name, date, QR, instructions) via `jspdf`.
- **Mobile bottom navigation** (Upload / Guestbook / Hunt / Voice / More)
  with `env(safe-area-inset-bottom)` handling; a "More" sheet surfaces
  Order of the Day, Find My Photos, Jump to Gallery, View All, Share.
- **Admin dashboard** (`/dashboard`): real stats from Supabase
  (photos/videos/guests/messages/voice/storage/hunt completion), media grid
  with select/hide/delete/bulk actions wired to `/api/galleries/[id]/media/bulk`,
  a gallery settings panel wired to `PATCH /api/galleries/[id]/settings`,
  and a streaming ZIP export (`GET /api/galleries/[id]/export`).
- **PWA**: web manifest (`app/manifest.ts`), install-to-home-screen icons,
  and a service worker that caches the app shell for offline navigation.
- **Owner auth**: email/password via Supabase Auth (`/login`, `/signup`),
  session refresh + route protection in `proxy.ts` (this Next.js version
  renamed `middleware.ts` → `proxy.ts`).

### Not implemented (Phase 3, intentionally out of scope this pass)

Real AI face recognition (embedding + vector search — `face_embeddings`/
`face_search_requests` stay empty), AI content moderation (moderation is
manual-only via the dashboard), AI duplicate detection, AI highlights/reels,
and a background-job ZIP export for very large galleries (today's export is
a synchronous streaming response, fine for one event's worth of media —
see the export route's comments for the pgmq/pg_cron upgrade path).
Private/password-protected galleries also aren't enforced at the RLS layer
yet — only `privacy: 'public'` has a secure read path.

## Design system

Visual direction (colors, typography, spacing/shadow scale, and UX
guardrails) comes from the [`ui-ux-pro-max`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
Claude Code skill (MIT-licensed, vendored at `.claude/skills/ui-ux-pro-max/`),
generated by running its `--design-system` search for "wedding celebration
romantic elegant photo gallery" and persisted at
`design-system/wedding-gallery-platform/MASTER.md`:

- **Palette:** primary `#DB2777` (pink), accent `#A16207` (gold), background
  `#FDF2F8`, foreground `#831843` — plus a matching dark-mode set in
  `app/globals.css`.
- **Typography:** Cormorant Infant for all display headings, Inter for
  body/UI text, and Great Vibes reserved for small decorative accents (e.g.
  the "&" in the couple's names) — script fonts hurt legibility at UI sizes,
  so it's intentionally not used for anything a guest needs to read quickly.
- **UX guardrails applied:** visible `:focus-visible` rings, `cursor: pointer`
  on all interactive elements, 200ms transitions by default,
  `prefers-reduced-motion` support, and pinch-zoom re-enabled in the viewport
  meta (a fixed `maximumScale` was flagged as an accessibility anti-pattern).

Re-run the search for a different mood/keywords, or query a specific
`--domain` (ux, typography, color, nextjs stack, …), with:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "Wedding Gallery Platform"
```

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + RLS, Auth, Storage, Realtime) via `@supabase/supabase-js` + `@supabase/ssr`
- `archiver` (ZIP export), `qrcode` (QR generation), `jspdf` (printable
  wedding card), `idb` (IndexedDB wrapper for the offline queue),
  `lucide-react` (icons)

## Getting started

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (Supabase
   Dashboard → Project Settings → API — the service role key can't be
   fetched via the Supabase MCP server, so it has to come from there).
3. Apply `db/schema.sql` and everything in `supabase/migrations/` to your
   Supabase project if you haven't already (this repo's project already has
   them applied).
4. `node scripts/seed-demo-gallery.mjs` — creates the owner account
   (`lmateocc99@gmail.com`) and the `demo` gallery (Mateo & Genesis) with
   default albums, Photo Hunt challenges, Order of the Day, and a few
   placeholder photos, so `/g/demo` isn't empty.
5. `npm run dev`, then open
   [http://localhost:3000/g/demo](http://localhost:3000/g/demo) for the
   gallery or [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
   (sign in with the seed script's printed owner credentials) for the
   dashboard.

## Project structure

```
app/
  page.tsx                 marketing landing page
  g/[slug]/                public gallery (page.tsx + GalleryApp.tsx client shell)
  dashboard/                owner dashboard
  login/ signup/            owner auth pages
  auth/callback/            Supabase Auth email-confirmation callback
  create/                   owner-only gallery creation wizard
  api/                      Route Handlers — guest writes (admin client) +
                             owner-only mutations (cookie-aware client, RLS)
  manifest.ts               PWA manifest
proxy.ts                    session refresh + /dashboard,/create auth gate
                            (this Next.js version renamed middleware.ts)
components/
  gallery/                 hero, category nav, masonry grid, media viewer, bottom nav
  upload/                  Share Your Memories sheet + progress list
  guestbook/ voice/ hunt/ findme/ schedule/ share/   feature sheets
  sheets/                  shared BottomSheet primitive
lib/
  types.ts                 domain types mirroring db/schema.sql
  mock-data.ts             demo event data shape (reference/seed only, not read by any page)
  guest-session.ts         anonymous guest identity + Photo Hunt progress
  offline-queue.ts         IndexedDB offline upload queue
  offline-upload-drain.ts  drains the offline queue through the real upload pipeline
  upload-media.ts          the one real-upload code path (signed URL → Storage → finalize)
  video-poster.ts          client-side video poster-frame + duration capture
  image-dimensions.ts      client-side photo dimension probe
  realtime/useGalleryRealtime.ts   live new-media updates via Supabase Realtime
  data/                    server-side Supabase queries (galleries, gallery content, dashboard)
  qr.ts                    QR code + wedding card generation
db/
  schema.sql               base Postgres/Supabase schema
supabase/
  migrations/              RLS policies, indexes, realtime publication, storage bucket
scripts/
  seed-demo-gallery.mjs    seeds the owner account + "demo" gallery
public/
  sw.js                    PWA service worker
lib/supabase/
  client.ts                browser Supabase client (anon key, RLS-respecting)
  server.ts                server-component/action/Route Handler client (cookie-aware, RLS)
  admin.ts                 service-role client — server-only, bypasses RLS
  middleware.ts            @supabase/ssr session-refresh helper, used by proxy.ts
  storage.ts               Storage bucket/path helpers
  env.ts                   isSupabaseConfigured() feature-flag check
```

## Owner onboarding + QR card customization

- `/create` — a 3-step form (auth-gated by `proxy.ts`) that `POST`s to
  `/api/galleries`, which inserts the gallery + settings + default albums
  scoped to the signed-in owner, then redirects to the live `/g/[slug]`.
- `/dashboard/qr-card?slug=<slug>` — customize the printable QR wedding
  card (names, date, tagline, typography, colors, QR size, logo) with a
  live preview, then export PDF/PNG/SVG. `lib/qr.ts#generateWeddingCardPdf`
  is the reusable builder both this page and the gallery's Share sheet call.

## Security model

- RLS is enabled on all 21 tables (`supabase/migrations/00001_enable_rls.sql`).
  Public `select` policies only ever expose rows belonging to a
  `privacy: 'public'` gallery; owner policies scope everything to
  `auth.uid() = galleries.owner_id`.
- Guests never get real credentials, so guest writes never go through RLS
  at all — every guest-facing mutation is a Route Handler using the
  service-role client, which validates gallery settings and limits in
  TypeScript. A leaked anon key alone can't write to a guest table.
- The `media` Storage bucket is public-read (guests browse without auth)
  but write-only via signed upload URLs minted server-side per upload —
  there's no anon Storage write policy.
