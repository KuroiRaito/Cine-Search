-- ============================================================
-- Profile, step 4 — the people and character shelves.
-- docs/profile-module.html §03, §04, §09
-- APPLIED to project unmzchgflrnppjwafmus on 2026-09-16
-- via migration: user_favourites
--
-- This file is the record of what was applied. Safe to re-run.
-- ============================================================
--
-- One table for both, because they differ only in what `ref` points at: a
-- person id, or a TMDB credit_id. A credit_id is "this person, playing this
-- character, in this title" — TMDB's own identifier for exactly the thing
-- being favourited, so one stored string rehydrates a whole card.
--
-- The display strings are COPIED, not joined, and that is the requirement
-- rather than the compromise (R-C3). TMDB credits are user-edited and a
-- credit_id can be removed when a cast list is restructured. A card whose
-- /credit/{id} 404s keeps its name and title from this row and drops only the
-- face. Normalise what you own; copy what you do not.

create table if not exists public.user_favourites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('person', 'character')),
  ref        text not null,
  position   integer,
  name       text not null,
  subtitle   text,
  actor      text,
  image_path text,
  media_type text check (media_type is null or media_type in ('movie', 'tv')),
  tmdb_id    integer,
  poster_path text,
  animated   boolean not null default false,
  added_at   timestamptz not null default now(),
  primary key (user_id, kind, ref)
);

alter table public.user_favourites enable row level security;

-- Nothing shared lives here, so this needs no SECURITY DEFINER write surface:
-- these are the person's own rows and RLS is the whole guard. Contrast
-- user_library, whose writes go through functions because they also touch the
-- shared catalogue.
create policy user_favourites_own on public.user_favourites for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.user_favourites from anon;
grant select, insert, update, delete on public.user_favourites to authenticated;

create index if not exists user_favourites_shelf
  on public.user_favourites (user_id, kind, position);

-- Ordering is a list operation, the same as it is for titles.
create or replace function public.favourites_order(p_kind text, p_refs text[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_favourites f
     set position = t.ord * 10
    from (
      select r, ordinality::int as ord
        from unnest(p_refs) with ordinality as u(r, ordinality)
    ) t
   where f.user_id = (select auth.uid())
     and f.kind = p_kind
     and f.ref = t.r;
$$;

revoke all on function public.favourites_order(text, text[]) from public, anon;
grant execute on function public.favourites_order(text, text[]) to authenticated;
