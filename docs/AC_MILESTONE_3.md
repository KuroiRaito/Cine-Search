# Milestone 3 — Collection & taste

**Layer 2 in the concept doc, and the last milestone.** This is where the record
built in M2 is read back as something a person can learn from.

**Draft by Claude, 2026-09-13, against a closed grooming.** Edit or reject by number.

Grooming: `docs/GROOMING_M3.md`. Lists and canons are **cut** (B1) and appear
nowhere below.

---

## M3.1 — Collection progress on a person page

- **3.1.1** A person page shows, above the filmography, how much of that person's work you have **watched**: "6 of 10 directed", a percentage, and a bar.
- **3.1.2** The number is **per role**. Switching from Director to Writer changes both halves of the fraction, because it is a different body of work.
- **3.1.3** The subline states what remains and what was excluded: "4 to go · 16 credits filtered out".
- **3.1.4** "Watched" means status `watched` or `rewatching`. A title on the watchlist is not progress.
- **3.1.5** The denominator excludes: credits with no release date, credits not yet released, credits where the character is "Self" *(a talk-show appearance is not a film you were in)*, and credits under **200 votes**.
- **3.1.6** A role whose credits all fall below the filter shows no tab, rather than a tab leading to an empty grid.
- **3.1.7** A guest sees the filmography and no progress bar — there is nothing to measure them against. The existing "Sign in to track what you've seen" line stays.
- **3.1.8** Progress costs no extra network request. The credits are already fetched to draw the page; the library is already in memory.

## M3.2 — Capturing who made what

*Invisible. Nothing on screen changes. Everything in M3.4's person cards depends on it.*

- **3.2.1** Saving a title also records its **people** and their **credits**, in the same transaction that writes the catalogue row.
- **3.2.2** Stored credits are capped: the **top 15 cast** by billing order, and crew in six jobs only — Director, Writer, Screenplay, Creator, Original Music Composer, Director of Photography. *(Inception alone lists 736 crew.)*
- **3.2.3** Credits are shared catalogue data, written once per title for everyone, never overwritten by a later client.
- **3.2.4** A title saved before this milestone has no credits, and gains them the next time anyone saves it. Person taste is thin at first and fills in; it never shows a wrong number.
- **3.2.5** Failing to record credits never fails the save. The library entry is the thing that matters.

## M3.3 — The You screen

- **3.3.1** `/you` replaces the current stub for a signed-in person.
- **3.3.2** Three stat tiles: **Titles**, **Episodes**, **Days**.
- **3.3.3** Titles counts films and series watched, not episodes. Episodes counts ticked episodes. Days is M3.5.
- **3.3.4** Below them, taste cards under a heading naming the current ordering.
- **3.3.5** A signed-out visitor gets the sign-in invitation, not an error.
- **3.3.6** Settings is reachable from this screen.
- **3.3.7** **No streaks, no nudges, nothing that decays.** Every number is cumulative and skipping a month costs nothing. *(Design system rule, restated because it is the easiest one to break by accident.)*

## M3.4 — Taste cards

- **3.4.1** One card shape serves **genres**, **people** and **decades**: name, rank, three measures, and poster evidence.
- **3.4.2** A genre or decade card's first measure is a count of titles. A **person** card's is a fraction — "6 of 11" — the same collection progress as M3.1.
- **3.4.3** The other two measures are your **average rating** and **time**.
- **3.4.4** Up to five posters per card, drawn from titles that card is counting.
- **3.4.5** Ordering is **by count** by default, with a **Score** alternative.
- **3.4.6** Under "Score", a card needs at least **three rated titles** to appear at all — otherwise one film you loved outranks a genre you have watched for twenty years.
- **3.4.7** Cards are computed from your own records only. Nothing is compared against other users, because there are none.
- **3.4.8** The aggregation runs in **one database query**, not by shipping every row to the browser to add up.

## M3.5 — Time

- **3.5.1** Runtime is stored in **whole minutes**, always. Never hours, never a formatted string.
- **3.5.2** A film contributes its own runtime when watched.
- **3.5.3** A series contributes **per ticked episode**, using that **season's** average episode runtime — not the series average. *(Stranger Things runs 50 minutes in season one and 86 in season four.)*
- **3.5.4** A season's runtime is recorded the first time that season is opened. Ticking an episode requires opening its season, so the figure is known by the time it counts.
- **3.5.5** Where a season's runtime is not yet known, its episodes contribute nothing and the total is stated as a minimum rather than a guess.
- **3.5.6** Minutes are formatted where they are drawn: "18.4 days" on the stat tile, "3d 4h" or "13h" on a card. The same stored number serves every format.
- **3.5.7** **Rewatches multiply.** Watching a film three times is three times the hours. *(Flagged: the alternative is counting distinct titles only. Strike this line to choose that instead.)*

## M3.6 — Settings

*Agreed in the M1 grooming as "a plain, conventional section — no bespoke design". M3 is where it gets somewhere to live.*

- **3.6.1** Reachable from the You screen.
- **3.6.2** Carries: theme, region override, sign out, and the account's email.
- **3.6.3** Region override is optional; empty means "detect from where I am", which is today's behaviour.
- **3.6.4** Nothing here is destructive without confirming.

## M3.7 — States

- **3.7.1** A new account with nothing watched sees a taste screen that says so and names one action, never a bare illustration.
- **3.7.2** A person with too few rated titles to rank sees the count ordering, not an empty screen.
- **3.7.3** Errors are scoped to the section that failed. A failed taste query must not blank the stat tiles.
- **3.7.4** Skeletons mirror the layout that is coming.

## M3.8 — What the record is for

- **3.8.1** Every number on the You screen is derived from what you chose to record. Nothing is inferred from what you looked at.
- **3.8.2** No engagement tracking is added by this milestone, or ever.
- **3.8.3** Nothing computed here is visible to anyone else, because nothing is visible to anyone else.

---

## Decisions inside this draft

**3.5.7 — do rewatches multiply the time?** I have written "yes": three viewings is three times the hours, which is what "days watched" means in plain English. The alternative reading is "how much distinct cinema have I seen", which is a different and also reasonable question. Strike the line to switch.

**3.5.5 — what to do about seasons never opened.** Marking an episode from the Library screen's `+` does not open the season, so a gap is possible. I have written "contribute nothing and say so" rather than estimate. The alternative is to fetch that season quietly in the background the first time it is needed.

**3.2.4 — the three titles already saved** on the test account have no credits, and will gain them only when re-saved. Not worth a backfill for three rows; worth knowing if you have saved more by the time this ships.

---

## Explicitly not in this milestone

- **Lists and canons** — cut at grooming (B1). Not deferred; there is no later milestone to defer to.
- **Public anything** — Layers 3 and 4 are parked.
- **Collection progress on search result rows.** The M1 grooming kept it (R7) with the count resolving after the row paints. It is a search-screen change, not a taste one, and it can follow M3 without blocking it.
