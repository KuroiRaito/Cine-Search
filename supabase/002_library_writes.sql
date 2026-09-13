-- ============================================================
-- Library writes, without ever handing a secret to the app.
-- TO APPLY: paste into Supabase → SQL Editor → Run. Safe to re-run.
--
-- catalog_titles is deliberately read-only to clients, so one signed-in user
-- cannot corrupt data everyone shares. That left saving a title needing
-- elevated privileges. The usual answer is a service-role key in a server
-- function; this is better on every axis:
--
--   * no secret to leak, rotate, or forget in an environment file;
--   * the catalogue write surface is exactly these functions and nothing else;
--   * catalogue + library + activity land in one atomic statement, so a
--     half-saved title is not a state the app can reach.
--
-- The safety property that makes it sound: the catalogue insert is
-- ON CONFLICT DO NOTHING. A client can create a missing row, never overwrite
-- an existing one. Refreshing stale catalogue data stays a server-side job.
-- ============================================================

-- ------------------------------------------------------------
-- Schema: the one thing part one had nowhere to put.
--
-- The design system draws a heart with aria-pressed on the title page — a
-- toggle the user can see. It is not a rating of 10 and it is not a status,
-- so it gets its own column. It is also the cleanest positive signal the
-- taste work in Layer 2 will have, which is reason enough on its own.
-- ------------------------------------------------------------

alter table public.user_library
  add column if not exists is_favourite boolean not null default false;

-- How many episodes each season holds, as [{"n":1,"c":7},{"n":2,"c":13}].
--
-- number_of_episodes alone cannot name which episode comes next: "11 of 62"
-- does not say whether that is S2 E4. Without this the Library screen would
-- have to either fetch every series from TMDB to draw one row, or guess at the
-- season boundaries — and a "+" button that marks the wrong episode is worse
-- than no button.
alter table public.catalog_titles
  add column if not exists seasons jsonb not null default '[]'::jsonb;

-- Private notes. The column waited on a scope question rather than a technical
-- one: if notes are ever published they are reviews, which is a different
-- feature with a moderation problem attached. Layers 3 and 4 are parked
-- indefinitely (owner's call, 2026-09-13), so notes are private and only ever
-- private.
alter table public.user_library
  add column if not exists notes text;

create index if not exists user_library_favourites
  on public.user_library (user_id) where is_favourite;

-- 'favourited' joins the list of things worth recording.
alter table public.user_activity drop constraint if exists user_activity_activity_type_check;
alter table public.user_activity add constraint user_activity_activity_type_check
  check (activity_type in ('added','status_changed','rated','episodes_watched',
                           'rewatched','removed','favourited'));

-- Fill in a catalogue row if, and only if, it is absent.
create or replace function public.catalog_ensure(
  p_tmdb_id    integer,
  p_media_type text,
  p_catalog    jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_credits jsonb;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_media_type not in ('movie', 'tv') then
    raise exception 'media_type must be movie or tv' using errcode = '22023';
  end if;

  insert into public.catalog_titles (
    tmdb_id, media_type, title, original_title, original_language,
    release_date, runtime, overview, genres, keywords,
    vote_average, vote_count, popularity, poster_path, backdrop_path,
    number_of_seasons, number_of_episodes, seasons
  )
  values (
    p_tmdb_id,
    p_media_type,
    coalesce(nullif(p_catalog->>'title', ''), 'Untitled'),
    nullif(p_catalog->>'original_title', ''),
    nullif(p_catalog->>'original_language', ''),
    nullif(p_catalog->>'release_date', '')::date,
    nullif(p_catalog->>'runtime', '')::integer,
    nullif(p_catalog->>'overview', ''),
    coalesce((select array_agg(g) from jsonb_array_elements_text(
      case when jsonb_typeof(p_catalog->'genres') = 'array'
           then p_catalog->'genres' else '[]'::jsonb end) as g), '{}'),
    coalesce((select array_agg(k) from jsonb_array_elements_text(
      case when jsonb_typeof(p_catalog->'keywords') = 'array'
           then p_catalog->'keywords' else '[]'::jsonb end) as k), '{}'),
    nullif(p_catalog->>'vote_average', '')::numeric,
    nullif(p_catalog->>'vote_count', '')::integer,
    nullif(p_catalog->>'popularity', '')::numeric,
    nullif(p_catalog->>'poster_path', ''),
    nullif(p_catalog->>'backdrop_path', ''),
    nullif(p_catalog->>'number_of_seasons', '')::integer,
    nullif(p_catalog->>'number_of_episodes', '')::integer,
    case when jsonb_typeof(p_catalog->'seasons') = 'array'
         then p_catalog->'seasons' else '[]'::jsonb end
  )
  on conflict (tmdb_id, media_type) do nothing;

  -- Who made it. The credits ride on the catalogue payload rather than as
  -- another argument, so a save stays one call and one transaction. They are
  -- capped before they leave the browser: top 15 cast plus five key crew jobs
  -- for a film, and for a series the creators only — Breaking Bad lists 25
  -- Directors in aggregate_credits because those are per-episode credits, and
  -- storing them would make "your most-watched director" a list of people who
  -- did one episode each. Inception goes from 788 raw credits to 19 stored.
  v_credits := case when jsonb_typeof(p_catalog->'credits') = 'array'
                    then p_catalog->'credits' else '[]'::jsonb end;

  if jsonb_array_length(v_credits) = 0 then
    return;
  end if;

  -- The whole credit write sits in its own block. An exception here rolls back
  -- only this much: a malformed credit must never cost someone the library
  -- entry they were actually trying to save.
  begin
    -- People first: catalog_credits has a foreign key to them.
    insert into public.catalog_people (tmdb_id, name, department, profile_path)
    select distinct on ((c->>'id')::integer)
           (c->>'id')::integer,
           c->>'name',
           nullif(c->>'department', ''),
           nullif(c->>'profile_path', '')
      from jsonb_array_elements(v_credits) as c
     where (c->>'id') ~ '^[0-9]+$' and nullif(c->>'name', '') is not null
    on conflict (tmdb_id) do nothing;

    insert into public.catalog_credits (
      tmdb_id, media_type, person_id, role, job, character, credit_order
    )
    select distinct on ((c->>'id')::integer, c->>'role', coalesce(c->>'job', ''))
           p_tmdb_id,
           p_media_type,
           (c->>'id')::integer,
           c->>'role',
           coalesce(c->>'job', ''),
           nullif(c->>'character', ''),
           nullif(c->>'credit_order', '')::integer
      from jsonb_array_elements(v_credits) as c
     where (c->>'id') ~ '^[0-9]+$'
       and c->>'role' in ('cast', 'crew')
    on conflict (tmdb_id, media_type, person_id, role, job) do nothing;
  exception when others then
    null;
  end;
end $$;

-- An earlier signature of this function would survive as a separate overload,
-- so it is dropped rather than replaced.
drop function if exists public.library_upsert(integer, text, jsonb, text, numeric);
drop function if exists public.library_upsert(integer, text, jsonb, text, numeric, boolean);
drop function if exists public.library_upsert(integer, text, jsonb, text, numeric, boolean, integer, text);

-- Add a title to the library, or change its status, rating or favourite flag.
-- Null status or rating means "leave it alone", so one entry point serves the
-- quick-add on a poster tile and the rating control on a title page alike.
create or replace function public.library_upsert(
  p_tmdb_id    integer,
  p_media_type text,
  p_catalog    jsonb   default '{}'::jsonb,
  p_status     text    default null,
  p_rating     numeric default null,
  p_favourite  boolean default null,
  p_rewatches  integer default null,
  p_recommended_by text default null,
  p_notes      text    default null
) returns public.user_library
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_existing public.user_library;
  v_row      public.user_library;
  v_status   text;
  v_episodes integer;
  v_kind     text;
begin
  if v_user is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  perform public.catalog_ensure(p_tmdb_id, p_media_type, p_catalog);

  select * into v_existing from public.user_library
   where user_id = v_user and tmdb_id = p_tmdb_id and media_type = p_media_type;

  -- A first save with no status named is an intention to watch. A rating with
  -- no status named means it has been seen — you cannot rate what you haven't.
  v_status := coalesce(
    p_status,
    v_existing.status,
    case when p_rating is not null then 'watched' else 'want_to_watch' end
  );

  select number_of_episodes into v_episodes from public.catalog_titles
   where tmdb_id = p_tmdb_id and media_type = p_media_type;

  insert into public.user_library as l (
    user_id, tmdb_id, media_type, status, rating, is_favourite,
    rewatch_count, recommended_by, recommended_at, notes,
    started_at, completed_at, episodes_at_completion
  )
  values (
    v_user, p_tmdb_id, p_media_type, v_status, p_rating, coalesce(p_favourite, false),
    coalesce(p_rewatches, 0),
    nullif(p_recommended_by, ''),
    -- Stamped rather than asked for. "Ravi, some time in March" is the whole
    -- value; making someone pick a date to record it would cost more than it.
    case when nullif(p_recommended_by, '') is not null then current_date end,
    nullif(p_notes, ''),
    case when v_status in ('watching', 'watched', 'rewatching') then now() end,
    case when v_status = 'watched' then now() end,
    case when v_status = 'watched' then v_episodes end
  )
  on conflict (user_id, tmdb_id, media_type) do update set
    status = v_status,
    rating = coalesce(p_rating, l.rating),
    is_favourite = coalesce(p_favourite, l.is_favourite),
    rewatch_count = coalesce(p_rewatches, l.rewatch_count),
    recommended_by = coalesce(nullif(p_recommended_by, ''), l.recommended_by),
    recommended_at = case
      when nullif(p_recommended_by, '') is not null
       and nullif(p_recommended_by, '') is distinct from l.recommended_by
      then current_date else l.recommended_at
    end,
    -- Notes are the one field where an empty box is a real instruction: a
    -- person who selects their note and deletes it means to delete it. Null
    -- means "not passed"; empty string means "emptied".
    notes = case when p_notes is null then l.notes else nullif(p_notes, '') end,
    -- The first time it moved out of "want to watch" is the real start date,
    -- and it must survive every later status change.
    started_at = coalesce(
      l.started_at,
      case when v_status in ('watching', 'watched', 'rewatching') then now() end
    ),
    completed_at = case
      when v_status = 'watched' then coalesce(l.completed_at, now())
      else l.completed_at
    end,
    episodes_at_completion = case
      when v_status = 'watched' then coalesce(l.episodes_at_completion, v_episodes)
      else l.episodes_at_completion
    end
  returning * into v_row;

  -- What the row says now is the truth; activity is the record of how it got
  -- there. Only ever appended, never corrected.
  --
  -- Notes are deliberately absent from it. What someone wrote privately about a
  -- film is not an event to be replayed, and the taste work has no use for it.
  v_kind := case
    when v_existing.id is null then 'added'
    when p_rating is not null and p_rating is distinct from v_existing.rating then 'rated'
    when v_status is distinct from v_existing.status then 'status_changed'
    when p_rewatches is not null and p_rewatches > coalesce(v_existing.rewatch_count, 0) then 'rewatched'
    when p_favourite is not null and p_favourite is distinct from v_existing.is_favourite then 'favourited'
    else null
  end;

  if v_kind is not null then
    insert into public.user_activity (user_id, activity_type, tmdb_id, media_type, detail)
    values (v_user, v_kind, p_tmdb_id, p_media_type, jsonb_strip_nulls(jsonb_build_object(
      'status',      v_row.status,
      'from_status', v_existing.status,
      'rating',      v_row.rating,
      'from_rating', v_existing.rating,
      'favourite',   case when v_kind = 'favourited' then v_row.is_favourite end,
      'rewatches',   case when v_kind = 'rewatched'  then v_row.rewatch_count end
    )));
  end if;

  return v_row;
end $$;

-- Set exactly which episodes of one season are watched. The client sends the
-- whole array rather than a delta, so ticking one episode, ticking a whole
-- season and clearing a season are all the same call — and there is no way for
-- the two ends to disagree about what "add" meant.
create or replace function public.library_episodes_set(
  p_tmdb_id  integer,
  p_season   integer,
  p_episodes integer[],
  p_catalog  jsonb default '{}'::jsonb
) returns public.user_library
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_row    public.user_library;
  v_list   integer[];
  v_status text;
begin
  if v_user is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  -- Sorted and de-duplicated here rather than trusted from the client, so the
  -- stored shape is the same however it arrived.
  select coalesce(array_agg(distinct e order by e), '{}')
    into v_list
    from unnest(coalesce(p_episodes, '{}')) as e
   where e > 0;

  select status into v_status from public.user_library
   where user_id = v_user and tmdb_id = p_tmdb_id and media_type = 'tv';

  -- Ticking an episode of something you never added is still a statement that
  -- you are watching it, so say so rather than failing. But only ever PROMOTE:
  -- applied unconditionally this also demotes a series you have finished —
  -- saving "Watched" and an episode tick together left the row reading
  -- "Watching", because the episode write ran second and forced it back.
  if v_status is null or v_status = 'want_to_watch' then
    perform public.library_upsert(p_tmdb_id, 'tv', p_catalog, 'watching');
  else
    perform public.catalog_ensure(p_tmdb_id, 'tv', p_catalog);
  end if;

  update public.user_library set
    watched_episodes = case
      when cardinality(v_list) = 0 then watched_episodes - p_season::text
      else jsonb_set(watched_episodes, array[p_season::text], to_jsonb(v_list), true)
    end
   where user_id = v_user and tmdb_id = p_tmdb_id and media_type = 'tv'
   returning * into v_row;

  insert into public.user_activity (user_id, activity_type, tmdb_id, media_type, detail)
  values (v_user, 'episodes_watched', p_tmdb_id, 'tv',
          jsonb_build_object('season', p_season, 'count', cardinality(v_list)));

  return v_row;
end $$;

-- Removing is a plain delete under RLS — no elevated privilege needed. It is a
-- function only so the activity row is written in the same transaction.
create or replace function public.library_remove(
  p_tmdb_id    integer,
  p_media_type text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_gone boolean;
begin
  if v_user is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  delete from public.user_library
   where user_id = v_user and tmdb_id = p_tmdb_id and media_type = p_media_type;
  get diagnostics v_gone = row_count;

  if v_gone then
    insert into public.user_activity (user_id, activity_type, tmdb_id, media_type)
    values (v_user, 'removed', p_tmdb_id, p_media_type);
  end if;
end $$;

-- Clearing a rating is distinct from not passing one, so it gets its own call
-- rather than a sentinel value nobody will remember the meaning of.
create or replace function public.library_clear_rating(
  p_tmdb_id    integer,
  p_media_type text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.user_library set rating = null
   where user_id = auth.uid() and tmdb_id = p_tmdb_id and media_type = p_media_type;
end $$;

-- Guests get nothing. Every one of these raises on a null auth.uid() as well,
-- so the grant and the body agree.
revoke execute on function public.catalog_ensure(integer, text, jsonb)                from public, anon;
revoke execute on function public.library_upsert(integer, text, jsonb, text, numeric, boolean, integer, text, text) from public, anon;
revoke execute on function public.library_episodes_set(integer, integer, integer[], jsonb)  from public, anon;
revoke execute on function public.library_remove(integer, text)                       from public, anon;
revoke execute on function public.library_clear_rating(integer, text)                 from public, anon;

grant execute on function public.catalog_ensure(integer, text, jsonb)                 to authenticated;
grant execute on function public.library_upsert(integer, text, jsonb, text, numeric, boolean, integer, text, text) to authenticated;
grant execute on function public.library_episodes_set(integer, integer, integer[], jsonb)     to authenticated;
grant execute on function public.library_remove(integer, text)                        to authenticated;
grant execute on function public.library_clear_rating(integer, text)                  to authenticated;
