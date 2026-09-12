-- ============================================================
-- Milestone 3 — collection & taste.
-- APPLIED to project unmzchgflrnppjwafmus on 2026-09-13
-- via migrations: taste_summary_fn, taste_summary_people, season_runtimes
--
-- This file is the record of what was applied. Safe to re-run.
--
-- The rule for every derived number on the You screen:
--   store canonical minutes, aggregate in Postgres, format at the edge.
-- A stored "2h 15m" is a number you have to parse back before you can add it,
-- and shipping every saved row to the browser to sum it there spends bandwidth
-- to produce a figure three characters long.
-- ============================================================

-- ------------------------------------------------------------
-- Season runtimes.
--
-- TMDB has retired episode_run_time: it is empty on every series tested,
-- Breaking Bad and Game of Thrones included. The runtimes still exist per
-- episode on the season endpoint, so they are gathered a season at a time, as a
-- side effect of someone opening that season — which is also the only way to
-- tick an episode, so the figure is known by the time it counts.
--
-- Stored as the season's average minutes per episode, on the season entry that
-- already records its episode count: [{"n":1,"c":7,"r":50}]. A single average
-- per SERIES would not do: Stranger Things runs 50 minutes in season one and 86
-- in season four, so a series average is wrong for exactly the shows people
-- watch most.
-- ------------------------------------------------------------

create or replace function public.season_runtime_set(
  p_tmdb_id integer,
  p_season  integer,
  p_minutes integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  -- A season of nothing, or of implausible episodes, is not worth recording.
  if p_minutes is null or p_minutes <= 0 or p_minutes > 600 then
    return;
  end if;

  -- Filled only when absent, like every other catalogue write: a client may
  -- complete a missing fact and may never overwrite one.
  update public.catalog_titles
     set seasons = (
       select jsonb_agg(
         case when (s->>'n')::int = p_season and (s->'r') is null
              then s || jsonb_build_object('r', p_minutes)
              else s
         end order by (s->>'n')::int
       )
       from jsonb_array_elements(seasons) s
     )
   where tmdb_id = p_tmdb_id
     and media_type = 'tv'
     and seasons @> jsonb_build_array(jsonb_build_object('n', p_season));
end $$;

-- ------------------------------------------------------------
-- Everything the You screen draws, in one round trip.
--
-- SECURITY INVOKER on purpose: user_library's own RLS policy already restricts
-- this to the caller's rows, so the function needs no privilege of its own. The
-- explicit auth.uid() filter agrees with the policy rather than replacing it.
-- ------------------------------------------------------------

create or replace function public.taste_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with seen as (
    select l.tmdb_id, l.media_type, l.rating, l.rewatch_count, l.watched_episodes,
           c.title, c.genres, c.release_date, c.runtime, c.poster_path,
           c.vote_average, c.seasons
      from public.user_library l
      join public.catalog_titles c
        on c.tmdb_id = l.tmdb_id and c.media_type = l.media_type
     where l.user_id = (select auth.uid())
       and l.status in ('watched', 'rewatching')
  ),
  -- Specials are excluded for the same reason they are excluded from a series'
  -- progress: they are not part of the numbered run they'd be counted against.
  episodes as (
    select s.tmdb_id, s.media_type,
           coalesce(sum(jsonb_array_length(e.value)), 0) as n
      from seen s
      left join lateral jsonb_each(s.watched_episodes) as e(key, value)
        on e.key <> '0'
     group by s.tmdb_id, s.media_type
  ),
  -- Per ticked episode, at that season's own rate. A season whose runtime has
  -- not been gathered yet contributes nothing and is reported, rather than
  -- being guessed at and folded silently into a total.
  tv_minutes as (
    select s.tmdb_id, s.media_type,
           (coalesce(sum(jsonb_array_length(e.value) * coalesce((sea->>'r')::int, 0)), 0)
             * (1 + coalesce(s.rewatch_count, 0)))::int as m,
           bool_or(sea is null or sea->'r' is null) as unknown
      from seen s
      cross join lateral jsonb_each(s.watched_episodes) as e(key, value)
      left join lateral (
        select el from jsonb_array_elements(s.seasons) el
         where el->>'n' = e.key limit 1
      ) as x(sea) on true
     where s.media_type = 'tv' and e.key <> '0'
     group by s.tmdb_id, s.media_type, s.rewatch_count
  ),
  -- A rewatch is another pass through the whole thing, so it is more hours.
  minutes as (
    select s.tmdb_id, s.media_type,
           (coalesce(s.runtime, 0) * (1 + coalesce(s.rewatch_count, 0)))::int as m,
           (s.runtime is null) as unknown
      from seen s
     where s.media_type = 'movie'
    union all
    select tmdb_id, media_type, m, unknown from tv_minutes
  ),
  facts as (
    select s.*, coalesce(e.n, 0) as episodes,
           coalesce(m.m, 0) as minutes,
           coalesce(m.unknown, s.media_type = 'tv') as unknown
      from seen s
      left join episodes e on e.tmdb_id = s.tmdb_id and e.media_type = s.media_type
      left join minutes  m on m.tmdb_id = s.tmdb_id and m.media_type = s.media_type
  ),
  -- One title belongs to several genres and exactly one decade. Both roll up
  -- through the same shape, because the card that draws them is one component.
  buckets as (
    select 'genre' as kind, g as key, f.*
      from facts f, unnest(f.genres) as g
    union all
    select 'decade',
           (floor(extract(year from f.release_date) / 10) * 10)::int || 's',
           f.*
      from facts f
     where f.release_date is not null
  ),
  rolled as (
    select kind, key,
           count(*)::int as count,
           count(rating)::int as rated,
           round(avg(rating), 1) as avg,
           sum(minutes)::int as minutes,
           bool_or(unknown) as partial,
           (array_agg(poster_path order by rating desc nulls last,
                                          vote_average desc nulls last)
              filter (where poster_path is not null))[1:5] as posters
      from buckets
     group by kind, key
  ),
  -- A person is ranked by how many of your watched titles they worked on, and
  -- NOT by what proportion of their filmography that is. Proportion looks like
  -- the better ranking until a director with two films you happened to see both
  -- of outranks one with six. The proportion is still the headline the card
  -- shows — "6 of 11" — because that is what tells you whether six means
  -- anything. That denominator is not here: it is the whole filmography, which
  -- lives at TMDB, and the client fetches it for the cards it actually shows.
  by_role as (
    select cr.person_id, pe.name, pe.profile_path, cr.role, cr.job,
           count(*)::int as count,
           count(f.rating)::int as rated,
           round(avg(f.rating), 1) as avg,
           sum(f.minutes)::int as minutes,
           bool_or(f.unknown) as partial,
           (array_agg(f.poster_path order by f.rating desc nulls last,
                                             f.vote_average desc nulls last)
              filter (where f.poster_path is not null))[1:5] as posters
      from facts f
      join public.catalog_credits cr
        on cr.tmdb_id = f.tmdb_id and cr.media_type = f.media_type
      join public.catalog_people pe on pe.tmdb_id = cr.person_id
     group by cr.person_id, pe.name, pe.profile_path, cr.role, cr.job
  ),
  -- One card per person, using whichever role they are most watched in:
  -- Villeneuve is Director (6) rather than Screenplay (2), and two Villeneuve
  -- cards would be noise rather than detail.
  people as (
    select distinct on (person_id) *
      from by_role
     order by person_id, count desc, role, job
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
                 'titles',   count(*),
                 'episodes', coalesce(sum(episodes), 0),
                 'minutes',  coalesce(sum(minutes), 0),
                 -- True while any watched season's runtime is still unknown, so
                 -- the screen can say "at least" instead of presenting an
                 -- undercount as a total.
                 'partial',  coalesce(bool_or(unknown), false)
               ) from facts),
    'genres',  coalesce((select jsonb_agg(to_jsonb(r) - 'kind' order by r.count desc, r.key)
                           from rolled r where r.kind = 'genre'), '[]'::jsonb),
    'decades', coalesce((select jsonb_agg(to_jsonb(r) - 'kind' order by r.key desc)
                           from rolled r where r.kind = 'decade'), '[]'::jsonb),
    -- One title is not a pattern. A person earns a card at two.
    'people',  coalesce((select jsonb_agg(to_jsonb(p) order by p.count desc, p.name)
                           from (select * from people where count > 1
                                  order by count desc, name limit 12) p), '[]'::jsonb)
  );
$$;

revoke execute on function public.season_runtime_set(integer, integer, integer) from public, anon;
revoke execute on function public.taste_summary()                               from public, anon;

grant execute on function public.season_runtime_set(integer, integer, integer) to authenticated;
grant execute on function public.taste_summary()                               to authenticated;
