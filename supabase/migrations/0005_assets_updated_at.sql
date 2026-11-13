-- 0005: assets.updated_at
--
-- `0001` attached the shared `touch_updated_at()` trigger to `assets`, but the
-- table only had `created_at`. Any UPDATE (e.g. an upload patching dimensions
-- and alt text) therefore failed with:
--   record "new" has no field "updated_at"

alter table public.assets
  add column if not exists updated_at timestamptz not null default now();
