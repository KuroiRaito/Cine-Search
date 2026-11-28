# Grooming — design ↔ production divergence

**Date:** 2026-11-28. Branch `claude/design-system-exploration-c125fd`, tooling at `c15b5ac`.
**Purpose:** answer "the anatomy is very different in production and in the designs" with specific, located differences, and turn them into decisions you can close.
**Method:** `npm run divergence`, which reads the module docs' own markup and `snapshots/anatomy.json` (written by `npm run snap` from the real app against frozen fixtures). Numbers below are measured, not estimated. Where a row is judgement rather than measurement it says so.

Read-only. No product code was changed to produce this document. The one CSS edit made during it — `.pbanner` to `2/1`, to prove the tool reads the real stylesheet — was reverted and `git diff` is clean.

---

## Verdict

**The design and the code agree about what the profile is made of, and disagree about where it goes.** This is better news than it looked. Almost nothing here is unbuilt or wrongly built; bands that the design puts behind a tab are being rendered on the first screen instead.

- **Profile's Overview carries four bands the design does not put there.** None of them is invented. **Score spread** is drawn on the **Stats tab** (P4). **Favourite films** and **Favourite people** are drawn behind the **Favourites tab** (P5, P6). The design's Overview has exactly one shelf — Favourite characters — with a *"See all 14 →"* link to the rest.
- The design has a law for precisely this, and it names the failure mode in your own words: *"The profile is tabbed, not one long scroll. This is the structural change the benchmark forced."* The thing tabs were introduced to prevent is what ships.
- **The banner is 3:1 at every width.** All **11** banners in the design are `.pbanner.tall`, which is **2:1**; the desktop drawing is **4:1**. The doc declares a 3:1 base rule and **never draws with it**. At 1280 that is a 400px banner — 44% of the window — and it is why profile is the only screen in the app that gets **taller** as the window gets wider (1441px → 1716px, where Person goes 3350 → 2105).
- **A 60px bar above the banner is in no drawing.** Production renders `page-head` holding one gear button; the design overlays its controls on the banner itself.
- **The banner centre-crops its artwork**, which `title` already found and fixed. One missing `object-position`, and the only outright defect in this document (B5).
- **Library matches**, band for band, but for one fixture-dependent difference.
- **Three modules cannot be checked at all.** `find`, `title` and `person` share **0–33%** of their band vocabulary with their own design docs. That is not a clean bill of health — the diff is blind there, and closing that gap is itself a work item.

Nothing here needs a schema change, a new endpoint, or new data. Every decision below is a layout decision.

---

## What the design drew

| module | phone | desktop | total | laws |
|---|---|---|---|---|
| find | 12 | 1 | 13 | 16 |
| library | 15 | 1 | 16 | 9 |
| profile | 19 | 2 | 21 | 15 |
| shell | 4 | 1 | 5 | 9 |
| title | 9 | 0 | 9 | 15 |
| | **59** | **5** | **64** | **64** |

**64 designed screens.** Earlier figures of 59 and 69 were both wrong: 59 counted phone only, and 69 counted each desktop drawing twice because `.desk` sits inside `.deskwrap`. 64 is from the parsed DOM.

`npm run snap` photographs **12** screens at three widths and two themes. So the designed state space is roughly five times what we photograph, and the gap is widest in profile — **21 drawn, 1 photographed.**

---

## A. Agreed as drawn — no decision needed

| Finding | Evidence |
|---|---|
| **Profile's band vocabulary is right.** `pbanner`, `pav-row`, `ptabs`, `sblock`, `shelf` all exist in the code under the names the design uses, in the order the design draws them. | `profile/profile@390` vs `P1`: the design's six bands all present, in sequence, zero missing. |
| **The stat block's internals match.** | Production `sblock` children are `sblock-h · snums · dbar · dlegend` — the same four the design draws. |
| **The tab strip is right.** Four tabs, Library last. | Production `ptabs` holds four `ptab`; `P1` draws `Overview · Favourites · Stats · Library`. |
| **Library's anatomy matches.** | `library/library@390` vs `L1`: `page-head · lbar · chips · grp`, one fixture-dependent band aside (the design draws a loading shelf where our fixture has a second group). |
| **The Favourites tab exists and is built.** | `.fgrid` with its 5-column rule at ≥600px, matching `P5`/`P6`. |

**Implication for B2:** the destination for the two extra shelves already exists and is already built. This is a move, not a build.

---

## B. Needs your decision

### B1. The banner ratio — the design wants it *taller* on phone and *shorter* on desktop

Three numbers in three places, which is why nobody caught it:

| | ratio | at 390 | at 1280 (1200 content) |
|---|---|---|---|
| design, all 11 phone drawings (`.pbanner.tall`) | **2:1** | **195px** | — |
| design, desktop drawing `D1` | **4:1** | — | **300px** |
| **production `.pbanner`, every width** | **3:1** | **130px** | **400px** |

The design's own warning note argues the case: *"The banner is 4:1 here, not 2:1. A 2:1 banner at 1120 wide is 560px tall — half the window spent on decoration before a single number."* The code shipped one middle value and gets neither end right.

**This is not a pure win and should not be groomed as one.** Implementing the design makes the phone banner **65px taller**, not shorter. The desktop banner gets **100px shorter**.

**The code already concedes half of this.** `profile.css:145` reads:

> *"3:1 on a phone: taller eats the fold. **4:1 from medium up: wider becomes a letterbox.** The banner is furniture, not content."*

So the two halves are not the same question:

- **Desktop 4:1 is not contested by anyone.** The design draws it, and the code's own comment states it as the intent. There is no media query, so the comment describes a decision the stylesheet never carried out. This is an unimplemented intent, not a disagreement.
- **Phone 2:1 is genuinely contested.** The design draws 2:1 on all eleven phone screens; the code comment argues 3:1 because *"taller eats the fold"*. Two considered positions.

**Decision:** desktop 4:1 needs only a yes. For phone — 2:1 as drawn, or 3:1 as the code argues, with the doc updated to match?

> My recommendation: **implement as drawn.** The phone is where the banner does its job — it is the only place the name sits on it — and desktop is where it is pure cost. But the phone half is a visible change to a screen you look at daily, so it is your call, not a correctness fix.

### B2. Overview carries four bands the design puts elsewhere

Measured, `profile/profile@390` against `P1`:

```
+page-head  pbanner  pav-row  ptabs  sblock  sblock  +sblock  shelf  +shelf  +shelf
```

Band by band:

| extra band | where the design puts it | law |
|---|---|---|
| `page-head` (60px, one gear button) | nowhere — controls overlay the banner | — |
| third `sblock` (**Score spread**) | **Stats tab**, `P4` | — |
| `shelf` (**Favourite films**) | **Favourites tab**, `P5`/`P6` | *"Eight, and the cap is the feature."* |
| `shelf` (**Favourite people**) | **Favourites tab**, `P5`/`P6` | *"Characters is the shelf people fill most… the layout buries them."* |

The design's Overview keeps **one** shelf — Favourite characters — and links out with *"See all 14 →"*. That choice is argued in a law: characters are *"the emotional centre of one of these pages"*, and the other shelves are what bury them.

**Decision, in three parts:**

1. **Score spread** → move to the Stats tab as drawn, or keep on Overview?
2. **Favourite films and people** → move behind the Favourites tab as drawn, leaving characters plus a "See all" link?
3. **The 60px gear bar** → overlay the gear on the banner as drawn, or keep the bar?

> My recommendation: **all three as drawn.** Taken together they remove four bands and ~60px of chrome from the first screen, and none of it is deleted — it moves to a tab that already exists and is already built. This is the single change that most directly answers "it is very cluttered", and it is the cheapest of the three items here.

### B3. Profile has no desktop layout at all

`profile.css` contains **one** media query. It sets `.fgrid` to five columns and fixes `.frail .fcard` width — both on the **Favourites tab**. The Overview has no desktop rules whatsoever, so it is the phone column stretched to 1120px:

- Films card: **1120px wide holding 154px of text.**
- Score spread: full-width card for one sentence.
- Favourite rails: **7–13% occupied.**

The design has a dedicated desktop section (`D1`, drawn at 1120×700) which says *"the columns simply get wider"* — but `D1` is drawn with inline styles on bare `<div>`s, so **the diff cannot read it** and I cannot tell you mechanically how far production is from it. What I can tell you is measured: profile is the only screen that grows when the window does.

**Decision:** does desktop Overview get a real layout this cycle, or after B1/B2 land and we re-measure?

> My recommendation: **after.** 270px of the 275px growth is the banner (B1), and B2 removes four bands. Fix those two, re-measure, and the remaining desktop problem will be a much smaller and better-understood one. Designing a desktop grid now means designing against numbers that are about to change.

### B4. Three modules cannot be checked

| screen | shared band vocabulary |
|---|---|
| `title/film` vs `TM1` | 33% |
| `title/series` vs `TV3` | 22% |
| `search/results` vs `FQ3` | 20% |
| `discover/home` vs `FD3` | 25% |
| `person/director` vs `TP1` | **0%** |

The sequences may well be identical in meaning — `find`'s `fgrid` and production's `grid results` are plainly the same band — but they are spelled differently, so a name diff reports a rewrite and is useless. The tool refuses these rows rather than printing seven findings you cannot trust.

Two desktop drawings (`profile D1`, `library D1`) are refused for the other reason: they are built from inline styles and have no band names at all.

**Decision:** is closing this vocabulary gap worth a work package? It buys machine-checkable anatomy on three of five modules, and it is the difference between this diff covering 2 screens and covering 7.

> My recommendation: **yes, but last, and as renaming in the docs rather than in the code.** The code's names are load-bearing and under test; the docs' are not. Cheaper and far less risky to make the drawings speak the code's language than the reverse.

### B5. ~~The banner centre-crops~~ — **withdrawn, 2026-11-28. My measurement did not support it.**

Approved by the owner, then not built, because the measurement I promised instead of copying `title`'s 38% came back against the premise. Recorded in full rather than quietly dropped.

**What I claimed:** `.pbanner-art` sets `object-fit: cover` with no `object-position`, so it centre-crops a 16:9 backdrop and cuts faces, exactly as `title.css:23` describes and fixes with `object-position: center 38%`.

**What I measured.** 60 real TMDB backdrops from `snapshots/tmdb-fixtures.json.gz`, drawn to canvas and scored by row-wise edge energy — flat sky and bokeh score near zero, faces and horizons score high. The vertical centroid of that energy:

| | |
|---|---|
| mean | **48.5%** |
| median | **49.1%** |
| p10 / p90 | 40.8% / 55.4% |

Detail sits **dead centre**, on a broad plateau from roughly 20% to 70% of height. The claim that *"subjects sit above the midline far more often than below it"* is not visible in this sample, so an upward bias has nothing to recover.

**And the geometry argument was built on the wrong scrim.** I read the *design doc's* scrim — `linear-gradient(to top, var(--bg), transparent 62%)`, which hides the bottom 62% and leaves a legible top 38%. **Production's scrim is not that**, and `profile.css:150` says why: fading to `--bg` made a white name vanish in light mode, so it is a partial dark wash instead, `rgba(4,6,12,.78)` to transparent. The artwork is visible across the whole band. There is no "legible top 38%" to protect, which was most of my case.

If anything the direction reverses: production's wash is heaviest at the bottom, so lifting detail into the clearer top would want `object-position` **below** 50%, not above. I am not shipping a number off that chain of reasoning — it is the same arguing-about-CSS that this document exists to replace.

**Why `title` is still right:** its hero crops to a fixed height with no equivalent wash, and its claim is about *faces*, which edge energy cannot see. My proxy fails to confirm `title`'s reasoning; it does not refute it.

**Decision:** park, or look at twenty real banners by eye and set the figure from that? There is no measurement I can take here that settles it — the question is about faces, and I do not have a face detector.

> My recommendation: **park it.** It is cosmetic, the evidence is against the fix as specified, and B1 changes this band's geometry anyway. Re-open after B1 lands, against the ratio that actually ships.

---

---

## C. Found by the tool, and the code is right

Worth recording so nobody "fixes" it later.

The shapes lane flags `tbd 16:9` on all five title drawings against **no `aspect-ratio` in the CSS**. **The code is correct.** 16:9 is the backdrop *asset's* ratio, not the band's; `.hero` is a fixed height that deliberately crops it, with the reasoning already beside the declaration:

> *"A 16:9 backdrop cropped into a 4:1 desktop hero loses most of its height, and centring that crop cuts faces in half — subjects sit above the midline far more often than below it."*

This is why `npm run divergence` **always exits 0** and gates nothing. A script that failed the build on a disagreement would decide, every time, that the drawing wins. It does not always.

---

## D. What this does not cover

Stated plainly so the net is not assumed to be wider than it is.

- **2 of 9 comparisons are live;** 7 are refused (B4). Profile and library only.
- **The shapes lane was reading half the stylesheet until 2026-11-28.** Its rule scanner could not look inside `@media`, and dropped the first rule of every block. 7 declarations found before the fix, 14 after. Any conclusion drawn from an earlier run should be re-checked.
- **One theme, one width per screen.** Dark, and the width named in the match table. Dark and light render the same boxes, so the theme costs nothing — but **colour is not compared at all**, in either direction.
- **The match table is a judgement call.** Which drawing is a given screenshot's counterpart (`P1` is the filled overview, `P3` is the same screen loading) cannot be inferred and is declared by hand in `scripts/divergence.mjs`. Wrong entries produce wrong findings.
- **The 64 laws are not checked.** They are counted and quoted. Most are product rules no stylesheet can express.
- **Fixture artifacts, not product faults:** broken poster images (`/snap.jpg` is not a real TMDB path) and a single favourite film. A real account has more favourites, so **the real screen is more crowded than the one measured here**, not less.
- **`entry` and `profile/settings` have no designed counterpart** — the welcome module has no `-module.html`, and settings is drawn as part of shell.

---

## E. Suggested build order

One PR each. B2 first because it is the cheapest, the most visible, and it changes the numbers the others are judged against.

1. **WP-D1 — Overview carries what the design puts on it** (B2). Move Score spread to the Stats tab; move Favourite films and people behind the Favourites tab, leaving characters plus *"See all n →"*; overlay the gear on the banner and drop `page-head` from profile. **Four bands and ~60px off the first screen; nothing deleted.** Markup changes, so it is a development lane PR, not a design one. Re-run `npm run snap` and expect profile's fingerprints to move and nothing else's.
2. **WP-D2 — The banner gets its two ratios and stops cutting faces** (B1 + B5). `.pbanner` to 2:1, with 4:1 above the desktop breakpoint; `.pbanner-art` gets an upward crop bias, measured against real banners rather than copied from `title`'s 38%. Two CSS rules plus one media query. Design lane. Expect profile geometry to move at all three widths.
3. **WP-D3 — Re-measure, then decide desktop** (B3). After 1 and 2, re-run `npm run divergence` and the heights table. Desktop Overview is groomed against the new numbers, not these.
4. **WP-D4 — Close the vocabulary gap** (B4). Rename bands in `find`, `title` and `person`'s docs to the code's names. Docs only, no code. Raises the diff from 2 live comparisons to 7.

**Gate for every one of them:** `npm run check` green (24 checks), and `npm run divergence` showing the specific row closed — not just "looks right".

---

## F. Still open from earlier grooming

Carried forward, unchanged, not addressed by anything above:

- `.sw` is still 36px against the 44px touch floor (C14).
- Four of six `-9` status tones are under 4.5:1 in light mode. Palette call, yours.
- No scroll affordance on `.chips` or `.rail`.
- `docs/design-system.html` has drifted from the published artifact on the `want` tones and the font stacks.

---

## Owner decisions

**2026-11-28.** B2 closed — *do it as drawn* — and shipped as WP-D1 (`35649bd`), minus B2.3, which is **withdrawn**: the design settles the header control in prose (D3, "Settled") even though no drawing shows it. Profile is 1441px → **947px** at 390 and 1716px → **1222px** at 1280. The anatomy row went 4 extra → 1, and that one is `page-head`, which is correct.

**B5 approved, then withdrawn by measurement** — see above. Nothing shipped.

**B1 desktop half closed and shipped** (`32a49f4`): `.pbanner` is 4:1 from 600 up, in the media query profile.css already had. Banner 130 / 225 / 300px at 390 / 900 / 1280.

**It did not do what I said it would.** I have been calling profile "the only screen that gets taller as the window gets wider". **It still is** — +175px across the range, down from +275. A ratio with no ceiling grows with width whatever the ratio is; 4:1 only slows it. Stopping it needs a `max-height` or a real desktop layout, so **B3 now owns this**, and it is no longer optional-feeling.

Profile across the three widths, after both changes: **947 / 1018 / 1122px** (was 1441 / — / 1716).

Still open: **B1 phone half** (design draws 2:1 on eleven screens, `.pbanner`'s comment argues 3:1 because "taller eats the fold"), **B3** — now carrying the growth problem — and **B4**.
