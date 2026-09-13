-- ============================================================
-- Phase A — harden.
-- APPLIED to project unmzchgflrnppjwafmus on 2026-09-13
-- via migration: auth_allowlist_gate
--
-- This file is the record of what was applied. Safe to re-run.
-- ============================================================

-- Sign-ups are by invitation.
--
-- The product is private and not being rolled out, but the repository is
-- public and the Supabase URL and anon key ship in the bundle by design. With
-- open sign-ups anyone can create an account, write unlimited rows to their
-- own library, and — through catalog_ensure — insert rows into the SHARED
-- catalogue. It cannot overwrite good rows; it can add bad ones.
--
-- This gate is defence in depth beside the dashboard toggle (Auth → Providers
-- → Email → "Enable email signups"): the toggle can be flipped by mistake;
-- this cannot. To invite someone, add their email here first:
--
--   insert into public.auth_allowlist (email, note) values ('x@y.z', 'friend');

create table if not exists public.auth_allowlist (
  email    text primary key,
  note     text,
  added_at timestamptz not null default now()
);

-- Nobody reads this from the app. Not anon, not signed-in users.
alter table public.auth_allowlist enable row level security;
revoke all on public.auth_allowlist from anon, authenticated;

-- The accounts that existed when the gate went in. Emails, not secrets.
insert into public.auth_allowlist (email, note) values
  ('malaniraman15@gmail.com',   'owner'),
  ('kuroiraito15@gmail.com',    'owner'),
  ('shrutisinha1089@gmail.com', 'existing account'),
  ('test@cinesearch.test',      'test account used by Claude')
on conflict (email) do nothing;

create or replace function public.enforce_auth_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null
     or not exists (select 1 from public.auth_allowlist a
                     where lower(a.email) = lower(new.email)) then
    raise exception 'Sign-ups are by invitation.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists auth_allowlist_gate on auth.users;
create trigger auth_allowlist_gate
  before insert on auth.users
  for each row execute function public.enforce_auth_allowlist();
