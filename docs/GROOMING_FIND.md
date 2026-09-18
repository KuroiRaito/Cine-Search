# Grooming — Find module

**Input:** `docs/find-module.html` (11 sections, 13 frames, 57 states), the shipped `discover` and `search` modules, and `eval/queries.json`.
**Output:** what is buildable as drawn, what the document should fix, and what needs an owner decision before acceptance criteria.
**Date:** 2026-09-18

---

## Verdict

**Buildable as drawn, and the numbers hold.** I re-measured the claims this module rests on rather than taking them on trust, and they reproduce. This is the best-evidenced design document in the repository.

Eleven items to fix, none of them structural: two wrong cross-references, three counting errors, one contradiction with shipped code that is the only one I would call serious, and five build risks the handover should name.

---

## A. Re-measured independently — the evidence holds

All 120 golden-set queries, run through `/search/multi` on a fresh dev server, zero-result rate by category:

| Category | n | Document | Mine |
|---|---|---|---|
| exact_title | 15 | 0% | 0% |
| partial | 10 | 0% | 0% |
| typo | 20 | 75% | 75% |
| person_led | 15 | 40% | 40% |
| franchise | 10 | 80% | 80% |
| hinglish | 15 | 80% | 80% |
| mood | 20 | 95% | 95% |
| plot_recall | 10 | 100% | 100% |
| attribute | 5 | 100% | 100% |
| **All** | **120** | **62%** | **63%** |

Spot-checks, all exact:

- **FQ17** — `inception (2010)` → 0 results, `Inception 2010` → 0 results, `inception` + `year=2010` → 3 results with Inception first. The dead end is real and rung 1b fixes it.
- **L4, the no-floor rule** — `vote_average.gte=8` sorted by `vote_count.desc` returns the document's exact top three for English, Hindi, Tamil, Telugu and Malayalam.
- **FB4, the ceiling** — the 1990s, Drama, and no filter at all each report `total_results 20001` and `total_pages 1001`. Identical, as claimed.
- **The golden set** — 120 queries in nine categories, counts matching the document's table exactly.

Code claims, all accurate: `.head-actions` duplicates three shell controls; `Tile.jsx:36` renders `{state ? state.icon : '+'}`; the search module's written rule is "People rank alongside titles, never above them"; `ListFilter` is genuinely not in the 33-icon set; and the `--grid-min` ladder is 136 / 170 / 180 / 208, which matches the code as of today.

---

## B. Fix in the document — concrete and cheap

| # | Where | Problem |
|---|---|---|
| B1 | §01 | **"80 of the 120 have never been scored"** — it is **70**. 50 carry `expected` entries. |
| B2 | §01 | **"the one committed run covers exact titles, typos and partials"** — it also covers hinglish (3) and plot_recall (7), and it is incomplete within the three named: 13 of 15 exact, 19 of 20 typo, 8 of 10 partial. The document's own table gives graded figures for hinglish and plot_recall, so the prose contradicts the table beside it. |
| B3 | §01 | Cross-reference: plot_recall's honest exit points at **state FQ9**, which is "nothing, with a candidate". plot_recall has no candidate — the state is **FQ11**, which the table verifies with "plot_recall 100% empty". |
| B4 | §08 | Cross-reference: the two-people collision points at **FQ6**, which is "a person with no photo". It is **FQ4**. |
| B5 | §01 / §04 | The rescue ladder is counted three ways: "Five rungs" (§04), "Four rungs of rescue, three of them free" (§01 table), "none of the four rescue rungs touches it" (§01 prose) — over a table with six rescue rows (1, 1b, 2, 3, 4, 5). Pick one and use it everywhere. |
| B6 | §01 vs §08 | The §01 table says person_led is **7% empty after rung 1**. §08 then adds `with` and `by` to rung 1 and says both failures become rank 1 — i.e. **0%**. My run measures 0%. The table predates its own amendment. |
| B7 | §06 | "Seven facets, one toggle, one sort" and "Eight facets exist" describe the same set. The toggle is counted as a facet in one sentence and not the other. |
| B8 | §10 / §11 | Decision ids are **FD-1 … FD-7** while Discover states are **FD1 … FD9**. One hyphen apart, in the same document, and §10 opens by promising collision-free prefixes. The title module used `TD` for decisions against `TM/TV/TP/TS` states; `FD` is already taken here. Suggest renaming the decisions. |

---

## C. Gaps — states that are missing

| # | Case | Why it matters |
|---|---|---|
| C1 | **FQ0 with no recent searches** | FQ0 is "Recents, then presets". On the first ever visit to the Search tab there are no recents, which is the literal first-run state of a whole tab. Presets alone is probably the answer, but it should be drawn. |
| C2 | **Hide what I've seen, with Load more** | FB16 has the count say "18 of 20 shown · 2 already watched". A later page can be 20 of 20 already watched, so the grid gains nothing while Load more reports success. Needs a rule: keep fetching, or say "nothing new on this page". |
| C3 | **"With the parents" in an unmapped country** | §05 rejects certification as a facet *because* the vocabulary is per-country, then builds a preset on it. What the preset does in a region whose vocabulary is not mapped is unspecified — it must degrade to something, and "empty shelf on the home screen" is the failure §07 already warns about for `feel good`. |

---

## D. Contradicts shipped code

**D1 — FB8 says the region is "never guessed silently from an IP". The shipped app does exactly that.**

`src/shared/hooks/useRegion.js` sends the user to `https://ipapi.co/json/` on first load and writes `country_code` straight into `localStorage` with no prompt. There is no consent step and no mention anywhere in the UI.

This is the only finding I would call serious, and it is not really a Find problem — Find is the document that noticed. It is a third-party request carrying the user's IP, on a product whose front door says "private by default". It also makes Discover non-deterministic: which TMDB endpoints the app calls at all depends on that lookup, which I hit while pinning the snapshot fixtures for the title module.

**Recommendation:** treat it as a defect on its own, not as Find scope. FB8's rule is right; the code should be brought to it.

**D2 — the person row's label changed under this document's feet, and it is my doing.**

§08 quotes `PersonRow` as carrying "Director · 6 of 10 seen". The title module's §05 forbids job titles on a person surface, so the role table now carries what somebody did — Directed, Wrote, Acted in. `PeopleResults.jsx:187` builds its subtitle from `role.label`, so a search person row now reads **"Directed · 6 of 10 seen"**.

That leaves a real question for this module: **TP5** wants department and top job on a search row precisely so two Roger Deakinses can be told apart, and "Directed × 74" is a weaker disambiguator than "Camera · Director of Photography × 74". A search *row* is not a person *page*, and the rule may legitimately differ. Worth settling here rather than in code.

---

## E. Build risks the handover should name

| # | Risk |
|---|---|
| E1 | **"Word lists" is the wrong name, and it costs the module's best result.** The strip list contains two phrases — `all parts` and `in order`. I built rung 1 as a token filter first and franchise came out **20% empty instead of 0%**, because a word-split filter can never match a phrase. Everything else reproduced; this one thing did not. The highest-value hour in the module has a trap in how it is described, and §11 should say **phrase-aware**, with `avengers all parts` as the test case. |
| E2 | **FB2's chip-blame costs N extra requests, at the worst moment.** Dropping each chip in turn to find the culprit is three or four count-only calls, fired exactly when somebody is already looking at an empty screen. Worth a stated budget and a fallback for when it is slow. |
| E3 | **FQ18 needs an endpoint §02's table does not list.** An IMDb URL resolves through `/find/{imdb_id}?external_source=imdb_id`, which is a third engine alongside the two the section is built around. Small, but it is currently invisible in the handover. |
| E4 | **`Tile.jsx`'s `+` passes `verify` and should not.** Check 14 exists to stop an icon being a character, but its glyph ranges are non-ASCII, so `'+'` sails through — on every tile in the product. The design already flags the fix; the check should be widened at the same time so it cannot come back. |
| E5 | **FB16 says the library is in memory and therefore exact.** True today. It is exact because the library module pages past the PostgREST ceiling — a property that was a bug three weeks ago. Worth stating as a dependency rather than an assumption. |

---

## F. Open decisions — my answers differ on one

The document's seven open questions (FD-1 … FD-7) are all answered sensibly and I agree with six.

**FD-6, "should Hide what I've seen default to on?" — the document says off, and I agree, but for a different reason worth recording.** The stated reason is "a filter nobody set, quietly removing results, is the same sin as a vote floor nobody set". That is right. The stronger reason is C2: until the Load-more interaction is settled, a default-on filter can produce a page that fetches twenty and shows none. Off is also the safer default while that is unresolved.

**One question the document does not ask.** Presets are defined as facet bundles and every preset is a browse URL. Nothing says whether a preset's chips are **removable** in the way a hand-set chip is — FB12 implies yes ("taking one off is how somebody discovers what the preset meant"), which means a preset has no identity of its own once landed. That is a good answer; it should be stated as a rule rather than left to an example, because the alternative — a preset that stays named in the chip row — is the more obvious thing to build.

---

## What I would build first

Unchanged from §11: the normaliser. It is 63% → 44% empty by my measurement, with hit@5 flat on the graded set, and it is the only change here that can ship without a new screen. Build it phrase-aware, with the golden set as its test, and score the 70 unlabelled queries while the harness is open.
