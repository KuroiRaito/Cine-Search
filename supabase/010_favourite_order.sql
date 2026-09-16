-- ============================================================
-- Profile, step 3 — favourites can be ordered.
-- docs/profile-module.html §03 "Ordering", §09
-- APPLIED to project unmzchgflrnppjwafmus on 2026-09-16
-- via migration: favourite_order
--
-- This file is the record of what was applied. Safe to re-run.
-- ============================================================
--
-- The first film on a shelf is a statement, so the order is the person's and
-- not the database's. Gap-based (10, 20, 30…) so moving one card is one row's
-- update rather than eight.
--
-- Nullable on purpose: every favourite that already exists has no opinion
-- about where it sits, and inventing one would be the app deciding something
-- the person did not. Nulls sort last, by when they were added, until the
-- shelf is touched.

alter table public.user_library
  add column if not exists favourite_order integer;

-- Only favourites carry an order. A partial index, because the column is null
-- for the overwhelming majority of rows and a full index would be mostly empty.
create index if not exists user_library_favourites
  on public.user_library (user_id, media_type, favourite_order)
  where is_favourite;

-- Reordering is a list operation, not a row one, so it gets its own function
-- rather than a parameter on library_upsert. One call per reorder, atomic, and
-- it cannot be used to write anything else: it sets exactly one column, only on
-- the caller's own rows, only on favourites, only within one medium.

create or replace function public.library_favourite_order(
  p_media_type text,
  p_ids integer[]
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_library l
     set favourite_order = t.ord * 10
    from (
      select id, ordinality::int as ord
        from unnest(p_ids) with ordinality as u(id, ordinality)
    ) t
   where l.user_id = (select auth.uid())
     and l.media_type = p_media_type
     and l.tmdb_id = t.id
     and l.is_favourite;
$$;

revoke all on function public.library_favourite_order(text, integer[]) from public, anon;
grant execute on function public.library_favourite_order(text, integer[]) to authenticated;
