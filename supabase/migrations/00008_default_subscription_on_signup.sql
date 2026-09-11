-- Extend handle_new_user() (00002_auth_user_sync.sql) to also give every
-- new owner a default "free" subscription row, so lib/plans.ts#getOwnerPlan
-- has something to read for gallery-count/storage limit enforcement.
-- Existing owners with no row already default to "free" via that function's
-- fallback, so no backfill is needed.
--
-- Schema-level billing only (no real payment processing) means exactly one
-- subscription row per user is enough — add the unique constraint so
-- `on conflict do nothing` below actually has something to conflict against.
alter table subscriptions add constraint subscriptions_user_id_key unique (user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;
