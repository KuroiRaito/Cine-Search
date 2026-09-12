# Milestone 2 — The record

**Scope:** accounts, and everything a person can record about a title.
This is Layer 0 in the concept doc — the substrate every later layer reads from.

**Part one (shipped, PR #39):** sign up, sign in, sign out, profiles, intent surviving sign-in.
**Part two (this document):** the library itself.

**Draft by Claude, 2026-09-13. Edit or reject by number.**

---

## M2.1 — What a person can record

- **2.1.1** A title has exactly one **status**. A **series** offers all six — want to watch, watching, on hold, watched, rewatching, dropped. A **film** offers three — want to watch, watched, dropped. *(Design system: "'Watching' is meaningless for a 2h film; forcing one vocabulary would degrade the film flow to serve the series flow.")*
- **2.1.2** A title can carry a **rating** from 0.5 to 10 in half-point steps, on TMDB's own scale so the two numbers are comparable.
- **2.1.2a** Rating is **locked until Watched or Rewatching**. Tapping a star earlier says so rather than failing silently. *(Design system rule.)*
- **2.1.3** A title can be marked a **favourite** — a single flag, not a score. The heart in the design system is this and nothing else.
- **2.1.4** A series records **which episodes have been watched**, by season and number.
- **2.1.5** A title can be **removed** entirely. Removing erases the status, rating, favourite and episode progress together.
- **2.1.6** Nothing above is ever visible to another person. The whole library is private in this milestone.

## M2.2 — Adding

- **2.2.1** The `+` on any poster tile adds that title as **want to watch** in one tap, with no sheet and no confirmation.
- **2.2.2** A tile already in the library shows that, and its `+` no longer offers to add it again.
- **2.2.3** The title page's primary button adds with the same single tap.
- **2.2.4** Once a title is in the library, that button shows the **current status** instead of an invitation to add.
- **2.2.5** Tapping it again opens the editor rather than toggling anything.
- **2.2.6** A guest tapping any of these gets the sign-in sheet, unchanged from Milestone 1.

## M2.3 — The editor

- **2.3.1** One sheet carries status, rating, favourite and remove. There is no second place to change any of them.
- **2.3.2** Every status the title can hold is visible at once. No dropdown — one tap instead of open, scan, tap. Films render three, series six.
- **2.3.3** The current status is visibly current.
- **2.3.4** Rating is set in half points and can be cleared without removing the title. Whole star = two points, right-click or long-press = the half below it.
- **2.3.4a** The editor also carries **rewatches** and **who recommended it** — free text, with the month stamped automatically rather than asked for.
- **2.3.5** Remove asks once before it acts, and says what will be lost.
- **2.3.6** The sheet closes on save, on escape, and on tapping outside it.

## M2.4 — Episodes

- **2.4.1** Each episode row on a series page can be ticked as watched.
- **2.4.2** Ticking an episode when the series is not yet in the library adds it as **watching**.
- **2.4.3** Ticking the last unwatched aired episode **offers** to mark the series watched. It proposes and never assumes, because unaired seasons exist.
- **2.4.3a** Ticking an episode never **demotes** a status. It promotes an untracked or "want to watch" series to watching, and leaves watched, on hold, rewatching and dropped alone.
- **2.4.4** A season shows how many of its episodes are watched.
- **2.4.5** A whole season can be ticked or cleared in one action. Per season, never per series — a whole-series action is too destructive for a single tap.
- **2.4.6** Episodes that have not aired yet cannot be ticked.

## M2.5 — The Library screen

- **2.5.1** `/library` lists everything saved, grouped by status.
- **2.5.2** The six statuses are tabs; each shows its count.
- **2.5.3** An empty status says so rather than showing an empty grid.
- **2.5.4** **Series are rows, films are a grid**, inside one filter. A series carries progress, which a poster cannot show and a row can.
- **2.5.4a** A series row's `+` marks the **next unwatched episode** and the confirmation names it — never "add one to a number". Undo lasts six seconds.
- **2.5.5** Tapping an entry opens its title page.
- **2.5.6** The status can be changed from this screen without opening the title page.
- **2.5.7** A signed-out visitor sees the sign-in invitation, not an error.

## M2.6 — Honesty of state

- **2.6.1** Every control reflects the saved state the instant it is tapped, before the server has answered.
- **2.6.2** If the server then refuses, the control returns to its real state and says what failed.
- **2.6.3** The same title open in two places never shows two different states.
- **2.6.4** Signing out clears every trace of the library from the screen immediately.
- **2.6.5** A failed write is never silent.

## M2.7 — What the record is for

*Not user-visible. These exist so the recommendation work in Layer 2 has something to learn from — the reason this schema looks the way it does.*

- **2.7.1** Every status change, rating and removal appends a row to `user_activity`. It is only ever appended to.
- **2.7.2** `started_at` is the first time a title left "want to watch", and survives every later status change.
- **2.7.3** `episodes_at_completion` records how long a series was when it was completed, so "watched it all" stays true after new seasons air.
- **2.7.4** Genres and keywords are stored on the catalogue row when a title is first saved, so taste can be computed without calling TMDB again.
- **2.7.5** No engagement tracking. No page views, no dwell time, no scroll depth. The record is what a person chose to record.

---

## Decisions this forced

**`catalog_titles.seasons` is new.** `number_of_episodes` alone cannot name which episode comes next: "11 of 62" does not say whether that is S2 E4. Without the per-season breakdown the Library screen would have to fetch every series from TMDB to draw one row, or guess at the season boundaries — and a `+` that marks the wrong episode is worse than no `+`. Stored as `[{"n":1,"c":7}, …]`.

**`is_favourite` is new.** The design system draws a heart with `aria-pressed`, so it is a toggle the user can see — but the schema built in Milestone 2 part one had nowhere to put it. Adding a boolean to `user_library` rather than overloading rating: a favourite is not a 10, and the two carry different signal. See `supabase/002_library_writes.sql`.

**No service role key.** The plan was a secret key in a server function so the app could write the shared catalogue. Replaced by `SECURITY DEFINER` functions in Postgres: nothing secret ships anywhere, the catalogue write surface is exactly four functions, and catalogue + library + activity commit in one transaction. The catalogue insert is `ON CONFLICT DO NOTHING`, so a client can create a missing row but never overwrite a good one.

---

## Deliberately not in this milestone

- **Notes.** The design system's editor has a Notes field; there is no column for it, and adding one is a decision about whether notes are ever published later. Left out rather than half-built.
- **"Jump to episode."** The stepper covers "one more"; jumping covers "I binged seven". The second is a screen of its own.
- **Search and sort inside the library.** Both are in the design; neither matters at three saved titles, and both want real data to be designed against.
