create index if not exists media_gallery_status_idx on media (gallery_id, processing_status);
create index if not exists media_gallery_created_idx on media (gallery_id, created_at desc);
create index if not exists guestbook_messages_gallery_approval_idx on guestbook_messages (gallery_id, approval_status);
create index if not exists voice_messages_gallery_idx on voice_messages (gallery_id);
create index if not exists guest_sessions_gallery_idx on guest_sessions (gallery_id);
create index if not exists analytics_events_gallery_created_idx on analytics_events (gallery_id, created_at);
