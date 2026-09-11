-- Let guests currently viewing a gallery see new uploads/guestbook posts
-- live via Supabase Realtime (Postgres Changes) without a manual refresh.
alter publication supabase_realtime add table media;
alter publication supabase_realtime add table guestbook_messages;
