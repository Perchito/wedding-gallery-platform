-- Mirror new Supabase Auth users into public.users so galleries.owner_id
-- can carry a normal FK to a row this app controls (name, future profile
-- fields, etc.) instead of reaching into auth.users directly everywhere.
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
