-- ============================================================
-- Entry module — two gaps in how a username is claimed.
-- NOT YET APPLIED. Run this in the Supabase SQL editor.
-- Safe to re-run.
-- ============================================================

-- 1. "Raman" and "raman" are the same name to a person and two different rows
--    to Postgres. The existing unique index is on the raw text, so the app
--    would happily hand out both and then show two people the same handle.
--
--    Checked against the four accounts that exist: lower(username) is already
--    distinct across all of them, so this creates without a conflict.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- 2. Nothing could ask whether a username was free until it tried to take it —
--    and by then the account had already been created, which is what made a
--    taken username a dead end rather than a correction. profiles is not
--    readable by anon (deliberately: it holds other people's regions and
--    settings), so the question needs a function that can see the table without
--    handing it over.
--
--    This leaks exactly one bit — whether a name is taken — which the sign-up
--    form would report anyway the moment you submitted it. It returns nothing
--    about whose it is.
create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when candidate is null or length(trim(candidate)) < 3 then false
    else not exists (
      select 1 from public.profiles p
       where lower(p.username) = lower(trim(candidate))
    )
  end;
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- The app degrades gracefully without this: Auth.jsx treats an error from the
-- function as "don't know" and falls through to the recovery step. Applying it
-- moves the bad news to before the account exists instead of after.
