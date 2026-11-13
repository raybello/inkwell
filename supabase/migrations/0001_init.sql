-- Inkwell Studio — core schema
-- Idempotent-ish: safe to re-run (guards with IF NOT EXISTS / DROP POLICY IF EXISTS).

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext,
  display_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free','pro','studio')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- keep profile in sync with auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,'writer'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled Project',
  subtitle text,
  type text not null default 'book' check (type in ('book','ebook','article','blog','custom')),
  genre text,
  cover_image_url text,
  description text,
  target_word_count int default 0,
  publishing_target text,
  tags text[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  share_token text unique,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_idx on public.projects(owner_id);

-- ---------------------------------------------------------------- chapters
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.chapters(id) on delete cascade,
  title text not null default 'Untitled Chapter',
  synopsis text,
  content jsonb,
  content_md text not null default '',
  position int not null default 0,
  status text not null default 'draft' check (status in ('draft','in_progress','complete','needs_review')),
  word_count int not null default 0,
  pov text,
  arc text,
  subplot text,
  color text,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chapters_project_idx on public.chapters(project_id, position);
create index if not exists chapters_parent_idx on public.chapters(parent_id);

-- ---------------------------------------------------------------- chapter versions
create table if not exists public.chapter_versions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  content jsonb,
  content_md text,
  word_count int not null default 0,
  saved_by uuid references public.profiles(id) on delete set null,
  label text,
  kind text not null default 'auto' check (kind in ('auto','manual')),
  created_at timestamptz not null default now()
);
create index if not exists chapter_versions_chapter_idx on public.chapter_versions(chapter_id, created_at desc);

-- ---------------------------------------------------------------- assets
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploader_id uuid references public.profiles(id) on delete set null,
  filename text not null,
  storage_path text not null,
  public_url text,
  mime_type text,
  size_bytes bigint not null default 0,
  width int,
  height int,
  alt_text text,
  source text not null default 'upload',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists assets_project_idx on public.assets(project_id, created_at desc);

-- ---------------------------------------------------------------- storyboard cards
create table if not exists public.storyboard_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  primary_image_id uuid references public.assets(id) on delete set null,
  mood_image_ids uuid[] not null default '{}',
  position int not null default 0,
  notes text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id)
);
create index if not exists storyboard_project_idx on public.storyboard_cards(project_id, position);

-- ---------------------------------------------------------------- canvases
create table if not exists public.canvases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Untitled Canvas',
  content jsonb,
  thumbnail_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists canvases_project_idx on public.canvases(project_id);

-- ---------------------------------------------------------------- comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  parent_id uuid references public.comments(id) on delete cascade,
  anchor_start int,
  anchor_end int,
  quoted_text text,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_chapter_idx on public.comments(chapter_id, created_at);

-- ---------------------------------------------------------------- project members
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','reviewer','viewer')),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (project_id, user_id)
);

-- ---------------------------------------------------------------- invites
create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email citext not null,
  role text not null default 'editor' check (role in ('editor','reviewer','viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index if not exists invites_project_idx on public.project_invites(project_id);

-- ---------------------------------------------------------------- notes & research
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','character','location','event','research')),
  title text not null default 'Untitled Note',
  body text,
  data jsonb not null default '{}'::jsonb,
  url text,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_project_idx on public.notes(project_id, kind);

-- ---------------------------------------------------------------- api keys
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Default key',
  prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  rate_limit_rpm int not null default 100,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists api_keys_workspace_idx on public.api_keys(workspace_id);

-- ---------------------------------------------------------------- export jobs
create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  format text not null check (format in ('markdown','docx','epub','pdf','pdf_screen','html','json')),
  style_template text not null default 'literary',
  scope text not null default 'project',
  chapter_id uuid references public.chapters(id) on delete set null,
  options jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','done','failed')),
  progress int not null default 0,
  storage_path text,
  download_url text,
  size_bytes bigint,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists export_jobs_project_idx on public.export_jobs(project_id, created_at desc);

-- ---------------------------------------------------------------- webhooks
create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  secret text not null default encode(gen_random_bytes(24), 'hex'),
  events text[] not null default '{}',
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status_code int,
  ok boolean not null default false,
  error text,
  attempts int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists webhook_deliveries_idx on public.webhook_deliveries(webhook_id, created_at desc);

-- ---------------------------------------------------------------- notifications & activity
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read, created_at desc);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  summary text,
  created_at timestamptz not null default now()
);
create index if not exists activities_project_idx on public.activities(project_id, created_at desc);

-- ---------------------------------------------------------------- share links
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  mode text not null default 'project' check (mode in ('project','chapter')),
  chapter_id uuid references public.chapters(id) on delete cascade,
  theme text not null default 'literary',
  enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- subscriptions (billing)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  plan text not null default 'free' check (plan in ('free','pro','studio')),
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers
create or replace function public.is_project_member(p uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.projects pr where pr.id = p and pr.owner_id = auth.uid()
    union all
    select 1 from public.project_members m where m.project_id = p and m.user_id = auth.uid() and m.accepted_at is not null
  );
$$;

create or replace function public.project_role(p uuid)
returns text language sql security definer stable set search_path = public as $$
  select coalesce(
    (select 'owner' from public.projects pr where pr.id = p and pr.owner_id = auth.uid()),
    (select m.role from public.project_members m where m.project_id = p and m.user_id = auth.uid() and m.accepted_at is not null)
  );
$$;

create or replace function public.can_edit_project(p uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.project_role(p) in ('owner','editor');
$$;

create or replace function public.can_view_project(p uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.project_role(p) is not null;
$$;

-- word count + updated_at
create or replace function public.chapter_word_count(md text)
returns int language sql immutable as $$
  select case
    when md is null or btrim(md) = '' then 0
    else coalesce(array_length(regexp_split_to_array(btrim(regexp_replace(md, '\s+', ' ', 'g')), ' '), 1), 0)
  end;
$$;

create or replace function public.sync_chapter_meta()
returns trigger language plpgsql as $$
begin
  new.word_count := public.chapter_word_count(new.content_md);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists chapters_sync_meta on public.chapters;
create trigger chapters_sync_meta before insert or update on public.chapters
  for each row execute function public.sync_chapter_meta();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['projects','assets','storyboard_cards','canvases','notes','subscriptions'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- project owner auto-membership
create or replace function public.add_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, role, accepted_at)
  values (new.id, new.owner_id, 'owner', now())
  on conflict (project_id, user_id) do update set role = 'owner', accepted_at = now();
  return new;
end $$;

drop trigger if exists projects_add_owner on public.projects;
create trigger projects_add_owner after insert on public.projects
  for each row execute function public.add_owner_membership();

-- auto version snapshot: at most one per 10 minutes
create or replace function public.snapshot_chapter_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.content_md is distinct from old.content_md then
    if not exists (
      select 1 from public.chapter_versions v
      where v.chapter_id = new.id and v.kind = 'auto'
        and v.created_at > now() - interval '10 minutes'
    ) then
      insert into public.chapter_versions (chapter_id, content, content_md, word_count, saved_by, kind, label)
      values (new.id, new.content, new.content_md, new.word_count, auth.uid(), 'auto', null);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists chapters_snapshot on public.chapters;
create trigger chapters_snapshot after update on public.chapters
  for each row execute function public.snapshot_chapter_version();

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_versions enable row level security;
alter table public.assets enable row level security;
alter table public.storyboard_cards enable row level security;
alter table public.canvases enable row level security;
alter table public.comments enable row level security;
alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;
alter table public.notes enable row level security;
alter table public.api_keys enable row level security;
alter table public.export_jobs enable row level security;
alter table public.webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.notifications enable row level security;
alter table public.activities enable row level security;
alter table public.share_links enable row level security;
alter table public.subscriptions enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());

-- projects
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select
  using (is_project_member(id) or (is_public and share_token is not null));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert with check (owner_id = auth.uid());
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update using (can_edit_project(id)) with check (can_edit_project(id));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete using (owner_id = auth.uid());

-- chapters
drop policy if exists chapters_select on public.chapters;
create policy chapters_select on public.chapters for select using (can_view_project(project_id));
drop policy if exists chapters_write on public.chapters;
create policy chapters_write on public.chapters for insert with check (can_edit_project(project_id));
drop policy if exists chapters_update on public.chapters;
create policy chapters_update on public.chapters for update using (can_edit_project(project_id)) with check (can_edit_project(project_id));
drop policy if exists chapters_delete on public.chapters;
create policy chapters_delete on public.chapters for delete using (can_edit_project(project_id));

-- chapter versions
drop policy if exists versions_select on public.chapter_versions;
create policy versions_select on public.chapter_versions for select
  using (exists (select 1 from public.chapters c where c.id = chapter_id and can_view_project(c.project_id)));
drop policy if exists versions_insert on public.chapter_versions;
create policy versions_insert on public.chapter_versions for insert
  with check (exists (select 1 from public.chapters c where c.id = chapter_id and can_edit_project(c.project_id)));

-- assets
drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets for select using (can_view_project(project_id));
drop policy if exists assets_write on public.assets;
create policy assets_write on public.assets for insert with check (can_edit_project(project_id));
drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets for update using (can_edit_project(project_id)) with check (can_edit_project(project_id));
drop policy if exists assets_delete on public.assets;
create policy assets_delete on public.assets for delete using (can_edit_project(project_id));

-- storyboard
drop policy if exists storyboard_select on public.storyboard_cards;
drop policy if exists storyboard_write on public.storyboard_cards;
drop policy if exists storyboard_update on public.storyboard_cards;
drop policy if exists storyboard_delete on public.storyboard_cards;
create policy storyboard_select on public.storyboard_cards for select using (can_view_project(project_id));
create policy storyboard_write on public.storyboard_cards for insert with check (can_edit_project(project_id));
create policy storyboard_update on public.storyboard_cards for update using (can_edit_project(project_id)) with check (can_edit_project(project_id));
create policy storyboard_delete on public.storyboard_cards for delete using (can_edit_project(project_id));

-- canvases
drop policy if exists canvases_select on public.canvases;
create policy canvases_select on public.canvases for select using (can_view_project(project_id));
drop policy if exists canvases_write on public.canvases;
create policy canvases_write on public.canvases for insert with check (can_edit_project(project_id));
drop policy if exists canvases_update on public.canvases;
create policy canvases_update on public.canvases for update using (can_edit_project(project_id)) with check (can_edit_project(project_id));
drop policy if exists canvases_delete on public.canvases;
create policy canvases_delete on public.canvases for delete using (can_edit_project(project_id));

-- comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (can_view_project(project_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert with check (can_view_project(project_id) and author_id = auth.uid());
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update using (author_id = auth.uid() or can_edit_project(project_id)) with check (can_view_project(project_id));
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete using (author_id = auth.uid() or can_edit_project(project_id));

-- project members
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members for select using (can_view_project(project_id));
drop policy if exists members_manage on public.project_members;
create policy members_manage on public.project_members for all using (project_role(project_id) = 'owner') with check (project_role(project_id) = 'owner');
drop policy if exists members_self_update on public.project_members;
create policy members_self_update on public.project_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- invites
drop policy if exists invites_select on public.project_invites;
create policy invites_select on public.project_invites for select using (project_role(project_id) = 'owner' or email = (select email from public.profiles where id = auth.uid()));
drop policy if exists invites_manage on public.project_invites;
create policy invites_manage on public.project_invites for all using (project_role(project_id) = 'owner') with check (project_role(project_id) = 'owner');

-- notes
drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes for select using (can_view_project(project_id));
drop policy if exists notes_write on public.notes;
create policy notes_write on public.notes for insert with check (can_edit_project(project_id));
drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes for update using (can_edit_project(project_id)) with check (can_edit_project(project_id));
drop policy if exists notes_delete on public.notes;
create policy notes_delete on public.notes for delete using (can_edit_project(project_id));

-- api keys (never exposed to client except via service role / owner)
drop policy if exists api_keys_owner on public.api_keys;
create policy api_keys_owner on public.api_keys for all using (workspace_id = auth.uid()) with check (workspace_id = auth.uid());

-- export jobs
drop policy if exists export_jobs_select on public.export_jobs;
create policy export_jobs_select on public.export_jobs for select using (can_view_project(project_id));
drop policy if exists export_jobs_write on public.export_jobs;
create policy export_jobs_write on public.export_jobs for insert with check (can_edit_project(project_id));

-- webhooks
drop policy if exists webhooks_owner on public.webhooks;
create policy webhooks_owner on public.webhooks for all using (project_role(project_id) = 'owner') with check (project_role(project_id) = 'owner');
drop policy if exists deliveries_select on public.webhook_deliveries;
create policy deliveries_select on public.webhook_deliveries for select
  using (exists (select 1 from public.webhooks w where w.id = webhook_id and project_role(w.project_id) = 'owner'));

-- notifications
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- activities
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities for select using (can_view_project(project_id));
drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities for insert with check (can_view_project(project_id));

-- share links
drop policy if exists share_links_select on public.share_links;
create policy share_links_select on public.share_links for select using (project_role(project_id) = 'owner' or enabled);
drop policy if exists share_links_manage on public.share_links;
create policy share_links_manage on public.share_links for all using (project_role(project_id) = 'owner') with check (project_role(project_id) = 'owner');

-- subscriptions
drop policy if exists subs_own on public.subscriptions;
create policy subs_own on public.subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', true, 26214400, array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','video/mp4','application/pdf'])
on conflict (id) do update set public = true, file_size_limit = 26214400;

drop policy if exists storage_read on storage.objects;
create policy storage_read on storage.objects for select using (bucket_id = 'assets');
drop policy if exists storage_insert on storage.objects;
create policy storage_insert on storage.objects for insert with check (
  bucket_id = 'assets' and public.can_edit_project((storage.foldername(name))[1]::uuid)
);
drop policy if exists storage_update on storage.objects;
create policy storage_update on storage.objects for update using (
  bucket_id = 'assets' and public.can_edit_project((storage.foldername(name))[1]::uuid)
);
drop policy if exists storage_delete on storage.objects;
create policy storage_delete on storage.objects for delete using (
  bucket_id = 'assets' and public.can_edit_project((storage.foldername(name))[1]::uuid)
);

-- public read access to published exports & covers
insert into storage.buckets (id, name, public, file_size_limit)
values ('exports', 'exports', true, 104857600)
on conflict (id) do update set public = true;

drop policy if exists storage_exports_read on storage.objects;
create policy storage_exports_read on storage.objects for select using (bucket_id = 'exports');
