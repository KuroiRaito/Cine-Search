# Grooming — MVP designs

**Input:** "Cine Search Designs" (8 screens + editor sheet, rules R1–R26, 12 edge cases, live-data validation) and the Projector system.
**Output:** what's buildable as drawn, what needs a decision from the owner before acceptance criteria, and what's missing.
**Date:** 2026-09-12

---

## Verdict

**Roughly 85% is buildable as drawn**, against data we've verified exists. The design is unusually implementable: it names states, empty cases and failure modes, and it already corrected itself against a live TMDB pull.

Six items need an owner decision or a change before AC can be written. Two of them are cost problems the design can't see from the outside; one is a dependency on a screen that doesn't exist.

---

## A. Buildable as drawn — no changes needed

| Area | Rules | Note |
|---|---|---|
| Title page — film | R8–R13 | Every field verified present. R13 (region stated, not implied) is cheap and prevents the worst failure. |
| Title page — series | R14, R15, R17 | Season/episode data confirmed: names, air dates, stills, per-episode scores. |
| Person page | R19–R22 | `movie_credits` + role split is one call. |
| Library | R25–R28 | Status chips with counts beat stacked sections; agreed at 400 titles. |
| Taste | R29–R31 | All computed from our own records. Small libraries — compute client-side for MVP. |
| States | R32–R35 | Section-scoped errors (R32) is the right call and falls out of per-section fetching. |
| Six-state palette | — | Hue + icon + label, gold withheld. Accessible and consistent with the two-accent rule. |
| Edge cases | 12 of 12 | All implementable. Three carry schema consequences — see §B. |

---

## B. Needs a decision before AC

### B1. The collection denominator is a policy, and the cheap options are narrower than they look

The design already found this: Villeneuve is **26 raw / 24 released / 10 at ≥200 votes**. What it couldn't see is the *cost* of each rule.

`movie_credits` returns release date, vote count, popularity and genre — but **not runtime**. So:

| Rule | Villeneuve | Cost | Problem |
|---|---|---|---|
| Released only | 24 | Free | Includes shorts, concert films, TV segments. A cinephile will call 24 wrong. |
| Released + ≥200 votes | 10 | Free | **Drifts.** A film crossing 200 votes silently changes someone's "6 of 11" to "6 of 12". |
| Released + feature-length | ~22 | **1 API call per film** | Stable and explainable, but needs a metadata cache we don't have. |

**Recommendation:** ship **released + vote threshold** for MVP — it's free, and it matches the number the design was drawn against. Accept the drift and state the rule in the UI ("10 notable films"). Build the metadata cache later and switch to feature-length, which is the rule that doesn't move.

**Your call:** the threshold value, and whether drift is acceptable.

### B2. Collection progress in search rows (R7) is expensive; on the person page (R20) it's free

R20 costs one extra call on a page the user deliberately opened. Fine.

R7 puts the same progress on **every person row in search results** — each needs its own `movie_credits` call plus a watched-set intersection. Three people in results = three extra round trips on every search.

**Recommendation:** keep R7 — it *is* the wedge — but load it **after** the row paints, so the row appears immediately and the count fills in. No change to the design, just to when it resolves.

### B3. The editor sheet has no URL, and browser back will leave the page

R19 says the editor is a sheet that "never takes a URL of its own." Correct as a model. But on mobile web the back gesture is primary navigation — as specified, back from the editor exits the **title page** instead of closing the sheet.

**Fix, no design change:** push a history entry when the sheet opens and close it on `popstate`. The sheet stays URL-less; back closes it. **This must be in the AC** or it ships broken on the exact platform we're targeting first.

### B4. The aired-episode denominator has a cheap solution the design shouldn't pay for twice

R18 counts episodes across the whole run; the edge case says the denominator counts **aired episodes only**. Done naively that's one call per season.

It's free from the single detail call already being made: `seasons[]` carries `episode_count` per season, and `last_episode_to_air` gives the last aired season and episode. Sum the earlier seasons (excluding season 0) and add the last aired episode number. **Zero extra calls.**

Confirmed against Breaking Bad: `number_of_episodes` = 62, seasons 1–5 sum to 62, specials sit outside — so the specials exclusion is already true in TMDB's own numbers.

### B5. "New season → Watched flips to Watching" needs a stored snapshot

The edge case is right and it's a nice touch, but it's undetectable without remembering what "finished" meant. Needs `episodes_at_completion` stored on the record; compare on load.

**Schema consequence.** Cheap if decided now, annoying to backfill later.

### B6. The rewatch counter may have gone missing

`CONCEPT.md` §9.6 decided rewatches are **a counter on the record** — "how many times". The editor has status (including *Rewatching*), progress, rating, and "who recommended it", but no visible count field.

**Either:** the count auto-increments when a *Rewatching* record reaches Watched, **or** a field is missing from the editor. Needs resolving — it's a named differentiator for the Tracker.

---

## C. Missing — real, but needs no bespoke design

These are standard patterns. They can be built from existing primitives without new screens being drawn.

### C1. Settings — **and R3 depends on it**

This is a blocking gap, not a nice-to-have. **R3 says "On your services" filters by the user's declared providers, and region comes from the profile, not the IP.** There is currently nowhere to declare either. R3 cannot be built as written.

Settings needs:
- **Region** — drives watch providers everywhere (R13 prints it)
- **My services** — the provider multi-select R3 depends on
- **Theme** — the system ships light and dark; something has to switch them
- **Account** — email, password, sign out
- **Delete account** — baseline expectation where we store personal data

Form rows, a multi-select and a toggle. Nothing new to design.

### C2. About / attribution — a licensing obligation, not a feature

TMDB's terms require attribution, and provider data requires crediting JustWatch. The README carries the TMDB line; **the product doesn't.** One screen: attribution, version, links. Not optional.

### C3. First run

Region and services have to be set once. Either default region by IP and let Settings correct it (fastest), or ask on first run. **Recommendation:** default silently, correct in Settings — asking before anyone has seen the app costs more than it returns, and it conflicts with "feel like home, never forced."

### C4. Not-found route

New requirement the moment routing lands. A title or person ID that 404s from TMDB needs a real page, not a blank one.

### C5. Data export

Cheap — the data is ours and already structured. Serves the Tracker directly, and it's the honest counterpart to account deletion. A button in Settings.

### C6. Import from Letterboxd / Trakt — candidate, not MVP

Both competitors export CSV. The format is `Date, Name, Year, Letterboxd URI` plus `Rating`, and the diary export carries a **`Rewatch`** column that maps onto B6's counter directly.

The catch: **exports carry no TMDB IDs.** Import is a title+year → TMDB matching problem — exactly the fuzzy-matching work in `BRIEF.md`, which is a real reason it isn't free.

**Recommendation:** not MVP. But add a `source` column to the records table now so imported rows are distinguishable later. It's the single strongest migration lever this product has — it's how someone arrives with a library instead of an empty app.

---

## D. Confirmed by the design — two open questions now closed

- **Guest mode.** The edge case says guests read everything and every tracking control prompts sign-in, with **"no parallel local data."** That settles it: the `localStorage` fork in `userApi.js` goes. One database, not two.
- **Modal vs page.** Eight routed screens plus one sheet. `DetailModal` is retired.

---

## E. Remaining blocker, unchanged

**Is RLS enabled on `user_movies`?** Private self-only profiles require it keyed to `auth.uid()`. Nothing in Layer 0 should ship without it.

---

## F. Suggested build order

Each slice is demoable and testable on its own.

| Slice | Contains | Unblocks |
|---|---|---|
| 1 | Router, shell, bottom nav, 404 | Everything |
| 2 | Title page — film (R8–R13) | The spine |
| 3 | Editor sheet + schema + RLS (B3, B5, B6) | All tracking |
| 4 | Title page — series + episode guide (R14–R18, B4) | The habit loop |
| 5 | Library (R25–R28) | The Tracker |
| 6 | Search results + filters (R4–R7, B2) | The front door |
| 7 | Person page (R19–R22, B1) | The wedge |
| 8 | Home (R1–R3) — **needs C1** | The daily open |
| 9 | Settings, About, export (C1, C2, C5) | R3, and licensing |
| 10 | Taste (R29–R31) | The Tracker's payoff |

Note that **Home is late**, despite being screen 1. It depends on Continue-watching data existing and on the services setting from C1 — so it's built once there's something to continue.

---

## G. Decisions locked — 2026-09-12

Approved by the owner.

| # | Decision | Detail |
|---|---|---|
| B1 | **Collection denominator** = released + vote threshold | Free to compute. Accepts slow upward drift. Switch to feature-length once a metadata cache exists. |
| B2 | **Person progress in search rows** loads after the row paints | Row appears instantly, count fills in. R7 kept. |
| B3 | **Editor sheet pushes a history entry** | Back closes the sheet, not the page. Sheet still has no URL of its own. |
| B4 | **Aired-episode denominator from one call** | `seasons[].episode_count` + `last_episode_to_air`. Zero extra requests. |
| B5 | **`episodes_at_completion` stored** | Enables the Watched → Watching flip when a new season lands. |
| B6 | **Rewatch count is automatic, and editable** | Increments when a *Rewatching* record reaches Watched. Manual correction allowed. |
| C1 | **Settings is in scope** | Services, country override, theme, account, sign out. |
| C2 | **About/attribution page is in scope** | TMDB and JustWatch credit — a licensing obligation. |
| C3 | **First run defaults silently** | No onboarding questions. Correct it in Settings. |
| E | **RLS written and enabled** | `supabase/001_mvp_schema.sql`. Could not confirm prior state from outside; the migration is safe either way. |

### Owner override — region stays IP-based

**R3 is amended.** The design said region comes from the profile, not the IP. The owner has chosen to keep IP detection, which is already implemented in `useRegion` (IP lookup → browser locale fallback → remembered in the browser).

The profile keeps a nullable `region` column used **only** if someone deliberately overrides it. Default behaviour is unchanged.

*Known trade-off, accepted:* travelling abroad changes your detected region, so watch-provider results follow you rather than your subscriptions. The nullable override column means this is fixable later without a migration. R13 — "region is stated, not implied" — becomes more important, not less, because the region can now change without the user doing anything.

### Still needed from the owner

- Run `supabase/001_mvp_schema.sql`, then confirm.
- One open item from B1: the exact vote threshold. 200 is the design's working number; it stands unless changed.

### Owner review of the recommendations — amendments

**B1 amended — the denominator is per role, and Director is the one that matters.**
Not one number for a person, but one number *per role*. "6 of 11" means eleven films they **directed**, six of which you've seen. Switch to the Writer tab and both numbers change, because it's a different body of work. Director is the default tab and the headline figure — it's what most people actually track. A relevance restriction (the vote threshold) still applies *within* each role, to keep shorts and fragments out of the count. This confirms and sharpens R21 and R22.

**B6 amended — a rewatch is a complete pass, logged either way.**
Two routes to the same outcome, per AL-chan's editor:
- **Bulk:** "watched it all again" — one tap, count goes up by one.
- **Episode by episode:** start a rewatch and tick through the series again exactly as the first time. Completing it increments the count.

`rewatch_count` therefore means *number of complete passes*, and the user can always correct it by hand.

**C1 amended — Settings is a plain, conventional section.** No bespoke design; standard rows and toggles.

**Amended — search behaves as designed.** No special treatment. *Interpretation applied:* R7 stands (person rows carry collection progress), with the count resolving after the row paints so typing never stalls. Invisible to the user; it simply appears.

**C6 dropped — no Letterboxd import, and no `source` column.**
The import was explored and judged not worth it. Parked entirely, to be reconsidered only if a real requirement appears. **The `source` column is removed from the migration** — an unused column is a cost, not an option.

**Guest mode narrowed.** Guests browse and read freely — home, search, and the pages they lead to. **Every tracking action requires an account.** No partial local state, no syncing later. *Interpretation applied:* reading a title or person page is browsing, not tracking, so guests keep it; otherwise search results would lead nowhere.

**Open question raised by the rewatch model:** when someone re-ticks a series episode by episode, do the first pass's episode ticks get cleared, or kept per pass? Clearing is simpler and enough for a count. Keeping them per pass costs one column now and would be a migration later. **To settle in the database discussion.**
