-- Background ZIP export job queue — replaces the old synchronous streaming
-- route so a large gallery export never has to fit inside one HTTP request.
create table zip_export_jobs (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  download_url text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table zip_export_jobs enable row level security;

create policy "owners manage their zip export jobs" on zip_export_jobs
  for all to authenticated
  using (
    exists (select 1 from galleries g where g.id = zip_export_jobs.gallery_id and g.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from galleries g where g.id = zip_export_jobs.gallery_id and g.owner_id = auth.uid())
  );

-- Atomic dequeue for the cron worker (service role only) — `for update skip
-- locked` means two overlapping cron ticks can never claim the same job.
create or replace function public.claim_next_zip_job()
returns setof zip_export_jobs
language plpgsql
set search_path = public
as $$
declare
  claimed zip_export_jobs;
begin
  select * into claimed from zip_export_jobs
    where status = 'pending'
    order by created_at
    limit 1
    for update skip locked;
  if claimed.id is not null then
    update zip_export_jobs set status = 'processing' where id = claimed.id;
    claimed.status := 'processing';
    return next claimed;
  end if;
  return;
end;
$$;

revoke all on function public.claim_next_zip_job() from anon, authenticated, public;
grant execute on function public.claim_next_zip_job() to service_role;
