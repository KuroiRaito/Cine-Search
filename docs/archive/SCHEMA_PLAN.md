# Your database — what's there, what's missing

Checked live on 2026-09-12 against the real Supabase project. Plain language; the SQL is in `supabase/001_mvp_schema.sql`.

---

## What you have right now

**Three tables.** Not the empty slate, and not as much as we need.

### `profiles` — who you are
`id` · `username` · `created_at`

That's it. Three columns. There's nowhere to store your country, your streaming services, or your theme preference — so **Settings has nothing to write to yet.**

### `user_movies` — the important one
`id` · `user_id` · `tmdb_id` · `media_type` · `title` · `rating` · `status` · `created_at` · `updated_at`

This is a good foundation. It already knows a record belongs to a person, points at a TMDB title, distinguishes films from series, and has room for a rating and a status.

What it's missing is everything we decided in the last few days: the rewatch counter, who recommended it, the episode-count snapshot, and the "where did this row come from" marker for future imports.

Also — `status` is currently only ever set to `wishlist`. It needs to hold all six states.

### `user_episodes` — exists, but can't work
`id` · `user_id` · `season_number` · `episode_number` · `watched` · `watched_at` · `rating` · `created_at`

**There is no column saying which show the episode belongs to.**

So a row here says "this person watched season 2, episode 4" — of *what*, nothing records. Every show in your library would share the same season 2 episode 4. Nothing in the app writes to this table, which is presumably why nobody noticed.

It needs one column added. Any existing rows can't be rescued — there's no way to work out which show they meant — but since nothing writes to it, there almost certainly aren't any.

---

## What needs to change

### Settings needs somewhere to live
Three columns on `profiles`: your streaming services, your country, your theme.

**On country:** you want it detected from your IP, and that already works — `useRegion` looks you up and remembers it in the browser. So the country column stays **empty unless you deliberately change it.** IP stays in charge; the column is only there so a manual override sticks if you ever want one. Nothing changes about how it works today.

### The main table needs five new columns
- **`rewatch_count`** — how many times you've seen it. Counts up automatically when you finish a rewatch; you can edit it.
- **`recommended_by`** — who told you to watch it. The thing no competitor stores.
- **`recommended_at`** — auto-stamped, so "Ravi, March" happens without you typing a date.
- **`episodes_at_completion`** — how many episodes existed when you marked a show finished, so we can spot a new season and quietly move it back to Watching.
- **`source`** — where the row came from. Everything says `app` today; one day some will say `letterboxd`. Free to add now, annoying to add later.

### Two safety rails
- **Status** gets locked to the six real values, so a typo can't create a seventh state nobody can see.
- **Ratings** get locked to 0.5–10 in half-steps, matching TMDB so your score and theirs compare directly.

One detail: your existing saved titles all say `wishlist`. The migration renames them to `want_to_watch` before locking anything down, so nothing is lost.

### The episodes table gets its missing column
Plus a rule that the same person can't log the same episode twice.

### Speed
Two indexes — one for "show me everything I'm watching", one for "show me my progress on this series". Without them these get slower as your library grows. With them they stay fast.

---

## Locking the database

I couldn't confirm from outside whether row-level security is on. Reading your tables without signing in returns nothing, which is what a *properly locked* database does — but it's also what an *empty* one does, so it isn't proof.

The migration turns it on and writes the rules explicitly. **It's harmless if it was already on.** Each person can read and write their own rows and nobody else's — including you; the owner has no special back door here.

---

## What this does not add yet

Deliberately out of scope, matching the MVP: no lists, no reviews, no follows, no activity, no public profiles. Those arrive with the community layer.

---

## How to run it

1. Supabase dashboard → **SQL Editor**
2. Paste `supabase/001_mvp_schema.sql`
3. **Run**

It's safe to run twice — every step checks whether it's already been done. Worth taking a backup first regardless, since it does rewrite the `status` values.

Tell me once it's run and I'll verify it from here.
