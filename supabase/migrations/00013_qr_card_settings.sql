-- Persist the QR wedding card customizer's styling choices per gallery,
-- replacing the browser-only localStorage save that shipped first (it
-- didn't survive a different browser/device). Nullable: existing rows and
-- galleries that never open the customizer just keep the app's defaults.
-- Owner read/write already covered by the existing "owners manage their
-- gallery settings" RLS policy (FOR ALL) — no policy change needed.
alter table gallery_settings
  add column if not exists qr_card_settings jsonb;
