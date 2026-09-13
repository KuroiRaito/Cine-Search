-- ============================================================
-- Phase B — cut TMDB calls.
-- APPLIED to project unmzchgflrnppjwafmus on 2026-09-13
-- via migrations: person_totals_cache, taste_summary_credit_totals
--
-- This file is the record of what was applied. Safe to re-run.
-- ============================================================

-- How much of each person's work exists, kept so it is not re-asked.
--
-- "6 of 11" needs the 11, and the 11 is the person's whole filmography at
-- TMDB. The You screen was fetching it for every person card on every visit —
-- twelve requests to redraw numbers that change a few times a year. Stored per
-- role, in the app's own vocabulary, on the person row that already exists:
--
--   {"director": {"count": 10, "label": "Director", "verb": "directed"}, ...}
--
-- Fill-when-absent like every other catalogue write, with one addition: a
-- filmography does grow, so a value older than thirty days may be replaced.
alter table public.catalog_people
  add column if not exists credit_totals    jsonb,
  add column if not exists totals_synced_at timestamptz;

create or replace function public.person_totals_set(
  p_person_id    integer,
  p_name         text,
  p_profile_path text,
  p_totals       jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_totals) <> 'object' then
    return;
  end if;

  -- A person met in search may not be in the catalogue yet; they are added so
  -- the totals have a row to live on.
  insert into public.catalog_people (tmdb_id, name, profile_path, credit_totals, totals_synced_at)
  values (p_person_id, coalesce(nullif(p_name, ''), 'Unknown'), nullif(p_profile_path, ''),
          p_totals, now())
  on conflict (tmdb_id) do update
     set credit_totals    = excluded.credit_totals,
         totals_synced_at = now()
   where public.catalog_people.credit_totals is null
      or public.catalog_people.totals_synced_at < now() - interval '30 days';
end $$;

revoke execute on function public.person_totals_set(integer, text, text, jsonb) from public, anon;
grant  execute on function public.person_totals_set(integer, text, text, jsonb) to authenticated;

-- taste_summary() now selects pe.credit_totals into each people row (and groups
-- by it). The full function text is in 003_taste.sql with that one column
-- added to the by_role CTE's select list and group by.
