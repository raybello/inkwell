-- 0004: cover art (front + back) for the dedicated Cover tab
--
-- `cover_front` / `cover_back` hold the editable layer documents; the rendered
-- PNGs live in `cover_front_url` / `cover_back_url` and are what exports embed.
-- `cover_image_url` stays the canonical front cover for library cards.

alter table public.projects
  add column if not exists cover_front jsonb,
  add column if not exists cover_back jsonb,
  add column if not exists cover_front_url text,
  add column if not exists cover_back_url text;
