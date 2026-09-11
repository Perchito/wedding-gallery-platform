-- Powers the ZIP-export background worker's schedule. The actual
-- cron.schedule(...) call referencing the production URL + Vault secret is
-- applied separately (not committed here) since it embeds an
-- environment-specific URL and must reference a secret already stored in
-- Supabase Vault — see the deployment notes in README.md.
create extension if not exists pg_cron;
create extension if not exists pg_net;
