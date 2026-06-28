-- Run this file in the Supabase SQL editor after creating the tables.
-- Admin access is granted only when the authenticated user's
-- app_metadata contains: { "role": "admin" }

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  link text not null,
  instagram_url text,
  description text,
  category text,
  published_at timestamptz,
  issue_number text,
  thumbnail_src text not null,
  thumbnail_url text,
  instagram_handle text not null default '@daf.tmp',
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  storage_path text,
  created_at timestamptz not null default now()
);

alter table public.issues
add column if not exists instagram_url text,
add column if not exists description text,
add column if not exists category text,
add column if not exists published_at timestamptz,
add column if not exists issue_number text,
add column if not exists thumbnail_url text,
add column if not exists is_featured boolean not null default false;

create table if not exists public.references (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  main_tag text not null,
  tags text[] not null default '{}',
  type text not null default 'image',
  src text not null,
  memo text not null default '',
  location text,
  date text,
  noticed text,
  possible_use text,
  storage_path text,
  created_at timestamptz not null default now()
);

alter table public.references
add column if not exists title text,
add column if not exists main_tag text,
add column if not exists tags text[] not null default '{}',
add column if not exists type text not null default 'image',
add column if not exists src text,
add column if not exists memo text not null default '',
add column if not exists location text,
add column if not exists date text,
add column if not exists noticed text,
add column if not exists possible_use text,
add column if not exists storage_path text,
add column if not exists created_at timestamptz not null default now();

create table if not exists public.freeboard_posts (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Unknown',
  content text not null,
  is_anonymous boolean not null default false,
  tags text[] not null default '{}',
  x double precision,
  y double precision,
  rotation double precision,
  size text not null default 'medium',
  visibility text not null default 'published',
  created_at timestamptz not null default now()
);

alter table public.freeboard_posts
add column if not exists name text not null default 'Unknown',
add column if not exists content text,
add column if not exists is_anonymous boolean not null default false,
add column if not exists tags text[] not null default '{}',
add column if not exists x double precision,
add column if not exists y double precision,
add column if not exists rotation double precision,
add column if not exists size text not null default 'medium',
add column if not exists visibility text not null default 'published',
add column if not exists created_at timestamptz not null default now();

create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  slug text unique,
  excerpt text,
  content text not null default '',
  cover_image text,
  cover_alt text,
  cover_caption text,
  tags text[] not null default '{}',
  category text,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  visibility text not null default 'draft',
  related_issue_id uuid references public.issues(id) on delete set null,
  related_issue_number text,
  related_issue_slug text,
  created_at timestamptz not null default now()
);

alter table public.journals
add column if not exists title text,
add column if not exists subtitle text,
add column if not exists slug text,
add column if not exists excerpt text,
add column if not exists content text not null default '',
add column if not exists cover_image text,
add column if not exists cover_alt text,
add column if not exists cover_caption text,
add column if not exists tags text[] not null default '{}',
add column if not exists category text,
add column if not exists published_at timestamptz,
add column if not exists updated_at timestamptz not null default now(),
add column if not exists visibility text not null default 'draft',
add column if not exists related_issue_id uuid references public.issues(id) on delete set null,
add column if not exists related_issue_number text,
add column if not exists related_issue_slug text,
add column if not exists created_at timestamptz not null default now();

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  portfolio_number text,
  title text not null,
  subtitle text,
  description text,
  cover_image text,
  cover_alt text,
  category text,
  tags text[] not null default '{}',
  status text not null default 'archived',
  project_type text,
  client text,
  project_period text,
  archived_date text,
  slug text unique,
  is_featured boolean not null default false,
  display_order integer,
  role text,
  contribution text[] not null default '{}',
  skills text[] not null default '{}',
  overview text,
  background text,
  problem text,
  goal text,
  research text,
  insight text,
  strategy text,
  planning text,
  process text,
  execution text,
  outcome text,
  reflection text,
  gallery jsonb not null default '[]',
  attachment jsonb,
  attachments jsonb not null default '[]',
  related_journal_id uuid references public.journals(id) on delete set null,
  related_journal_slug text,
  related_issue_id uuid references public.issues(id) on delete set null,
  related_issue_number text,
  related_archive_ids text[] not null default '{}',
  visibility text not null default 'draft',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.portfolios
add column if not exists portfolio_number text,
add column if not exists title text,
add column if not exists subtitle text,
add column if not exists description text,
add column if not exists cover_image text,
add column if not exists cover_alt text,
add column if not exists category text,
add column if not exists tags text[] not null default '{}',
add column if not exists status text not null default 'archived',
add column if not exists project_type text,
add column if not exists client text,
add column if not exists project_period text,
add column if not exists archived_date text,
add column if not exists slug text,
add column if not exists is_featured boolean not null default false,
add column if not exists display_order integer,
add column if not exists role text,
add column if not exists contribution text[] not null default '{}',
add column if not exists skills text[] not null default '{}',
add column if not exists overview text,
add column if not exists background text,
add column if not exists problem text,
add column if not exists goal text,
add column if not exists research text,
add column if not exists insight text,
add column if not exists strategy text,
add column if not exists planning text,
add column if not exists process text,
add column if not exists execution text,
add column if not exists outcome text,
add column if not exists reflection text,
add column if not exists gallery jsonb not null default '[]',
add column if not exists attachment jsonb,
add column if not exists attachments jsonb not null default '[]',
add column if not exists related_journal_id uuid references public.journals(id) on delete set null,
add column if not exists related_journal_slug text,
add column if not exists related_issue_id uuid references public.issues(id) on delete set null,
add column if not exists related_issue_number text,
add column if not exists related_archive_ids text[] not null default '{}',
add column if not exists visibility text not null default 'draft',
add column if not exists updated_at timestamptz not null default now(),
add column if not exists created_at timestamptz not null default now();

create table if not exists public.archive_files (
  id uuid primary key default gen_random_uuid(),
  archive_number text,
  title text not null,
  slug text unique,
  type text not null default 'garment',
  category text,
  status text not null default 'draft',
  date text,
  cover_image text,
  cover_alt text,
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  display_order integer,
  garment_type text,
  material text,
  color text,
  technique text,
  season_year text,
  size_measurement text,
  pattern_version text,
  sections jsonb not null default '{}',
  related_journal_slug text,
  related_portfolio_slug text,
  related_issue_number text,
  visibility text not null default 'draft',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.archive_files
add column if not exists archive_number text,
add column if not exists title text,
add column if not exists slug text,
add column if not exists type text not null default 'garment',
add column if not exists category text,
add column if not exists status text not null default 'draft',
add column if not exists date text,
add column if not exists cover_image text,
add column if not exists cover_alt text,
add column if not exists tags text[] not null default '{}',
add column if not exists is_featured boolean not null default false,
add column if not exists display_order integer,
add column if not exists garment_type text,
add column if not exists material text,
add column if not exists color text,
add column if not exists technique text,
add column if not exists season_year text,
add column if not exists size_measurement text,
add column if not exists pattern_version text,
add column if not exists sections jsonb not null default '{}',
add column if not exists related_journal_slug text,
add column if not exists related_portfolio_slug text,
add column if not exists related_issue_number text,
add column if not exists visibility text not null default 'draft',
add column if not exists updated_at timestamptz not null default now(),
add column if not exists created_at timestamptz not null default now();

alter table public.references enable row level security;
alter table public.freeboard_posts enable row level security;
alter table public.issues enable row level security;
alter table public.journals enable row level security;
alter table public.portfolios enable row level security;
alter table public.archive_files enable row level security;

drop policy if exists "references_public_read" on public.references;
create policy "references_public_read"
on public.references for select
using (true);

drop policy if exists "references_admin_insert" on public.references;
create policy "references_admin_insert"
on public.references for insert
to authenticated
with check (public.is_admin());

drop policy if exists "references_admin_update" on public.references;
create policy "references_admin_update"
on public.references for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "references_admin_delete" on public.references;
create policy "references_admin_delete"
on public.references for delete
to authenticated
using (public.is_admin());

drop policy if exists "freeboard_public_read" on public.freeboard_posts;
create policy "freeboard_public_read"
on public.freeboard_posts for select
using (visibility = 'published');

drop policy if exists "freeboard_admin_read" on public.freeboard_posts;
create policy "freeboard_admin_read"
on public.freeboard_posts for select
to authenticated
using (public.is_admin());

drop policy if exists "freeboard_public_insert" on public.freeboard_posts;
create policy "freeboard_public_insert"
on public.freeboard_posts for insert
to anon, authenticated
with check (true);

drop policy if exists "freeboard_admin_update" on public.freeboard_posts;
create policy "freeboard_admin_update"
on public.freeboard_posts for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "freeboard_admin_delete" on public.freeboard_posts;
create policy "freeboard_admin_delete"
on public.freeboard_posts for delete
to authenticated
using (public.is_admin());

drop policy if exists "issues_public_read" on public.issues;
create policy "issues_public_read"
on public.issues for select
using (true);

drop policy if exists "issues_admin_insert" on public.issues;
create policy "issues_admin_insert"
on public.issues for insert
to authenticated
with check (public.is_admin());

drop policy if exists "issues_admin_update" on public.issues;
create policy "issues_admin_update"
on public.issues for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "issues_admin_delete" on public.issues;
create policy "issues_admin_delete"
on public.issues for delete
to authenticated
using (public.is_admin());

drop policy if exists "journals_public_read_published" on public.journals;
create policy "journals_public_read_published"
on public.journals for select
using (visibility = 'published');

drop policy if exists "journals_admin_read" on public.journals;
create policy "journals_admin_read"
on public.journals for select
to authenticated
using (public.is_admin());

drop policy if exists "journals_admin_insert" on public.journals;
create policy "journals_admin_insert"
on public.journals for insert
to authenticated
with check (public.is_admin());

drop policy if exists "journals_admin_update" on public.journals;
create policy "journals_admin_update"
on public.journals for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "journals_admin_delete" on public.journals;
create policy "journals_admin_delete"
on public.journals for delete
to authenticated
using (public.is_admin());

drop policy if exists "portfolios_public_read_published" on public.portfolios;
create policy "portfolios_public_read_published"
on public.portfolios for select
using (visibility = 'published');

drop policy if exists "portfolios_admin_read" on public.portfolios;
create policy "portfolios_admin_read"
on public.portfolios for select
to authenticated
using (public.is_admin());

drop policy if exists "portfolios_admin_insert" on public.portfolios;
create policy "portfolios_admin_insert"
on public.portfolios for insert
to authenticated
with check (public.is_admin());

drop policy if exists "portfolios_admin_update" on public.portfolios;
create policy "portfolios_admin_update"
on public.portfolios for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "portfolios_admin_delete" on public.portfolios;
create policy "portfolios_admin_delete"
on public.portfolios for delete
to authenticated
using (public.is_admin());

drop policy if exists "archive_files_public_read_published" on public.archive_files;
create policy "archive_files_public_read_published"
on public.archive_files for select
using (visibility = 'published');

drop policy if exists "archive_files_admin_read" on public.archive_files;
create policy "archive_files_admin_read"
on public.archive_files for select
to authenticated
using (public.is_admin());

drop policy if exists "archive_files_admin_insert" on public.archive_files;
create policy "archive_files_admin_insert"
on public.archive_files for insert
to authenticated
with check (public.is_admin());

drop policy if exists "archive_files_admin_update" on public.archive_files;
create policy "archive_files_admin_update"
on public.archive_files for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "archive_files_admin_delete" on public.archive_files;
create policy "archive_files_admin_delete"
on public.archive_files for delete
to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('reference-media', 'reference-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "reference_media_public_read" on storage.objects;
create policy "reference_media_public_read"
on storage.objects for select
using (bucket_id = 'reference-media');

drop policy if exists "reference_media_admin_insert" on storage.objects;
create policy "reference_media_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'reference-media'
  and public.is_admin()
);

drop policy if exists "reference_media_admin_update" on storage.objects;
create policy "reference_media_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'reference-media'
  and public.is_admin()
)
with check (
  bucket_id = 'reference-media'
  and public.is_admin()
);

drop policy if exists "reference_media_admin_delete" on storage.objects;
create policy "reference_media_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'reference-media'
  and public.is_admin()
);
