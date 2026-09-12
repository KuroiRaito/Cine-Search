-- ============================================================
-- Cine Search MVP schema rebuild
-- APPLIED to project unmzchgflrnppjwafmus on 2026-09-12
-- via migrations: mvp_schema_rebuild, restrict_anon_reads_on_user_tables
--
-- This file is the record of what was applied. Do not re-run.
--
-- NAMING
--   catalog_*  shared TMDB data, server-written, world-readable
--   user_*     one person's own data, protected by RLS
--   profiles   the account
-- ============================================================

drop table if exists public.user_episodes cascade;
drop table if exists public.user_movies   cascade;

-- profiles.id previously defaulted to a random uuid with no link to auth.users,
-- which is why 11 profiles existed for 3 accounts. 8 orphans were removed.
delete from public.profiles p
 where not exists (select 1 from auth.users u where u.id = p.id);
alter table public.profiles alter column id drop default;
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table public.profiles add column if not exists region     text;
alter table public.profiles add column if not exists services   text[] not null default '{}';
alter table public.profiles add column if not exists theme      text   not null default 'dark';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table public.catalog_titles (
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie','tv')),
  title text not null, original_title text, original_language text,
  release_date date, runtime integer, overview text,
  genres text[] not null default '{}', keywords text[] not null default '{}',
  vote_average numeric(3,1), vote_count integer, popularity numeric(10,3),
  poster_path text, backdrop_path text,
  number_of_seasons integer, number_of_episodes integer,
  last_aired_season integer, last_aired_episode integer,
  last_synced_at timestamptz not null default now(),
  primary key (tmdb_id, media_type)
);
create index catalog_titles_genres_idx   on public.catalog_titles using gin (genres);
create index catalog_titles_keywords_idx on public.catalog_titles using gin (keywords);

create table public.catalog_people (
  tmdb_id integer primary key, name text not null, department text,
  profile_path text, biography text, birthday date, deathday date,
  place_of_birth text, last_synced_at timestamptz not null default now()
);

create table public.catalog_credits (
  tmdb_id integer not null, media_type text not null,
  person_id integer not null references public.catalog_people(tmdb_id) on delete cascade,
  role text not null check (role in ('cast','crew')),
  job text not null default '', character text, credit_order integer,
  primary key (tmdb_id, media_type, person_id, role, job),
  foreign key (tmdb_id, media_type)
    references public.catalog_titles(tmdb_id, media_type) on delete cascade
);
create index catalog_credits_by_person on public.catalog_credits (person_id, role, job);
create index catalog_credits_by_title  on public.catalog_credits (tmdb_id, media_type, role, credit_order);

create table public.user_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie','tv')),
  status text not null check (status in
    ('want_to_watch','watching','on_hold','watched','rewatching','dropped')),
  rating numeric(3,1) check (rating is null or
    (rating >= 0.5 and rating <= 10 and (rating * 2) = floor(rating * 2))),
  watched_episodes jsonb not null default '{}'::jsonb,   -- { "1": [1,2,3], "2": [1] }
  rewatch_count integer not null default 0 check (rewatch_count >= 0),
  episodes_at_completion integer,
  recommended_by text, recommended_at date,
  added_at timestamptz not null default now(),
  started_at timestamptz, completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type),
  foreign key (tmdb_id, media_type) references public.catalog_titles(tmdb_id, media_type)
);
create index user_library_by_status on public.user_library (user_id, status);
create index user_library_by_title  on public.user_library (tmdb_id, media_type);

create table public.user_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  activity_type text not null check (activity_type in
    ('added','status_changed','rated','episodes_watched','rewatched','removed')),
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie','tv')),
  detail jsonb not null default '{}'::jsonb
);
create index user_activity_by_user  on public.user_activity (user_id, occurred_at desc);
create index user_activity_by_title on public.user_activity (tmdb_id, media_type, occurred_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger user_library_touch before update on public.user_library
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.catalog_titles  enable row level security;
alter table public.catalog_people  enable row level security;
alter table public.catalog_credits enable row level security;
alter table public.user_library    enable row level security;
alter table public.user_activity   enable row level security;

create policy catalog_titles_read  on public.catalog_titles  for select using (true);
create policy catalog_people_read  on public.catalog_people  for select using (true);
create policy catalog_credits_read on public.catalog_credits for select using (true);
create policy user_library_own  on public.user_library  for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_activity_own on public.user_activity for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can read own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy profiles_own on public.profiles for all
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Guests never read personal tables.
revoke select on public.user_library  from anon;
revoke select on public.user_activity from anon;
revoke select on public.profiles      from anon;
