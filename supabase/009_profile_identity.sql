-- ============================================================
-- Profile, step 2 — identity.  docs/profile-module.html §02, §06, §09
-- APPLIED to project unmzchgflrnppjwafmus on 2026-09-16
-- via migration: profile_identity
--
-- This file is the record of what was applied. Safe to re-run.
-- ============================================================
--
-- Five columns. The handle (profiles.username) and the joined date
-- (profiles.created_at) already existed and are untouched.

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists bio          text;

-- The banner is two values, not one. Without the kind, E5 cannot tick what is
-- already selected — "/abc.jpg" and "dusk" are both just strings.
alter table public.profiles add column if not exists banner_kind  text;
alter table public.profiles add column if not exists banner_value text;

-- Absent is a valid, designed state: the initial on a gradient is the default
-- and not a fallback, so this stays null until somebody uploads one. No
-- Storage bucket exists yet and none is created here — §06 recommends the
-- catalogue-first route partly because it sidesteps that entirely.
alter table public.profiles add column if not exists avatar_path  text;

-- A limit enforced only in a sheet is not enforced. §09 says so explicitly,
-- which is why this is a constraint and not a maxlength.
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len
  check (bio is null or char_length(bio) <= 1000);

alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles add constraint profiles_display_name_len
  check (display_name is null or char_length(btrim(display_name)) between 1 and 40);

alter table public.profiles drop constraint if exists profiles_banner_kind;
alter table public.profiles add constraint profiles_banner_kind
  check (banner_kind is null or banner_kind in ('backdrop', 'colour', 'upload'));
