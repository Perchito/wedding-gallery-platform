-- Remove the "Find My Photos" AI face-recognition concept entirely — it was
-- always a mocked/stubbed UI, never wired to a real pipeline, and both
-- tables have zero rows and zero application references.
drop table if exists face_search_requests;
drop table if exists face_embeddings;

alter table gallery_settings drop column if exists allow_face_search;

-- Nothing else uses pgvector once face embeddings are gone.
drop extension if exists vector;

-- media_processing_jobs.job_type and analytics_events.event_type both had
-- a face-recognition-related enum value in their check constraints; redefine
-- both without it. Neither table has any rows referencing the old value.
alter table media_processing_jobs drop constraint if exists media_processing_jobs_job_type_check;
alter table media_processing_jobs add constraint media_processing_jobs_job_type_check
  check (
    job_type in (
      'thumbnail', 'web_image', 'full_image', 'video_thumbnail',
      'video_metadata', 'ai_moderation'
    )
  );

alter table analytics_events drop constraint if exists analytics_events_event_type_check;
alter table analytics_events add constraint analytics_events_event_type_check
  check (
    event_type in (
      'gallery_view', 'upload_started', 'upload_completed', 'media_viewed',
      'media_downloaded', 'guestbook_message', 'voice_message',
      'hunt_started', 'hunt_completed'
    )
  );
