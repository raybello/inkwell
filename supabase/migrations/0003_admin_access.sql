-- 0003: per-user access level + tighter project visibility
--
-- Two changes:
--   1. `profiles.is_admin` grants unrestricted access (all projects, no plan limits).
--   2. Public projects are no longer listable by anyone with an account. Sharing now
--      works through `share_links` / `projects.share_token` only, so a public flag can
--      never put a project you don't own into someone else's library.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Owners, accepted members and admins are members.
create or replace function public.is_project_member(p uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.projects pr where pr.id = p and pr.owner_id = auth.uid()
    union all
    select 1 from public.project_members m
      where m.project_id = p and m.user_id = auth.uid() and m.accepted_at is not null
  );
$$;

-- Admins act as owner everywhere, so every existing policy that leans on
-- project_role/can_edit_project/can_view_project grants them full access.
create or replace function public.project_role(p uuid)
returns text language sql security definer stable set search_path = public as $$
  select case
    when public.is_admin() then 'owner'
    else coalesce(
      (select 'owner' from public.projects pr where pr.id = p and pr.owner_id = auth.uid()),
      (select m.role from public.project_members m
        where m.project_id = p and m.user_id = auth.uid() and m.accepted_at is not null)
    )
  end;
$$;

-- Listing is membership-only now: no public-project leakage into libraries.
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select
  using (public.is_project_member(id));

-- Share links stay readable by anyone holding the token (and by members).
drop policy if exists share_links_select on public.share_links;
create policy share_links_select on public.share_links for select
  using (enabled or public.project_role(project_id) = 'owner');
