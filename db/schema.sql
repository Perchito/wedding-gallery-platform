-- ---------------------------------------------------------------------------
-- Wedding Gallery Platform — reference schema (PostgreSQL / Supabase)
--
-- This is NOT wired up in the Phase 1 MVP (which runs on in-memory mock data,
-- see lib/mock-data.ts). It documents the target data model referenced
-- throughout the app's types (lib/types.ts) so Phase 2/3 backend work can be
-- implemented against it without redesigning the frontend.
--
-- Multi-tenant: every row scopes to a gallery, and every gallery scopes to an
-- owner (user/customer). Row-Level Security policies (sketched at the bottom)
-- must enforce that a customer/guest can only touch rows for their own
-- gallery — never another tenant's.
-- ---------------------------------------------------------------------------

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Users / accounts (gallery owners)
-- ---------------------------------------------------------------------------
create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Galleries
-- ---------------------------------------------------------------------------
create table galleries (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references users(id) on delete cascade,
  slug text unique not null,
  event_name text not null,
  partner_a text,
  partner_b text,
  event_date date,
  venue text,
  hero_image_url text,
  description text,
  created_at timestamptz not null default now()
);

create table gallery_settings (
  gallery_id uuid primary key references galleries(id) on delete cascade,
  allow_uploads boolean not null default true,
  allow_browsing boolean not null default true,
  allow_downloads boolean not null default true,
  allow_guestbook boolean not null default true,
  allow_voice_messages boolean not null default true,
  allow_photo_hunt boolean not null default true,
  privacy text not null default 'public' check (privacy in ('public', 'private', 'password')),
  password_hash text
);

create table albums (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  name text not null,
  icon text,
  sort_order int not null default 0,
  visibility text not null default 'public' check (visibility in ('public', 'hidden'))
);

create table storage_usage (
  gallery_id uuid primary key references galleries(id) on delete cascade,
  bytes_used bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Guest sessions (anonymous, no signup required)
-- ---------------------------------------------------------------------------
create table guest_sessions (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  guest_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------
create table media (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  album_id uuid references albums(id) on delete set null,
  guest_session_id uuid references guest_sessions(id) on delete set null,
  uploader_name text,
  media_type text not null check (media_type in ('photo', 'video')),
  original_url text not null,
  thumbnail_url text,
  preview_url text,
  width int,
  height int,
  duration_seconds numeric,
  caption text,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'flagged', 'removed')),
  created_at timestamptz not null default now()
);

create table media_processing_jobs (
  id uuid primary key default uuid_generate_v4(),
  media_id uuid not null references media(id) on delete cascade,
  job_type text not null check (
    job_type in (
      'thumbnail', 'web_image', 'full_image', 'video_thumbnail',
      'video_metadata', 'ai_moderation'
    )
  ),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table media_categories (
  media_id uuid not null references media(id) on delete cascade,
  category text not null check (
    category in ('photos', 'videos', 'speeches', 'ceremony', 'couple')
  ),
  primary key (media_id, category)
);

create table media_likes (
  media_id uuid not null references media(id) on delete cascade,
  guest_session_id uuid not null references guest_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (media_id, guest_session_id)
);

-- ---------------------------------------------------------------------------
-- Guestbook & voice messages
-- ---------------------------------------------------------------------------
create table guestbook_messages (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  guest_session_id uuid references guest_sessions(id) on delete set null,
  guest_name text,
  message text not null,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'removed')),
  created_at timestamptz not null default now()
);

create table voice_messages (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  guest_session_id uuid references guest_sessions(id) on delete set null,
  guest_name text,
  audio_url text not null,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Photo Hunt
-- ---------------------------------------------------------------------------
create table hunt_categories (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create table hunt_challenges (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  category_id uuid references hunt_categories(id) on delete set null,
  title text not null,
  prompt text,
  sort_order int not null default 0
);

create table hunt_submissions (
  id uuid primary key default uuid_generate_v4(),
  challenge_id uuid not null references hunt_challenges(id) on delete cascade,
  guest_session_id uuid not null references guest_sessions(id) on delete cascade,
  media_id uuid references media(id) on delete set null,
  completed_at timestamptz not null default now(),
  unique (challenge_id, guest_session_id)
);

-- ---------------------------------------------------------------------------
-- Event schedule ("Order of the Day")
-- ---------------------------------------------------------------------------
create table event_schedule (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  time text not null,
  title text not null,
  description text,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------------
-- QR codes
-- ---------------------------------------------------------------------------
create table qr_codes (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Analytics events
-- ---------------------------------------------------------------------------
create table analytics_events (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  guest_session_id uuid references guest_sessions(id) on delete set null,
  event_type text not null check (
    event_type in (
      'gallery_view', 'upload_started', 'upload_completed', 'media_viewed',
      'media_downloaded', 'guestbook_message', 'voice_message',
      'hunt_started', 'hunt_completed'
    )
  ),
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-Level Security sketch (tenant isolation)
-- ---------------------------------------------------------------------------
-- alter table galleries enable row level security;
-- create policy "owners manage their galleries" on galleries
--   for all using (owner_id = auth.uid());
--
-- alter table media enable row level security;
-- create policy "public can read approved media of public galleries" on media
--   for select using (
--     moderation_status = 'approved'
--     and exists (
--       select 1 from galleries g
--       join gallery_settings gs on gs.gallery_id = g.id
--       where g.id = media.gallery_id and gs.privacy = 'public'
--     )
--   );
-- create policy "owners manage their gallery's media" on media
--   for all using (
--     exists (select 1 from galleries g where g.id = media.gallery_id and g.owner_id = auth.uid())
--   );
--
-- Guest-write policies (insert-only, scoped to gallery + settings flags) follow
-- the same shape for guestbook_messages, voice_messages, hunt_submissions, etc.
