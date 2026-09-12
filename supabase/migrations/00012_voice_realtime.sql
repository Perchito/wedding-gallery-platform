-- Live voice + guestbook updates in the guest gallery.
-- media and guestbook_messages were added in 00004; voice_messages joins
-- them so VoiceMessageList updates without a manual refresh. Applied to
-- production 2026-09-12.
alter publication supabase_realtime add table voice_messages;