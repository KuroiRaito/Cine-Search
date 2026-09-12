# Grooming — Milestone 3, Collection & taste

**Layer 2 in the concept doc, and the last milestone.** Layers 3 and 4 are parked
(owner's call, 2026-09-13), so this is where the product stops.

Everything below was checked against live TMDB responses and the live database
on 2026-09-13, not against documentation.

---

## Verdict

**Buildable, and the designs hold.** Two screens are drawn in full — the Person
page's collection bar and the You/taste screen — and both work with data we can
actually get. One thing in the concept doc has **no design at all** and needs
your call. Two numbers in the design **cannot be produced the obvious way** and
need a decision each.

Nothing here is blocked on a schema rebuild. `catalog_people` and
`catalog_credits` already exist and are empty; M3 is the milestone that fills
them.

---

## A. Buildable as drawn — no decision needed

| Design | Evidence |
|---|---|
| **Collection bar** — "6 of 10 directed", 60%, "4 to go · 16 credits filtered out" | `combined_credits` gives every credit with role, date and vote count in the one call the Person page already makes. The library is already in memory. Progress is an intersection, costing nothing. |
| **Role tabs with counts**, progress recalculated per role | Already built in `toPersonView`. The bar just reads the active role. |
| **Status button on filmography posters** (`✓` / `◷` / `+`) | This is the quick-add built in M2, with the saved state it already renders. Same component, denser grid. |
| **Taste cards** — one shape for genres, people and decades | Genres and release dates are already on `catalog_titles` for every saved title. Genre and decade cards need **no new data at all**. |
| **Stat tiles** — Titles, Episodes | Both are counts of rows we hold. |
| **Poster evidence** on each taste card | `poster_path` is on every catalogue row. |
| **"No streaks, no nudges, nothing that decays"** | Nothing to build. Worth restating because it is the rule most easily broken by accident. |

---

## B. Needs your decision

### B1. Lists and canons have no design — and the reason to build them just weakened

The concept doc puts "canons and user-made lists" in Layer 2. **The design
system has eight screens and none of them is a list.** There is nothing to build
against.

There is also a new argument against them. A list's value is largely in being
*shown to someone*. With Layers 3 and 4 parked there is nobody to show it to, so
a list becomes a private folder competing with the six statuses you already
have — "want to watch" is already a list, and a better one, because the app
acts on it.

**Recommendation: cut lists from M3.** Ship collection progress and taste, which
are the payoff the record was built for. Revisit lists only if you find yourself
wanting one and the statuses genuinely don't cover it.

**Your call:** cut, or design them first?

---

### B2. The credit filter should change — "Self" does the work a vote threshold was doing

You locked this in the M1 grooming: **per role, with a vote threshold inside
each role; 200 is the working number.** That still stands. But there is a filter
nobody considered, and it is a *correctness* rule rather than a popularity one:

**TMDB counts talk-show and archive-footage appearances as cast credits**, with
the character recorded as "Self". Appearing as yourself on a chat show is not a
film you were in.

Measured on live data — raw credits, then released-and-not-Self, then the vote
threshold applied to that:

| Person | Role | Raw | Released, not "Self" | ≥50 | ≥100 | **≥200** |
|---|---|---|---|---|---|---|
| Denis Villeneuve | Director | 26 | 23 | 12 | 12 | **10** |
| Denis Villeneuve | Cast | 33 | **3** | 0 | 0 | 0 |
| Tom Cruise | Cast | 135 | **57** | 51 | 49 | **47** |
| Emilia Clarke | Cast | 51 | 29 | 20 | 14 | **12** |

Excluding "Self" takes Tom Cruise from **135 credits to 57** before any
popularity filter runs at all. And at your locked threshold of 200, Villeneuve's
Director count is **exactly 10** — the number the design was drawn against.

Two things to note:

- **Clarke gets tight at 200** (12, against a real filmography nearer 20). She is
  the case where the threshold is doing more than tidying. At 100 she has 14.
- **A role can filter to nothing.** Tom Cruise has one Director credit and it
  falls below every threshold. Today that tab would simply disappear. That is
  defensible — but it is a silent disappearance, so it is worth naming.

**Recommendation:** add the "Self" exclusion (free, and a correctness fix), keep
your 200, and print the filtered count exactly as the design does — "16 credits
filtered out" is what makes an opinionated number honest.

**Your call:** keep 200, or drop to 100 so people like Clarke read truer?

---

### B3. "Days watched" cannot be built the way it looks, because TMDB stopped publishing the field

The design's stat tiles are **Titles · Episodes · Days**, and each taste card
carries a **time** figure. Films are fine — `runtime` is on every film.

Series are not. `episode_run_time` is **empty on every series tested**:

> Breaking Bad `[]` · Game of Thrones `[]` · Stranger Things `[]` · Arcane `[]` ·
> Rick and Morty `[]` · The Mandalorian `[]` · The Queen's Gambit `[]`

TMDB has effectively retired the field. The runtimes **do** exist per episode on
the season endpoint (7 of 7, 10 of 10, 9 of 9 on the seasons tested), so the data
is reachable — just not in one call.

A single average per series is not good enough either: Stranger Things averages
**50 minutes in season 1 and 86 in season 4.** Any "days" figure built on one
number per series is wrong for exactly the shows people watch most.

| Option | Cost | Accuracy |
|---|---|---|
| **(a) Store a runtime per season**, filled when a season is opened | Free — extends the `seasons` column we already have | Exact for every episode you ticked, because ticking requires opening the season. Gaps only where episodes were marked from the library `+`. |
| (b) Fetch every season when a series is saved | 5–10 API calls per save | Exact, and slow at exactly the wrong moment |
| (c) Drop "Days" for series; count films only | Free | Honest but halves the stat |
| (d) Assume 45 minutes an episode | Free | Wrong by a third for prestige TV |

**Recommendation: (a).** It has a property the others don't — the data arrives
as a side effect of the thing that makes it matter. You cannot tick an episode
without opening its season, so the runtime is almost always already known by the
time it counts.

**Your call:** accept (a) with its small gaps, or drop "Days" until it can be exact?

---

### B4. Taste by person needs stored credits, and one film can carry 736 of them

Genre and decade cards need no new data. **Person cards do** — "Denis Villeneuve,
6 of 11" across your whole library means knowing who made every title you saved,
which is what the empty `catalog_credits` table is for.

The volume is the decision. **Inception alone has 52 cast and 736 crew credits.**
Storing credits wholesale would put roughly 800 rows per title into a shared
table, which at a few hundred saved titles is a quarter of a million rows of
gaffers and assistant editors that no screen will ever read.

Filtering to the jobs a person actually tracks — Director, Writer, Screenplay,
Creator, Composer, Director of Photography — leaves **8 crew rows for Inception**.
With the top 15 cast, that is about **23 rows per title**: 500 saved titles is
~11,500 rows, which is nothing.

**Recommendation:** store top-15 cast plus those six crew jobs, written by the
same function that already writes the catalogue row, so a save stays one
transaction.

**Your call:** is top-15 cast the right cut, or is cast taste ("your most-watched
actor") not worth storing at all?

---

### B5. The taste screen has a "Score ▾" toggle and the design doesn't say what score means

The header reads **"Your taste · by count"** with a **Score ▾** control, so there
are at least two orderings. "By count" is unambiguous. "By score" is not — and
sorting by your average rating naively puts a genre you have seen *one* film in,
and loved, above the genre you have watched for twenty years.

**Recommendation:** "Score" sorts by your average rating with a **minimum of
three rated titles** to appear at all, and the card already shows the count, so
the evidence for the ranking is on the card. Default stays "by count".

**Your call:** three, or a different floor?

---

### B6. Decades

The design's own rule says **"One card shape serves genres, people and decades"**,
but only genre and person cards are drawn. Decades need no new data — every
catalogue row has `release_date`.

**Recommendation:** build them; the rule says the component already covers it.
**Your call:** confirm decades are in scope.

---

## C. Missing, but needs no bespoke design

- **The "You" header** carries a **⚙** in the design. Settings was already agreed
  as "a plain, conventional section — no bespoke design" in the M1 grooming. M3
  is where it gets somewhere to live.
- **Taste before there is any taste.** A new account has nothing to compute from.
  The design's own states section covers this shape: name one action, never a
  bare illustration.
- **A person with no credits in a role** after filtering — see B2.
- **Collection progress needs an "unwatched" state**, not just a count: the design
  says "4 to go", which is the useful half. It is subtraction, not a new screen.

---

## D. Schema implied

| Change | Why |
|---|---|
| Populate `catalog_people` + `catalog_credits` | Person taste cards (B4). Tables already exist and are empty. |
| `catalog_titles.seasons` gains a runtime per season | "Days" and per-card time (B3). Extends a column that already exists rather than adding one. |

No new tables. No migration of existing rows.

---

## E. Suggested build order

1. **Collection bar on the Person page.** Needs no new data or schema, and it is
   the single most distinctive thing in the product. Ship it alone.
2. **Credit capture** — extend the save path to write people and credits.
   Invisible, but everything in step 4 waits on it having run for a while.
3. **Taste: genres and decades.** No new data; proves the card component.
4. **Taste: people.** Reads what step 2 has been collecting.
5. **Season runtimes and the "Days" tile**, last, because it is the least
   certain and the easiest to cut.

Steps 1 and 3 are shippable on their own. If M3 has to stop early, it should
stop after 3 and still be worth having.

---

## F. Still open from earlier grooming

- **Rewatch ticks.** "When someone re-ticks a series episode by episode, do the
  first pass's ticks get cleared, or kept per pass?" Deferred to the database
  discussion and never settled. Currently dormant: `rewatch_count` is a manual
  stepper, so nothing depends on the answer yet.
- **Leaked-password protection** is still disabled in Supabase Auth.
