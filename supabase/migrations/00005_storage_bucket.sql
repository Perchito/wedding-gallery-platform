-- Single public bucket for all gallery media + voice messages. Public
-- because guests never authenticate and photos/voice notes are meant to be
-- viewable by anyone with the gallery link; writes only ever happen via
-- signed upload URLs minted server-side (service role), so no anon INSERT
-- storage policy is needed or granted.
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 524288000)
on conflict (id) do update set public = true, file_size_limit = 524288000;
