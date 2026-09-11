# Wedding Gallery Platform

A mobile-first wedding & event photo-sharing platform: guests scan a QR code
or open a link, land straight in the event gallery, and can take or upload
photos/videos without creating an account. Built as a Next.js PWA.

Live demo route: **`/g/demo`** — *Mateo & Genesis, 20 March 2026*.

## Status: multi-tenant SaaS on a real Supabase backend

This repo implements the **Phase 1 + 2** guest-facing feature set end-to-end,
plus the SaaS layer on top: a multi-gallery owner dashboard, real analytics,
schema-level billing tiers, and a background ZIP export job — all backed by
a real Supabase project (Postgres with RLS, Auth, Storage, Realtime).
`lib/mock-data.ts` still exists as a reference/seed shape but is no longer
read by any page.

- Guests never authenticate. All guest writes (uploads, guestbook, voice
  messages, hunt submissions, likes, guest-session creation) go through
  Next.js Route Handlers (`app/api/**`) using the service-role client
  (`lib/supabase/admin.ts`), which validates gallery settings/limits in
  application code — RLS never grants the anon key direct write access to
  guest tables. Public reads (browsing a public gallery) go straight to
  Supabase via RLS `select` policies scoped to `gallery_settings.privacy =
  'public'`.
- Owners sign in with email/password (Supabase Auth) to manage their
  gallery(ies) — see `/login`, `/signup`, `proxy.ts` (Next 16 renamed
  `middleware.ts`), and `lib/supabase/middleware.ts`.
- **AI features (face recognition, AI content moderation) are intentionally
  not part of this product** — removed entirely (no "Find My Photos" UI, no
  `face_embeddings`/`face_search_requests` tables, no `allow_face_search`
  setting). Moderation is manual-only (owner hide/delete in the dashboard).
- **Billing is schema-level only, no real payments** — `subscriptions.plan`
  (`free`/`pro`, see `lib/plans.ts`) gates gallery-count and storage limits
  in code; there's no Stripe/checkout integration.
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
  per-guest progress via `hunt_submissions`, capture-to-complete flow), and
  **Order of the Day** schedule.
- **Sharing & QR codes**: copy link, WhatsApp share, native Web Share API,
  QR code generation with PNG/SVG download, and a printable "wedding card"
  PDF (name, date, QR, instructions) via `jspdf`. Each gallery gets a
  `qr_codes` row on creation (`app/api/galleries/route.ts`).
- **Mobile bottom navigation** (Upload / Guestbook / Hunt / Voice / More)
  with `env(safe-area-inset-bottom)` handling; a "More" sheet surfaces
  Order of the Day, Jump to Gallery, View All, Share.
- **Multi-gallery owner dashboard** (`/dashboard`): lists all of an owner's
  galleries (auto-redirects straight to the single gallery's detail page
  when there's only one), with a plan/usage card (`lib/plans.ts`, see
  billing below). Each gallery has its own
  `/dashboard/galleries/[galleryId]/...` detail page with real stats
  (photos/videos/guests/messages/voice/storage/hunt completion), a media
  grid with select/hide/delete/bulk actions
  (`/api/galleries/[id]/media/bulk`), a gallery settings panel
  (`PATCH /api/galleries/[id]/settings`), an Order of the Day editor
  (`.../schedule`), a QR card customizer (`.../qr-card`), an analytics page
  (`.../analytics`, see below), and a background ZIP export.
- **Analytics** (`.../analytics`): every guest action (`gallery_view`,
  `upload_started`/`upload_completed`, `guestbook_message`,
  `voice_message`, `media_viewed`/`media_downloaded`, `hunt_started`/
  `hunt_completed`) is recorded to `analytics_events`
  (`lib/track-event.ts` client-side, direct inserts server-side). The
  dashboard page (`lib/data/analytics.ts` + `AnalyticsView.tsx`) aggregates
  these into stat cards, a 14-day daily-views chart, and a most-active-
  contributors leaderboard.
- **Schema-level billing** (`lib/plans.ts`): every new owner gets a
  `subscriptions` row (`free` plan) on signup. `PLAN_LIMITS` gates gallery
  count (enforced in `POST /api/galleries`) and total storage bytes
  (enforced in `request-upload`) per plan — no real payment processor is
  wired up, this is limits-in-code only.
- **Background ZIP export**: `GET /api/galleries/[id]/export` enqueues a
  `zip_export_jobs` row instead of streaming synchronously. A Postgres
  `pg_cron` schedule hits `/api/cron/process-zip-jobs` every 2 minutes,
  which claims a job (`claim_next_zip_job()`, `for update skip locked`),
  builds the ZIP (`lib/zip-export.ts`), uploads it to Storage, and stores a
  signed download URL on the job row. The dashboard polls
  `/api/galleries/[id]/export/[jobId]` and swaps in the real download link
  once ready.
- **PWA**: web manifest (`app/manifest.ts`), install-to-home-screen icons,
  and a service worker that caches the app shell for offline navigation.
- **Owner auth**: email/password via Supabase Auth (`/login`, `/signup`),
  session refresh + route protection in `proxy.ts` (this Next.js version
  renamed `middleware.ts` → `proxy.ts`).

### Not implemented

AI features (face recognition, AI content moderation, duplicate detection,
highlights/reels) were deliberately removed from the product entirely —
not deferred, not mocked. Also not implemented, by explicit choice for this
pass: real payment processing (Stripe/checkout — billing is schema-level
limits only, see above), real malware/virus scanning on uploads, and
enforcement of `'private'`/`'password'` gallery privacy modes at the RLS
layer (only `privacy: 'public'` has a secure read path today).

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
  dashboard/
    page.tsx                gallery list / auto-redirect-if-one
    galleries/[galleryId]/
      page.tsx + DashboardApp.tsx        gallery detail (stats, media, export)
      schedule/                          Order of the Day editor
      qr-card/                           QR wedding-card customizer
      analytics/                         AnalyticsView.tsx — stat cards, chart, leaderboard
  login/ signup/            owner auth pages
  auth/callback/            Supabase Auth email-confirmation callback
  create/                   owner-only gallery creation wizard
  api/
    galleries/               gallery CRUD, settings, media, guestbook, voice-messages,
                              export (enqueue) + export/[jobId] (poll), analytics (client events)
    cron/process-zip-jobs/   background ZIP-export worker (bearer-secret protected)
    hunt/[challengeId]/submissions/
    media/[mediaId]/complete/
    guest-sessions/
  manifest.ts               PWA manifest
proxy.ts                    session refresh + /dashboard,/create auth gate
                            (this Next.js version renamed middleware.ts)
components/
  gallery/                 hero, category nav, masonry grid, media viewer, bottom nav
  upload/                  Share Your Memories sheet + progress list
  guestbook/ voice/ hunt/ schedule/ share/   feature sheets
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
  data/                    server-side Supabase queries
    galleries.ts             public gallery + content reads
    dashboard.ts             owner gallery list/detail/stats + plan usage
    schedule.ts               Order of the Day, parameterized by galleryId
    analytics.ts              analytics_events aggregation for the dashboard
  plans.ts                 PLAN_LIMITS + getOwnerPlan() — schema-level billing
  zip-export.ts            buildGalleryZip() — shared by the export worker
  track-event.ts           client helper for POST /api/galleries/[id]/analytics
  qr.ts                    QR code + wedding card generation
db/
  schema.sql               base Postgres/Supabase schema
supabase/
  migrations/              RLS policies, indexes, realtime publication, storage bucket,
                            zip_export_jobs + claim_next_zip_job(), pg_cron/pg_net
scripts/
  seed-demo-gallery.mjs    seeds the owner account + "demo" gallery
public/
  sw.js                    PWA service worker
lib/supabase/
  client.ts                browser Supabase client (anon key, RLS-respecting)
  server.ts                server-component/action/Route Handler client (cookie-aware, RLS)
  admin.ts                 service-role client — server-only, bypasses RLS
  middleware.ts            @supabase/ssr session-refresh helper, used by proxy.ts
  storage.ts               Storage bucket/path helpers + storagePathFromPublicUrl()
  env.ts                   isSupabaseConfigured() feature-flag check
```

## Owner onboarding + QR card customization

- `/create` — a 3-step form (auth-gated by `proxy.ts`) that `POST`s to
  `/api/galleries`, which inserts the gallery + settings + default albums
  scoped to the signed-in owner (subject to the plan's `maxGalleries`
  limit), inserts a `qr_codes` row, then redirects to the live `/g/[slug]`.
- `/dashboard/galleries/[galleryId]/qr-card` — customize the printable QR
  wedding card (names, date, tagline, typography, colors, QR size, logo)
  with a live preview, then export PDF/PNG/SVG.
  `lib/qr.ts#generateWeddingCardPdf` is the reusable builder both this page
  and the gallery's Share sheet call. Resolved via `getOwnerGalleryBasic`
  (RLS-scoped to the signed-in owner), not the public slug lookup.

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
- `galleries`' public-read policy and `gallery_settings`' owner policy used
  to reference each other, which is a real mutual-recursion cycle Postgres
  can hit on a full-table-scan query (it never showed up on single-row
  lookups). Fixed with a `security definer` helper, `gallery_is_public()`
  (`supabase/migrations/00009_fix_galleries_rls_recursion.sql`), that
  breaks the cycle instead of re-entering RLS.
- `zip_export_jobs` is owner-scoped RLS like everything else; the actual
  dequeue (`claim_next_zip_job()`) and the cron worker route run as
  service-role, with `execute` on the function revoked from
  `anon`/`authenticated` and granted only to `service_role`. The cron
  route itself checks a bearer secret (`CRON_SECRET`, stored in Supabase
  Vault for the `pg_cron` job and in Vercel env vars for the route) before
  doing anything.
