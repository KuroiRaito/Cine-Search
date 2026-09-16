-- ============================================================
-- Profile — the numbers behind it.  docs/profile-module.html §07
-- APPLIED to project unmzchgflrnppjwafmus on 2026-09-16
-- via migrations: profile_stats, profile_stats_revoke_anon
--
-- This file is the record of what was applied. Safe to re-run.
-- ============================================================
--
-- taste_summary() answered one question: what have you watched, by genre,
-- decade and person. The profile asks eight more — films apart from series,
-- a mean on every dimension rather than only a count, how your statuses are
-- distributed, which years you watched in, and how widely you score.
--
-- One function, one round trip. The old one is dropped at the bottom: two
-- functions computing overlapping numbers is how they come to disagree.

create or replace function public.profile_stats()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with lib as (
    -- Every tracked row, whatever its status. The distribution bar is about
    -- the whole library; everything else below narrows to what was watched.
    select l.status, l.rating, l.rewatch_count, l.watched_episodes, l.completed_at,
           l.tmdb_id, l.media_type,
           c.genres, c.keywords, c.release_date, c.runtime, c.seasons,
           c.poster_path, c.vote_average
      from public.user_library l
      join public.catalog_titles c
        on c.tmdb_id = l.tmdb_id and c.media_type = l.media_type
     where l.user_id = (select auth.uid())
  ),
  seen as (select * from lib where status in ('watched', 'rewatching')),

  -- Specials are excluded from every count: season 0 is not progress.
  eps as (
    select s.tmdb_id, s.media_type, coalesce(sum(jsonb_array_length(e.value)), 0)::int as n
      from seen s
      left join lateral jsonb_each(s.watched_episodes) as e(key, value) on e.key <> '0'
     group by s.tmdb_id, s.media_type
  ),
  tv_min as (
    select s.tmdb_id, s.media_type,
           (coalesce(sum(jsonb_array_length(e.value) * coalesce((sea->>'r')::int, 0)), 0)
             * (1 + coalesce(s.rewatch_count, 0)))::int as m,
           bool_or(sea is null or sea->'r' is null) as unknown
      from seen s
      cross join lateral jsonb_each(s.watched_episodes) as e(key, value)
      left join lateral (
        select el from jsonb_array_elements(s.seasons) el where el->>'n' = e.key limit 1
      ) as x(sea) on true
     where s.media_type = 'tv' and e.key <> '0'
     group by s.tmdb_id, s.media_type, s.rewatch_count
  ),
  mins as (
    select tmdb_id, media_type,
           (coalesce(runtime, 0) * (1 + coalesce(rewatch_count, 0)))::int as m,
           (runtime is null) as unknown
      from seen where media_type = 'movie'
    union all select tmdb_id, media_type, m, unknown from tv_min
  ),
  facts as (
    select s.*, coalesce(e.n, 0) as episodes, coalesce(m.m, 0) as minutes,
           coalesce(m.unknown, s.media_type = 'tv') as unknown
      from seen s
      left join eps  e on e.tmdb_id = s.tmdb_id and e.media_type = s.media_type
      left join mins m on m.tmdb_id = s.tmdb_id and m.media_type = s.media_type
  ),

  -- Every dimension the design ranks, as one long table of (kind, key, row),
  -- so one aggregation serves all of them.
  dims as (
    select 'genre'   as kind, g as key, f.* from facts f, unnest(f.genres) as g
    union all
    select 'decade', (floor(extract(year from f.release_date) / 10) * 10)::int || 's', f.*
      from facts f where f.release_date is not null
    union all
    -- "Your 2026". completed_at is when it was finished, not when it was added.
    select 'year', extract(year from f.completed_at)::int::text, f.*
      from facts f where f.completed_at is not null
    union all
    select 'format', case when f.media_type = 'movie' then 'Films' else 'Series' end, f.*
      from facts f
    union all
    select 'keyword', k, f.* from facts f, unnest(f.keywords) as k
  ),
  rolled as (
    select kind, key, count(*)::int as count, count(rating)::int as rated,
           round(avg(rating), 1) as mean, sum(minutes)::int as minutes,
           bool_or(unknown) as partial,
           (array_agg(poster_path order by rating desc nulls last, vote_average desc nulls last)
              filter (where poster_path is not null))[1:5] as posters
      from dims group by kind, key
  ),
  -- A keyword seen once is not a taste, it is a tag. Without this floor a
  -- library of 1,500 titles returns several thousand rows of count=1 noise in
  -- a payload that loads on every visit to the page.
  capped as (
    select * from (
      select r.*, row_number() over (
               partition by kind order by count desc, key
             ) as rn
        from rolled r
       where kind <> 'keyword' or count > 1
    ) x
    where rn <= case when kind = 'keyword' then 20 else 40 end
  ),

  by_role as (
    select cr.person_id, pe.name, pe.profile_path, pe.credit_totals, cr.role, cr.job,
           count(*)::int as count, count(f.rating)::int as rated,
           round(avg(f.rating), 1) as mean, sum(f.minutes)::int as minutes,
           bool_or(f.unknown) as partial,
           (array_agg(f.poster_path order by f.rating desc nulls last,
                                          f.vote_average desc nulls last)
              filter (where f.poster_path is not null))[1:5] as posters
      from facts f
      join public.catalog_credits cr
        on cr.tmdb_id = f.tmdb_id and cr.media_type = f.media_type
      join public.catalog_people pe on pe.tmdb_id = cr.person_id
     group by cr.person_id, pe.name, pe.profile_path, pe.credit_totals, cr.role, cr.job
  ),
  people as (
    select distinct on (person_id) * from by_role
     order by person_id, count desc, role, job
  )

  select jsonb_build_object(
    -- A film has a runtime and no episodes; a series has both. One blended
    -- "titles" number hides which of the two you actually are.
    'films', (select jsonb_build_object(
                'watched', count(*), 'minutes', coalesce(sum(minutes), 0),
                'rated', count(rating), 'mean', round(avg(rating), 1),
                'partial', coalesce(bool_or(unknown), false)
              ) from facts where media_type = 'movie'),
    'series', (select jsonb_build_object(
                'watched', count(*), 'episodes', coalesce(sum(episodes), 0),
                'minutes', coalesce(sum(minutes), 0),
                'rated', count(rating), 'mean', round(avg(rating), 1),
                'partial', coalesce(bool_or(unknown), false)
              ) from facts where media_type = 'tv'),

    -- The stacked bar, per medium, in the six watch states the foundations
    -- already colour. Statuses need no ratings, so this works for somebody
    -- who has never rated anything.
    'distribution', (select coalesce(jsonb_object_agg(media_type, byst), '{}'::jsonb)
                       from (select media_type, jsonb_object_agg(status, n) as byst
                               from (select media_type, status, count(*)::int as n
                                       from lib group by media_type, status) a
                              group by media_type) b),

    -- "How harsh you are" — one sentence, from the population deviation of
    -- every score given. Meaningless below a handful of ratings, so the count
    -- travels with it and the screen decides.
    'spread', (select jsonb_build_object(
                'n', count(rating), 'mean', round(avg(rating), 1),
                'sd', round(stddev_pop(rating)::numeric, 1)
              ) from lib where rating is not null),

    'dimensions', (select coalesce(jsonb_object_agg(kind, rows), '{}'::jsonb) from (
                     select kind, jsonb_agg(to_jsonb(c) - 'kind' - 'rn'
                              order by c.count desc, c.key) as rows
                       from capped c group by kind) g),

    'people', coalesce((select jsonb_agg(to_jsonb(p) order by p.count desc, p.name)
                          from (select * from people where count > 1
                                 order by count desc, name limit 12) p), '[]'::jsonb),

    -- Kept from taste_summary so the You screen can move across without a
    -- second shape to support.
    'totals', (select jsonb_build_object(
                 'titles', count(*), 'episodes', coalesce(sum(episodes), 0),
                 'minutes', coalesce(sum(minutes), 0),
                 'partial', coalesce(bool_or(unknown), false)
               ) from facts)
  );
$$;

revoke all on function public.profile_stats() from public;
grant execute on function public.profile_stats() to authenticated;
-- `revoke ... from public` does not remove the grant Supabase's default
-- privileges hand to anon explicitly, and the first apply left it callable by
-- anon. It returns nothing for a signed-out caller, but an endpoint that
-- exists is an endpoint that can be probed.
revoke all on function public.profile_stats() from anon;

-- taste_summary() is deliberately LEFT IN PLACE by this migration.
--
-- The You screen on main still calls it, and a migration is applied before the
-- code that needs it ships. Dropping it here would blank that screen for
-- everyone between the two. It is retired in 008, after the client has moved —
-- two functions over one library is how they come to disagree, so this is a
-- short overlap and not a permanent pair.
