-- ---------------------------------------------------------------------------
-- Enable Row Level Security on every table and add the tenant-isolation
-- policies sketched (but never applied) at the bottom of db/schema.sql.
--
-- Design:
--   * Owners get full CRUD on everything scoped to their own galleries via
--     `auth.uid() = galleries.owner_id` (directly, or via a join for
--     gallery-scoped child tables).
--   * The public (anon + authenticated) gets SELECT-only access to content
--     belonging to a gallery with gallery_settings.privacy = 'public' and
--     gs.allow_browsing = true, further gated per-table by the relevant
--     allow_* flag and (for media) processing/moderation status.
--   * Guest WRITES (uploads, guestbook, voice, hunt submissions, likes,
--     guest-session creation) are never granted via RLS at all — guests
--     never authenticate, so there's no auth.uid() to check. All guest
--     writes instead go through Next.js Route Handlers using the
--     service-role client (lib/supabase/admin.ts), which bypasses RLS by
--     design and validates gallery settings/limits in application code.
--     This means even a leaked anon key can never be used to write to a
--     guest table.
--   * face_embeddings / face_search_requests get RLS enabled with zero
--     policies (fully locked) — "Find My Photos" is stubbed in this pass.
-- ---------------------------------------------------------------------------

alter table users enable row level security;
alter table subscriptions enable row level security;
alter table galleries enable row level security;
alter table gallery_settings enable row level security;
alter table albums enable row level security;
alter table storage_usage enable row level security;
alter table guest_sessions enable row level security;
alter table media enable row level security;
alter table media_processing_jobs enable row level security;
alter table media_categories enable row level security;
alter table media_likes enable row level security;
alter table guestbook_messages enable row level security;
alter table voice_messages enable row level security;
alter table hunt_categories enable row level security;
alter table hunt_challenges enable row level security;
alter table hunt_submissions enable row level security;
alter table face_embeddings enable row level security;
alter table face_search_requests enable row level security;
alter table event_schedule enable row level security;
alter table qr_codes enable row level security;
alter table analytics_events enable row level security;

-- ---------------------------------------------------------------------------
-- users / subscriptions — self-access only
-- ---------------------------------------------------------------------------
create policy "users read own row" on users
  for select to authenticated
  using (auth.uid() = id);

create policy "subscriptions read own row" on subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- galleries
-- ---------------------------------------------------------------------------
create policy "owners manage their galleries" on galleries
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "public can read public galleries" on galleries
  for select to anon, authenticated
  using (
    exists (
      select 1 from gallery_settings gs
      where gs.gallery_id = galleries.id
        and gs.privacy = 'public'
        and gs.allow_browsing
    )
  );

-- ---------------------------------------------------------------------------
-- gallery_settings
-- ---------------------------------------------------------------------------
create policy "owners manage their gallery settings" on gallery_settings
  for all to authenticated
  using (
    exists (select 1 from galleries g where g.id = gallery_settings.gallery_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from galleries g where g.id = gallery_settings.gallery_id and g.owner_id = auth.uid())
  );

create policy "public can read public gallery settings" on gallery_settings
  for select to anon, authenticated
  using (privacy = 'public' and allow_browsing);

-- ---------------------------------------------------------------------------
-- albums
-- ---------------------------------------------------------------------------
create policy "owners manage their albums" on albums
  for all to authenticated
  using (
    exists (select 1 from galleries g where g.id = albums.gallery_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from galleries g where g.id = albums.gallery_id and g.owner_id = auth.uid())
  );

create policy "public can read public albums of public galleries" on albums
  for select to anon, authenticated
  using (
    visibility = 'public'
    and exists (
      select 1 from gallery_settings gs
      where gs.gallery_id = albums.gallery_id and gs.privacy = 'public' and gs.allow_browsing
    )
  );

-- ---------------------------------------------------------------------------
-- storage_usage — owner-only, no public policy
-- ---------------------------------------------------------------------------
create policy "owners read their storage usage" on storage_usage
  for select to authenticated
  using (
    exists (select 1 from galleries g where g.id = storage_usage.gallery_id and g.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- guest_sessions — owner read-only (guest counts for the dashboard); all
-- writes happen server-side via the admin client (POST /api/guest-sessions).
-- ---------------------------------------------------------------------------
create policy "owners read guest sessions for their galleries" on guest_sessions
  for select to authenticated
  using (
    exists (select 1 from galleries g where g.id = guest_sessions.gallery_id and g.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------
create policy "owners manage their gallery media" on media
  for all to authenticated
  using (
    exists (select 1 from galleries g where g.id = media.gallery_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from galleries g where g.id = media.gallery_id and g.owner_id = auth.uid())
  );

create policy "public can read ready approved media of public galleries" on media
  for select to anon, authenticated
  using (
    processing_status = 'ready'
    and moderation_status = 'approved'
    and exists (
      select 1 from gallery_settings gs
      where gs.gallery_id = media.gallery_id and gs.privacy = 'public' and gs.allow_browsing
    )
  );

-- ---------------------------------------------------------------------------
-- media_processing_jobs — owner-only (unused in this pass, no ffmpeg/AI
-- pipeline; kept locked for when a real processing step is added later).
-- ---------------------------------------------------------------------------
create policy "owners read processing jobs for their media" on media_processing_jobs
  for select to authenticated
  using (
    exists (
      select 1 from media m
      join galleries g on g.id = m.gallery_id
      where m.id = media_processing_jobs.media_id and g.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- media_categories — mirrors media visibility (drives the public category
-- filter counts), owner can manage.
-- ---------------------------------------------------------------------------
create policy "owners manage media categories" on media_categories
  for all to authenticated
  using (
    exists (
      select 1 from media m join galleries g on g.id = m.gallery_id
      where m.id = media_categories.media_id and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from media m join galleries g on g.id = m.gallery_id
      where m.id = media_categories.media_id and g.owner_id = auth.uid()
    )
  );

create policy "public can read categories of visible media" on media_categories
  for select to anon, authenticated
  using (
    exists (
      select 1 from media m
      join gallery_settings gs on gs.gallery_id = m.gallery_id
      where m.id = media_categories.media_id
        and m.processing_status = 'ready'
        and m.moderation_status = 'approved'
        and gs.privacy = 'public'
        and gs.allow_browsing
    )
  );

-- ---------------------------------------------------------------------------
-- media_likes — public can read (to render like counts / own-like state);
-- writes go through POST/DELETE /api/media/:id/like (admin client).
-- ---------------------------------------------------------------------------
create policy "owners read media likes" on media_likes
  for select to authenticated
  using (
    exists (
      select 1 from media m join galleries g on g.id = m.gallery_id
      where m.id = media_likes.media_id and g.owner_id = auth.uid()
    )
  );

create policy "public can read likes of visible media" on media_likes
  for select to anon, authenticated
  using (
    exists (
      select 1 from media m
      join gallery_settings gs on gs.gallery_id = m.gallery_id
      where m.id = media_likes.media_id
        and m.processing_status = 'ready'
        and m.moderation_status = 'approved'
        and gs.privacy = 'public'
        and gs.allow_browsing
    )
  );

-- ---------------------------------------------------------------------------
-- guestbook_messages
-- ---------------------------------------------------------------------------
create policy "owners manage guestbook messages" on guestbook_messages
  for all to authenticated
  using (
    exists (select 1 from galleries g where g.id = guestbook_messages.gallery_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from galleries g where g.id = guestbook_messages.gallery_id and g.owner_id = auth.uid())
  );

create policy "public can read approved guestbook messages" on guestbook_messages
  for select to anon, authenticated
  using (
    approval_status = 'approved'
    and exists (
      select 1 from gallery_settings gs
      where gs.gallery_id = guestbook_messages.gallery_id
        and gs.privacy = 'public' and gs.allow_browsing and gs.allow_guestbook
    )
  );

-- ---------------------------------------------------------------------------
-- voice_messages
-- ---------------------------------------------------------------------------
create policy "owners manage voice messages" on voice_messages
  for all to authenticated
  using (
    exists (select 1 from galleries g where g.id = voice_messages.gallery_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from galleries g where g.id = voice_messages.gallery_id and g.owner_id = auth.uid())
  );

create policy "public can read voice messages" on voice_messages
  for select to anon, authenticated
  using (
    exists (
      select 1 from gallery_settings gs
      where gs.gallery_id = voice_messages.gallery_id
        and gs.privacy = 'public' and gs.allow_browsing and gs.allow_voice_messages
    )
  );

-- ---------------------------------------------------------------------------
-- hunt_categories / hunt_challenges
-- ---------------------------------------------------------------------------
create policy "owners manage hunt categories" on hunt_categories
  for all to authenticated
  using (
    exists (select 1 from galleries g where g.id = hunt_categories.gallery_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from galleries g where g.id = hunt_categories.gallery_id and g.owner_id = auth.uid())
  );

create policy "public can read hunt categories" on hunt_categories
  for select to anon, authenticated
  using (
    exists (
      select 1 from gallery_settings gs
      where gs.gallery_id = hunt_categories.gallery_id
        and gs.privacy = 'public' and gs.allow_browsing and gs.allow_photo_hunt
    )
  );

create policy "owners manage hunt challenges" on hunt_challenges
  for all to authenticated
  using (
    exists (select 1 from galleries g where g.id = hunt_challenges.gallery_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from galleries g where g.id = hunt_challenges.gallery_id and g.owner_id = auth.uid())
  );

create policy "public can read hunt challenges" on hunt_challenges
  for select to anon, authenticated
  using (
    exists (
      select 1 from gallery_settings gs
      where gs.gallery_id = hunt_challenges.gallery_id
        and gs.privacy = 'public' and gs.allow_browsing and gs.allow_photo_hunt
    )
  );

-- ---------------------------------------------------------------------------
-- hunt_submissions — owner read-only (dashboard participation stats); all
-- writes go through POST /api/hunt/:challengeId/submissions (admin client).
-- ---------------------------------------------------------------------------
create policy "owners read hunt submissions" on hunt_submissions
  for select to authenticated
  using (
    exists (
      select 1 from hunt_challenges hc
      join galleries g on g.id = hc.gallery_id
      where hc.id = hunt_submissions.challenge_id and g.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- event_schedule
-- ---------------------------------------------------------------------------
create policy "owners manage event schedule" on event_schedule
  for all to authenticated
  using (
    exists (select 1 from galleries g where g.id = event_schedule.gallery_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from galleries g where g.id = event_schedule.gallery_id and g.owner_id = auth.uid())
  );

create policy "public can read event schedule" on event_schedule
  for select to anon, authenticated
  using (
    exists (
      select 1 from gallery_settings gs
      where gs.gallery_id = event_schedule.gallery_id and gs.privacy = 'public' and gs.allow_browsing
    )
  );

-- ---------------------------------------------------------------------------
-- qr_codes — owner-only, not exposed publicly (QR image itself is generated
-- client-side from the gallery's public URL, no DB read needed to render it)
-- ---------------------------------------------------------------------------
create policy "owners manage their qr codes" on qr_codes
  for all to authenticated
  using (
    exists (select 1 from galleries g where g.id = qr_codes.gallery_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from galleries g where g.id = qr_codes.gallery_id and g.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- analytics_events — owner-only; writes happen via the admin client
-- ---------------------------------------------------------------------------
create policy "owners read their analytics events" on analytics_events
  for select to authenticated
  using (
    exists (select 1 from galleries g where g.id = analytics_events.gallery_id and g.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- face_embeddings / face_search_requests — RLS enabled, zero policies.
-- "Find My Photos" stays stubbed in this pass; only the service-role client
-- (which bypasses RLS) could touch these, and nothing in the app does yet.
-- ---------------------------------------------------------------------------
