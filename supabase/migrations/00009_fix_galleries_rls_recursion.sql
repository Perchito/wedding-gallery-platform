-- Bug found via a full-table-scan query (list all of an owner's galleries,
-- no id filter): "infinite recursion detected in policy for relation
-- galleries". Root cause — a genuine mutual-recursion cycle between two RLS
-- policies:
--   galleries' "public can read public galleries" policy queries
--   gallery_settings, and gallery_settings' "owners manage their gallery
--   settings" policy queries galleries right back. A single indexed
--   `.eq('id', x)` lookup happened to avoid tripping Postgres's recursion
--   guard; a table-wide scan does not.
--
-- Fix: break the cycle by moving the galleries-side check into a
-- SECURITY DEFINER function. Query planner/owner privileges mean this
-- function's internal read of gallery_settings does not re-trigger RLS,
-- so the cycle never closes.
create or replace function public.gallery_is_public(check_gallery_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from gallery_settings gs
    where gs.gallery_id = check_gallery_id and gs.privacy = 'public' and gs.allow_browsing
  );
$$;

revoke all on function public.gallery_is_public(uuid) from public;
grant execute on function public.gallery_is_public(uuid) to anon, authenticated;

drop policy if exists "public can read public galleries" on galleries;
create policy "public can read public galleries" on galleries
  for select to anon, authenticated
  using (gallery_is_public(id));
