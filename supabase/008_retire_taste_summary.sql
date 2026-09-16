-- ============================================================
-- Retire taste_summary().
-- NOT YET APPLIED. Run this AFTER the profile-stats PR is merged
-- and deployed — not before.
-- ============================================================
--
-- 007 deliberately left this in place: a migration lands before the code that
-- needs it, and dropping the old function first would blank the You screen for
-- everyone in between.
--
-- Once profile_stats() is what the client calls, keeping both is the problem
-- rather than the safety net. They compute overlapping numbers from one
-- library, which is exactly how two answers to the same question come to
-- disagree — and the one nobody is watching drifts first.
--
-- Check before running:
--   select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'profile_stats';

drop function if exists public.taste_summary();
