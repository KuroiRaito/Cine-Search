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

**Read the eight bullets above as the report of the morning of 2026-11-28.** Four of them are already history: B2 shipped, B5 was **withdrawn by its own measurement**, and B1's desktop half and **B3** both shipped the same day. So Overview now carries one shelf, not four extra bands; **profile no longer gets taller as the window gets wider** — it is 922px at 1280, 1440 *and* 1600; and the 60px bar is deliberate after all (D3, marked *Settled* in prose, which no drawing shows). *Owner decisions* at the foot is the current state.

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

#### Closed, 2026-11-28 — *keep 3:1, and the drawings were the outlier*

Decided **3:1 on the phone**, and the reason turned out to be stronger than
the one I argued it on. I framed this as "two considered positions". It is
not. **This document's own design doc already said 3:1 twice:**

| where | says |
|---|---|
| `docs/profile-module.html:228` — the base rule | `.pbanner{aspect-ratio:3/1}` |
| `docs/profile-module.html:564` — the anatomy table | Banner, compact: **"3:1, full bleed"** |
| the eleven phone drawings | `class="pbanner tall"`, and `.tall{aspect-ratio:2/1}` |

So the design document declared 3:1 in its base rule, specified 3:1 in its
anatomy table, and then drew every phone screen with a modifier that
overrode both. Two statements against one modifier. **The product has always
matched the specification; the drawings were the thing that disagreed.**

`.tall` is removed from all eleven drawings and the rule deleted, so the
document now shows the ratio it specifies. No product code changed — `.pbanner`
is still 3:1 base, 4:1 from 600, capped at 300. The desktop warn note was
re-stated against 3:1 rather than 2:1, since 2:1 is no longer drawn anywhere.

**`npm run divergence` now reports `drawn pbanner 3:1 phone 11 screens — CSS
agrees (base)`,** where it had reported a 2:1 disagreement. That row was the
first bullet of this document's own verdict.

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

- Films card: **1120px wide holding 154px of text.** *(The 154px was an artifact of this branch's own fixture — corrected below. The 1120px was not, and at 1600 it is 1520px.)*
- Score spread: full-width card for one sentence.
- Favourite rails: **7–13% occupied.**

The design has a dedicated desktop section (`D1`, drawn at 1120×700) which says *"the columns simply get wider"* — but `D1` is drawn with inline styles on bare `<div>`s, so **the diff cannot read it** and I cannot tell you mechanically how far production is from it. What I can tell you is measured: profile is the only screen that grows when the window does.

**Decision:** does desktop Overview get a real layout this cycle, or after B1/B2 land and we re-measure?

> My recommendation: **after.** 270px of the 275px growth is the banner (B1), and B2 removes four bands. Fix those two, re-measure, and the remaining desktop problem will be a much smaller and better-understood one. Designing a desktop grid now means designing against numbers that are about to change.

#### Closed and shipped, 2026-11-28 — *do it now*

Built as D1 states it, which is a law and not a drawing:

> The two-column split is the only structural change from mobile. Stats go left in a fixed 320px rail, favourites go right and fill. Nothing is added and nothing is hidden — a profile that needed a desktop-only section would be a profile that does not fit on a phone.

Three changes, and each one is answerable with a number.

> **Numbers corrected 2026-11-28 after merging main** (`1d5eb23`). Main had independently rebuilt the profile fixture, better, and its version won. Everything below is re-measured against it; the earlier figures were taken against a fixture that no longer exists. The layout conclusions did not move. One piece of *evidence* did, and is replaced — see the note under the table.

| | before | after |
|---|---|---|
| Films card at 900 | **852px** wide | **440px** |
| Films card at 1280 | 1120px wide | **320px** |
| Films card at 1600 | **1520px** wide | **320px** |
| page at 1280 | 1122px | **922px** |
| page at 1440 | 1122px | **922px** |
| page at 1600 | 1122px | **922px** |

**What the card's width actually costs, said without a fixture in it.** `.sblock-h` is `justify-content: space-between`: the block's name sits at the left edge and its qualifier — *"at least"*, when series minutes are still arriving season by season — sits at the right. At 1600 uncapped those two were **1494px apart**. That is the same defect `.sect.taste-head` already has a comment about — *"at 1280 it is what stops 'Score ▾' from sitting 800px away from the heading it modifies"* — and the same answer. At 320px they are 294px apart.

*(The first version of this table said the card held "154px of text" in a 1120px box. That was true only of the fixture this branch wrote: its Films block had `partial: false`, so the right-hand label was absent and there was nothing out at the edge to measure. Main's fixture derives `partial` from the rows, the label is there, and the measurement reads 98% at every width. The defect and the fix are unchanged; the number was fixture-shaped.)*

1. **The two-column grid at 1120+.** `.pcols`, 320px and the rest, the shelf spanning both rows beside the medium blocks. This needed the one thing CSS could not supply: the Overview bands are direct children of `.page`, which belongs to the shell, so there was nothing for a grid to be. **One wrapper element in `Profile.jsx`** — development lane, flagged, and inert below 1120.
2. **A cap on the card at 600–1119.** The medium band is undrawn, so it takes the answer the Stats tab already gives: `.tastecard`, `.stiles` and `.sect.taste-head` all stop at 440px. The Films block had no stop, which is why its name and its qualifier sat 826px apart at 900 and 1494px apart at 1600.
3. **A ceiling on the banner at 300px.** This is the growth problem, and it was worse than the report said, because **`npm run snap` stops at 1280 and the shell does not.** `--shell-max` is 1200 at expanded and **1600 at wide**, so a 4:1 banner reaches **400px on a 1600 window** — 44% of a 900px viewport, which is the objection the design itself makes against 2:1 at 1120, arrived at from the other side. 300px is where the title page's hero stops (`--hero-h`); the hero is its page's subject and this is furniture, so the banner does not get to be taller.

**Profile has stopped growing with width:** 922px at 1280, 1440 and 1600. The sentence I have been repeating all day is now false, which was the point of the item.

**Each of the three was proved by removing it and watching the number come back**, and all three proofs were re-run on the merged tree — ceiling out → **982 / 1022** at 1440 / 1600; grid out → **1122 flat**; cap out → an **852px** card at 900. 24 checks green. Of the 72 recorded screens **6 moved** — profile's Overview, at both themes and all three widths — and the other 66, settings included, are byte-identical. At 390 and 900 the page height and every band's size are unchanged; the fingerprint moved because the DOM has one more element in it.

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

#### Partly closed, 2026-11-28 — *and the premise was wrong*

**Live comparisons: 2 → 3.** `person/director` now compares. The other four
cannot be closed by renaming, and that is the finding.

I recommended this as "renaming bands in the docs to the code's names", a
cheap and safe docs-only change. **Measured against both markups, most of the
gap is not spelling.** The two sides decompose these screens differently, and
no rename expresses that.

**What closed.** Three genuine synonyms on the person page, each checked
against both markups rather than inferred from the name:

| design | code | the same band because |
|---|---|---|
| `phdr` | `pintro` | photo, name, one-line description as a flex row; `.phdr .pimg/.pbd` against `.pintro > .phead` |
| `pstrip` | `pstats` | both hold exactly Credits · You have seen · Active, in that order |
| `pfilt` | `rolesw` | the role filter; All / Directed / Wrote against All / `<role>` |

Overlap 0% → 50%, which crosses the trust threshold, and the row now says
something real:

```
person/director@390  TP1  person · director   3 missing, 6 extra
    -hero +page-head pintro -tsec pstats rolesw -tsec +collectbar +grid +pad +collectbar +grid
```

**`-hero` is a finding, not noise:** the design opens the person page on a
backdrop and the product opens it on `page-head`. `phero` was deliberately
left aliased to `hero` rather than re-pointed at `page-head` — making that row
go green would have deleted the finding.

**Why the other four cannot be renamed.** Three distinct causes, all measured:

1. **One designed band is built as two siblings.** `discover/home` vs `FD3`:
   the design draws `shelf`; `src/shared/ui/Rail.jsx` returns a fragment of
   `<div className="section">` **and** `<div className="rail">` as siblings.
   One design name against two production names is a 1:N correspondence, and
   `ALIAS` is 1:1 by construction. Aliasing `shelf`→`section` would make the
   row read 100% and report every `rail` as *extra*, which is false.
2. **Different decomposition, not different words.** `title/film` and
   `title/series`: the design draws a linear column — backdrop, head,
   primary, secondaries. The code builds `hero` + `tgrid(tposter, thead,
   tbody, tside)`, and the design's `tprim`/`tsec` sections live *inside*
   `tbody` as `tside-inline`, `trailer`, `tbelow`. There is no name to rename
   them to.
3. **The match table, not the vocabulary.** `search/results` is paired with
   `FQ3`, which draws the *person-intent* screen — query, person card,
   "Directed by", their films. The photographed screen is `?q=zimmer`, which
   renders ordinary results plus a People section. **These are not the same
   screen,** so the honest fix is the match entry or a new drawing, not the
   band names. Section D already warns the table is a judgement call.

**A fourth cause, worth its own item.** The band name is "the first class",
and production sometimes writes a layout utility first: `<div className="pad
searchbox-wrap">` is read as `pad`, not `searchbox-wrap`. That is the reader
picking the wrong word, and it is why `frow` has nothing to map to. Fixing it
means teaching `snap` to skip known utilities when naming a band — which
rewrites `snapshots/anatomy.json` across every module, so it is its own change
with its own diff, not a line in this one.

**Not taken: `fgrid` → `grid`.** Honest for search (both are the results
grid) and it would move `FQ3` from 20% to 40% — but it crosses a module
boundary. `.fgrid` is *also* profile's favourites grid, and `ALIAS` is global,
so the entry would quietly equate two different bands the day profile grows a
`grid`. A number that does not change comparability is not worth that.

**Re-scoped.** B4 is no longer "rename the docs". It is three separate
pieces: a 1:N band mechanism (`shelf`), a band-naming fix in `snap`
(`pad searchbox-wrap`), and a match-table correction or a new drawing for
search. Each is worth doing; none is a rename.

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

### B6. The tall screen is now 900, not 1280

**Found by building B3.** Profile is **923 / 1018 / 922 / 922 / 922** at 390 / 900 / 1280 / 1440 / 1600. The peak has moved off desktop and onto the band the design system never drew: at 900 the banner is already 225px and the columns are still stacked, so it carries desktop's banner and the phone's layout at once.

Extending the split downward is not one line. At 600 the right column would be `600 − 48 − 320 − 32 = 200px`, which holds two and a half poster tiles — so it needs **a third breakpoint, around 840, that no drawing contains.**

**Decision:** invent that breakpoint, or leave 900 as the tall one?

> My recommendation: **leave it.** 1018 is 95px over the phone and every one of them is banner; the band has no drawing to be checked against, and inventing a breakpoint to beat a number nobody has complained about is how undrawn bands get a second layout nobody maintains. Worth revisiting only if B1's phone half lands at 2:1, which puts 900 further out.

#### Closed, 2026-11-28 — *decided and not doing*

**Parked deliberately, not forgotten.** The condition the recommendation named
has been settled the other way: B1's phone half landed at **3:1**, not 2:1, so
900 does not move further out and there is no re-measurement owed.

Re-measured on the shipped tree with a full eight-card shelf: **939 / 959 /
1034 / 906 / 926 / 926 / 926** at 390 / 600 / 900 / 1120 / 1280 / 1440 / 1600.
The peak is still 900, still **95px over the phone**, and still all banner —
at 900 the banner is 225px and the columns are stacked.

Closing it needs the two-column split to extend below 1120, and at 600 the
right-hand column would be `600 − 48 − 320 − 32 = 200px`, which holds two and
a half poster tiles. That means **a third breakpoint around 840 that no
drawing contains**. Inventing one to beat a number nobody has complained
about is how an undrawn band acquires a second layout nobody maintains.

Re-open only if the medium band gets drawn.

### B7. The desktop shelf disagrees with the shipped one, three ways

D1's right column draws **two** shelves (characters *and* films), as **6-across grids**, cards about **108px**, each with *"See all n →"*. Production ships **one** shelf as an **80px rail**. Three separable questions:

| | drawn | shipped | what argues for the shipped one |
|---|---|---|---|
| how many shelves | two | one | D1's own note: *"nothing is added"* relative to mobile, and P1 draws one |
| grid or rail | grid of 6 | scrolling rail | *"Never a whole number of tiles: the partial card is the only thing telling you the rail scrolls."* A grid of six holding fourteen either wraps to three rows or hides eight cards with no affordance |
| tile width | ~108px | 80px | nothing — this one is just undecided |

The tile is the only one of the three I would change, and it has a second reason: **`.frail` is the one rail in the product that ignores `--rail-tile`**, which is the exact mistake `title.css:446` records itself fixing. But `--rail-tile` is 190px at expanded, and in a 768px column that leaves a **16px sliver** of the fourth card — a partial nobody reads as partial, so the law would be satisfied on paper and broken in fact. Measured in that column: 80px shows 8 tiles and 80% of a 9th; **108px shows 6 and 67% of a 7th** — the drawn density, with a partial you can see; 190px shows 3 and a sliver.

**Decision:** leave the shelf as shipped, or take the drawn 108px at 1120+?

> My recommendation: **take 108px at expanded, and leave the other two alone.** One declaration inside the block B3 just added, design lane, and it is the drawn number rather than one I invented. Keep one shelf and keep the rail — on both of those the product's own laws beat the drawing, and the drawing predates the tabs.
>
> While that file is open: the `600px` block restates `.frail .fcard { width: var(--space-80) }`, which is exactly what the base rule already says. It has never changed anything. Worth deleting so the next reader does not go looking for what it does.

#### Withdrawn, 2026-11-28 — *the measurement came back against it*

Approved by the owner, then not built. **Both numbers this item rested on were
artifacts of a sparse fixture**, and the shelf's own cap makes one of them
impossible.

`PREVIEW = 8` (`src/modules/profile/favourites.js:30`) — the design's law
*"Eight, and the cap is the feature"*, in code. **A shelf never holds more
than eight cards, so there is never a ninth tile.** "80px shows 8 tiles and
80% of a 9th" was capacity arithmetic against a rail that cannot be asked for
a ninth. And "Favourite rails: 7–13% occupied" was measured against a fixture
holding *one* favourite film — section D says as much about that fixture and
the recommendation was built on it anyway.

Re-measured with a full eight-card shelf, in the real column:

| tile | 1120 — 688px column | 1280 — 768px column | 1440 / 1600 |
|---|---|---|---|
| **80px, shipped** | scrolls 8px, partial 72px / 90% | **all 8 fit, no scroll**, 91% occupied | all 8 fit |
| **108px, drawn** | scrolls 232px, **partial 0px** | scrolls 152px, partial 72px / 67% | all 8 fit |

**108px breaks the rail law at exactly 1120** — *"Never a whole number of
tiles: the partial card is the only thing telling you the rail scrolls."* The
688px column holds `6 × 108 + 5 × 8 = 688` precisely, so six tiles fill it to
the pixel, the rail still has 232px to scroll, and nothing says so. The dead
band is viewport 1120–1132, which includes **the width D1 is drawn at**.

And the emptiness 108px was meant to fix is not there. At 1280 eight 80px
cards occupy 696px of a 768px column — **91%** — and do not scroll at all,
which is what a cap of eight is *for*. 108px comes from D1's **grid**, where
six is a row and the remainder sits behind *"See all 14 →"*. This document
already decided, correctly, to keep the rail over the grid. Taking the grid's
tile size into a rail imports half a mechanism.

**Kept from this item:** the dead `600px` restatement of
`.frail .fcard { width: var(--space-80) }` is deleted. It duplicated the base
rule verbatim and had never changed a pixel.

Nothing else shipped. The shelf stays one rail of 80px tiles.

### B8. The identity band's expanded state is written down and unbuilt

`S2` says it in one line — *"Banner 4:1 at container width with `--radius-16`; shelves show more per row; identity sits beside the avatar"* — and D1 draws a **96px avatar lifted 48px over the banner**, with the name at `--text-display`. Production at expanded: a square-cornered full-bleed banner, a **48px** avatar with no lift, the name at `--text-title`.

Not built, because B3's measured defects were all in the Overview column and this band sits above the tabs, where it is shared by all three tabs. Changing it means touching `.pav-row`'s padding and the avatar's negative margin together, and that is its own change with its own before-and-after.

**Decision:** does the identity band get its expanded state?

> My recommendation: **yes, but as its own PR**, and after B1's phone half — the avatar lift is measured against the banner's bottom edge, so settling the phone ratio first means measuring it once.

#### Closed and shipped, 2026-11-28 — *and D1 cannot render its own overlap*

Built at 1120+, inert below it. Measured before and after, at seven widths:

| at 1120+ | before | after |
|---|---|---|
| avatar | 48px | **96px** |
| avatar against the banner | **−12px** (12px clear below it) | **+32px** (into it) |
| banner corner | 0 | **16px** (`--radius-16`) |
| name | 21px (`--text-title`) | **40px** (`--text-display`) |
| page height | 902 / 922 / 922 / 922 | **906 / 926 / 926 / 926** |

**Four pixels of page height**, at 1120 / 1280 / 1440 / 1600. At 390, 600 and
900 every number is unchanged, and `npm run snap` agrees: of the 72 recorded
screens **2 moved** — `profile/profile@1280`, dark and light — and the other
70 are byte-identical, settings and the phone included. Element count 118 →
118, because this is geometry and not markup.

**The thing worth keeping from building it.** Copying D1's declarations
produced an avatar that was *invisible*. `.pbanner` is `position: relative`;
`.pav-row` is static. A positioned box paints above every static in-flow
sibling whatever the DOM order says, so an avatar lifted into the banner is
lifted **behind** it, and the first render came back with a circle sliced flat
along the banner's bottom edge.

**D1 has the same defect, and has always had it.** Measured in the design
document itself — `elementFromPoint` at the centre of D1's own overlap returns
the banner's scrim, not the avatar:

```
overlapPx: 13.6 (at 0.62 scale → 22px)   avatarPosition: static
hit: DIV [position:absolute;inset:0;background:linear-gradie…]
avatarOnTop: false   bannerPosition: relative
```

So the 48px lift the anatomy table specifies has **never once been visible in
the drawing that specifies it**, which is why nobody noticed the declaration
was inert. The product builds the intent instead, with one declaration D1 does
not have: `.pav-row { position: relative }`.

**Two numbers that are the drawing's, not the table's.** The table says
*"96px, overlaps by 48"*. D1's declarations — `padding: 16px 40px 0` with
`margin-top: -48px` — produce **22px** of overlap in the drawing and **32px**
here. 48 is prose about a declaration; 32 is what the declaration draws, and
the drawing is the half with numbers in it.

**One thing the drawing could not have told us.** At `--text-display` the name
is 44px tall sitting 12px off the banner's bottom edge, and the avatar's top
lands 32px above that edge — so the circle and the name's lower-left shared
**20px of the same column**. D1 has the identical collision at 6px and cannot
see it, because its avatar is behind the banner. `.pname` moves to
`bottom: var(--space-40)`, measured at **8px of clearance**.

**Not taken, and recorded as B10:** the phone avatar, which the same table
says is 64px overlapping by 32 and which ships at 48px with no overlap at all.
That is a visible change to the phone screen and it was not what was approved.

Tier of §6.1: **4 — visible.** The band is measured at seven widths and
photographed at three, but nothing *prevents* the next lifted element from
landing behind a positioned sibling. The general gate for that is a
paint-order check, and it does not exist.


### B9. The banner stopped short of the page, and `snap` could not see it

**Found while measuring for B8. Shipped the same day, with a gate.**

B3 gave the banner a 300px ceiling and wrote the trade down beside it:

> Past a 1200 container the band is therefore wider than 4:1. That is the
> trade: a letterbox that stays put, against a shape that keeps its ratio by
> taking another 100px of the fold.

**That is not what the declaration did.** `aspect-ratio` is not a one-way
street from width to height. When `max-height` clamps the constrained axis and
the other axis is `auto`, CSS re-resolves the *other* axis through the ratio
rather than letting the box stop being the ratio. So the banner stayed exactly
4:1 and got **narrower than its container**:

| viewport | container | banner, before | blank page beside it |
|---|---|---|---|
| 1280 | 1200 | 1200 × 300 | 0 |
| 1440 | 1440 | **1200 × 300** | **240px** |
| 1600 | 1600 | **1200 × 300** | **400px** |

A full-bleed band leaving 400px of empty page to its right. The fix is one
declaration — `width: 100%` gives the ratio a definite width to work from, so
the clamp falls on the height alone — and the band is now **1440 × 300** and
**1600 × 300**, ratios 4.8 and 5.33. The letterbox the comment always claimed.

**Nothing in the repo was looking.** `npm run snap` stops at 1280, where the
container is 1200 and the defect cannot appear. Section D said this about B3's
400px banner; here is the second instance of the same blind spot, and the
first one that shipped to `main`.

**The class.** *A min/max constraint on one axis of a box with `aspect-ratio`
silently resizes the other axis.* A wider measurement harness would have
caught this instance. The hazard is visible in the declarations without
rendering anything, so the gate is static instead.

**`npm run verify` check 25 — "A ratio with one axis constrained has the other
definite".** It gathers declarations per selector *across files and media
blocks*, because the two halves are routinely written apart — `.pbanner`
declares its ratio in the base rule and its ceiling inside `@media`, and a
check judging one rule at a time would have seen neither. Proved both ways:

```
removing `width: 100%`  →  FAIL  A ratio with one axis constrained has the other definite
   src/modules/profile/profile.css:382: `.pbanner` sets `aspect-ratio` and `max-height`,
   but no `width` -- when the clamp bites, the ratio re-resolves width and the box
   shrinks away from its container instead of changing shape.

blinding its rule walker  →  FAIL  only 0 selector(s) declaring `aspect-ratio` found
   -- too few, so this check has stopped finding the boxes it judges
```

The second is C7.7: the check cannot pass by finding nothing. 25 of 25 green
on the shipped tree, with no other selector in the product tripping it.

Tier of §6.1: **2 — build-time.**

### B10. The phone avatar is 64px overlapping by 32, and ships at 48px flat

**Found while building B8. Not built — it is a visible change to the phone.**

The same anatomy table that specifies B8's expanded avatar specifies the
compact one, and the product matches neither half:

| | design (`docs/profile-module.html:565`) | production |
|---|---|---|
| compact | **64px, overlaps by 32** | 48px, 12px *below* the banner |
| expanded | 96px, overlaps by 48 | 96px, overlaps by 32 — **shipped, B8** |

Both numbers are on the spacing scale (`--space-64`, `--space-32`), so this is
cheap to build. It is also the rare divergence that would make the phone page
**shorter**: an avatar that eats 32px into the banner reclaims the 12px it
currently sits below it, plus the overlap.

Two smaller things in the same band, both recorded rather than fixed: the
table names a **3px** ring where `--border-focus` is 2px, and D1 puts `.bedit`
at the gutter where production puts it at 8px.

**Decision:** does the phone avatar get its specified size and overlap?

> My recommendation: **yes.** It is two declarations on the scale, it matches
> the document's own table, and unlike most of this list it takes height off
> the first screen rather than adding it. But it changes the screen you look
> at daily, so it is your call — the same call as B1's phone half, and I would
> measure the page height before and after exactly as that one asked for.

#### Closed and shipped, 2026-11-28 — *and the document had already written it*

**The phone page is 8px shorter**, which is the rare divergence that costs
nothing to close:

| | before | after |
|---|---|---|
| avatar | 48px | **64px** |
| avatar against the banner | −12px (below it) | **+32px** (into it) |
| page at 390 | 939 | **931** |
| page at 600 | 959 | **951** |
| page at 900 | 1034 | **1026** |
| expanded, 1120 / 1280 / 1440 / 1600 | 906 / 926 / 926 / 926 | **unchanged** |

Of 72 recorded screens **4 moved** — `profile/profile@390` and `@900`, both
themes. `@1280` did not, so B8 is untouched. 118 elements before and after.

**This was not a judgement call after all.** `docs/profile-module.html`
contains a complete 64px layout that matches its own anatomy table exactly,
and no drawing uses it:

| statement | says |
|---|---|
| anatomy table, §02 | 64px, overlaps by 32 |
| `.pav` + `.phead`, lines 236–238 | `--space-64`, `margin-top: calc(var(--space-32) * -1)`, **and `position: relative`** |
| the nine phone drawings | `.pav-sm` — 48px, 2px ring, no lift |
| production, before this | 48px, 2px ring, no lift |

`.pav` and `.phead` are referenced by **zero** drawings. So this is B1's shape
exactly — a rule and a table on one side, drawings quietly using a different
class on the other — and it resolves the same way, because the drawings are
the half with no reasoning attached. The product had been matching the
drawings.

**The margin is 32 + 12, not 32.** `.phead` lifts the whole header block and
carries no top padding, so `-32px` there overlaps by 32. `.pav-row` carries
12px of top padding so the handle is not flush against the artwork, and the
avatar has to come back through that as well to reach the same place.
Measured: **32px of overlap**, which is what the table states. The
alternative — dropping the row's padding to match `.phead` — moves the handle
and bio too, and this item is the avatar.

**It brought B8's collision with it, one band down.** The avatar now reaches
32px into the banner at the same left edge the name uses, and at
`--text-title` the name is 28px tall sitting 12px off the bottom — so the
circle and the name's lower-left shared **20px of one column**, and the name
won it, because `.pname` carries `z-index: 2` and the identity row does not.
`.pname` moves to `bottom: var(--space-40)` on the **base** rule, clearing the
avatar by 8px at every width; the expanded override B8 added is now redundant
and is gone. **The design never hits this**, because its phone layout stacks
the name *under* the avatar inside `.phead` where the product puts it on the
artwork — a difference worth knowing about and not worth closing, since the
name on the artwork is what makes the banner a nameplate.

**`position: relative` moved to the base `.pav-row`**, where the explanation
now lives. The design's own phone rules carry it and `D1` does not, which is
why `D1` cannot render its own overlap (B8).

**Not taken:** the 3px ring the same table names. `--border-focus` is 2px, 3px
is not on the scale, and a border token exists so that rings step together.

> **Revisited the same day, and taken — see B11.** The table says the expanded
> avatar *"overlaps by 48"* and B8 shipped 32, a decision taken against D1's own
> declarations. B10 is evidence that cuts the other way: every non-drawing
> rule in this document agrees with its table, and only the inline numbers in
> `D1` do not. That pattern held, the owner approved the change, and the
> expanded overlap is now 48. Building it found something B8 had not: the
> overlap was moving with the length of the bio.

Tier of §6.1: **4 — visible.** Measured at seven widths, photographed at
three. There is still no gate for a lifted element landing behind a
positioned sibling; that needs a paint-order check and none exists.

---

### B11. The expanded overlap is 48, not the 32 B8 shipped

B8 built the expanded identity band and took **32px** of overlap, from D1's
literal `margin-top: -48px` against a row with 16px of top padding. The
anatomy table in the same document says **48**. At the time that was one
drawing against one table, and B8 took the drawing.

B10 turned it into one drawing against everything else. Every non-drawing rule
in `docs/profile-module.html` has now been checked against the product, and
every one of them has agreed with its own anatomy table:

| statement | agrees with the table? |
|---|---|
| `.pbanner`'s base `aspect-ratio: 3/1` (B1) | yes — eleven drawings overrode it with `.tall` |
| `.pav` / `.phead`, 64px and `-32px` (B10) | yes — used by none of its nine drawings |
| **D1's inline `margin-top: -48px`** | **no** |

And `D1` is the one drawing that **cannot render its own overlap at all** —
its avatar is `position: static` under a `position: relative` banner, so the
lift it declares paints behind the scrim. Nobody has ever seen D1's geometry,
including whoever wrote it. It is the weakest statement in the document, and
it was the only one B8 had.

**Decision:** *do the 48px expanded overlap too.* Shipped.

#### Measured, before and after

Same fixture, same markup, the margin changed from `-(32+16)` to `-(48+16)`:

| at 1120+ | B8 shipped | now |
|---|---|---|
| avatar into the banner | 32px | **48px** |
| name-to-avatar clearance | 8px | **8px** (`.pname` raised with it) |
| identity row height | 64px | **56px** |
| page height | 906 / 926 / 926 / 926 | **900 / 918 / 918 / 918** |

At 390, 600 and 900 every number is unchanged — B10's phone band is untouched.
`npm run snap`: of the 72 recorded screens **2 moved**, `profile/profile@1280`
dark and light, and `geometry` moved with `hash`, so it is a real box change
and not a renamed class. Element count 118 → 118.

#### What building it actually found: `align-items: center` made the overlap depend on the bio

The first measurement came back **44px**, not 48, with the margin arithmetic
plainly correct. The cause was D1's `align-items: center`, which B8 had copied.
Under `center` the avatar's **margin box** is centred in the flex line, and the
line is as tall as the text beside it — so the overlap is a function of how much
the person wrote about themselves. Measured at 1280, same markup, only the bio
changed:

| | empty bio | four-line bio |
|---|---|---|
| `align-items: center` | 44px | **24px** |
| `align-items: flex-start` | 48px | **48px** |

**A 20px swing driven by profile content.** So `center` was never "4px out" —
it was a sliding value that happened to read 44 against a one-line fixture, and
the fixture B8 was measured against was exactly that one. `flex-start` makes the
overlap `padding + margin` and nothing else, which is why the 48 above is
derivable from two declarations rather than from a screenshot.

This is an instance of a class already named in `CLAUDE.md` §7 — *absent must
never become plausible* — wearing different clothes: not an absent value
coercing into a valid-looking one, but a **correct-looking measurement that was
an artifact of the fixture**. B7 was the same shape earlier the same day: "7–13%
occupied" came from a one-film shelf. Both were caught by changing the fixture
and measuring again.

**The named class this adds:** *a geometric relationship must not be expressed
through a value that something else can resize.* An overlap between two boxes
has to be stated as a relationship between those two boxes.

Tier of §6.1: **4 — visible.** The number is measured at seven widths and
photographed at three, and the counterfactual was run rather than reasoned
about — `center` was reinstated and watched to move (§6.3). No gate prevents
the next geometric constant from being routed through a flex alignment; that
needs a check that re-measures a declared relationship under two fixtures, and
none exists. It is the same missing harness D (**nothing above 1280**) and B8
(**no paint-order check**) already name: there is no *second-fixture* pass in
this repo at all.

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
- **Nothing measured here goes above 1280, and the shell does.** `npm run snap`'s widths are 390, 900 and 1280; `--shell-max` rises to **1600 at 1440+**. So the 400px banner B3 fixed was invisible to every harness in the repo and was found by hand. Any claim about the wide band in this document was measured one-off, not gated **This blind spot has now produced two defects, and the second one shipped to `main`** — B9, a banner leaving 400px of blank page beside it at 1600, written and reviewed and photographed without anyone seeing it. A harness that measured 1440 and 1600 would have caught both. It still does not exist; B9 is gated statically instead.
- **Nothing re-measures under a second fixture.** Every measurement in this repo is taken once, against one seeded account. Two findings today were correct numbers about the wrong fixture: B7's "7-13% occupied" (a one-film shelf) and B11's 44px overlap (a one-line bio, where a four-line one gave 24px). Both were found by hand, by varying the fixture and measuring again. **No harness does that**, so a value that reads right against the seeded account and slides against a real one is invisible here.
- **`entry` and `profile/settings` have no designed counterpart** — the welcome module has no `-module.html`, and settings is drawn as part of shell.

---

## E. Suggested build order

One PR each. B2 first because it is the cheapest, the most visible, and it changes the numbers the others are judged against.

1. **WP-D1 — Overview carries what the design puts on it** (B2). Move Score spread to the Stats tab; move Favourite films and people behind the Favourites tab, leaving characters plus *"See all n →"*; overlay the gear on the banner and drop `page-head` from profile. **Four bands and ~60px off the first screen; nothing deleted.** Markup changes, so it is a development lane PR, not a design one. Re-run `npm run snap` and expect profile's fingerprints to move and nothing else's.
2. **WP-D2 — The banner gets its two ratios and stops cutting faces** (B1 + B5). `.pbanner` to 2:1, with 4:1 above the desktop breakpoint; `.pbanner-art` gets an upward crop bias, measured against real banners rather than copied from `title`'s 38%. Two CSS rules plus one media query. Design lane. Expect profile geometry to move at all three widths.
3. ~~**WP-D3 — Re-measure, then decide desktop** (B3).~~ **Shipped 2026-11-28**, out of order, because B1's desktop half landed first and the re-measurement said the growth was still there. Two columns at 1120+, a 440px cap at 600–1119, a 300px ceiling on the banner. It threw off B6, B7 and B8.
4. **WP-D4 — Close the vocabulary gap** (B4). Rename bands in `find`, `title` and `person`'s docs to the code's names. Docs only, no code. Raises the diff from 2 live comparisons to 7.

**Gate for every one of them:** `npm run check` green (25 checks), and `npm run divergence` showing the specific row closed — not just "looks right".

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

**B3 closed and shipped the same day** — *do B3 now* — as two columns at 1120+, a 440px cap on the card at 600–1119, and a **300px ceiling on the banner**. Full numbers and proofs in B3 above. The headline: **profile is 922px at 1280, 1440 and 1600** — it has stopped growing with width, which is what the item was given to own. The Films card is **320px** wide instead of 1120px at 1280, and instead of 1520px at 1600.

The ceiling is the part I would not have found from the report. `npm run snap` stops at 1280; `--shell-max` goes to **1600 at 1440+**; a 4:1 banner at 1600 is **400px**, and nothing in the repo was looking there. Section D now says so.

**It cost one element of markup.** The Overview bands are direct children of `.page`, which the shell owns, so no stylesheet could make them a grid — there was nothing to be the grid. One `<div className="pcols">`, inert below 1120. That is development lane; I did it rather than stopping, on the same authority as B2, and it is the only line of `.jsx` the change contains.

**Three things came out of building it, and none is built:** **B6** — the tall screen is now 900, not 1280, and closing that needs a breakpoint no drawing contains; **B7** — the desktop shelf is drawn as two 6-across grids and ships as one 80px rail, where I think the product's laws beat the drawing twice and the drawing wins on the tile width; **B8** — the identity band's expanded state (`S2`: `--radius-16`, a 96px lifted avatar, the name at `--text-display`) is written down and unbuilt. All three are in section B with recommendations.

Still open after today: **B1 phone half**, **B4**, and the three above.

---

**2026-11-28, later the same day — the five open items were put to the owner
and all five were decided.** Branch `claude/divergence-open-items-d270c4`.
`npm run check` green, 25 checks. Three further items — **B9**, **B10** and
**B11** — came out of building them and were decided as they appeared. Of the
72 recorded screens **2 moved**: `profile/profile@1280`, dark and light.

| item | decision | outcome |
|---|---|---|
| **B1** phone half | *keep 3:1, fix the doc* | **Closed.** The design doc already said 3:1 in its base rule and its anatomy table; eleven drawings overrode both with `.tall`. `.tall` removed. `divergence` now reports **"CSS agrees (base)"** |
| **B8** identity band | *do it* | **Shipped.** 96px avatar, `--radius-16`, name at `--text-display`. Shipped at 32px overlap; **revised to 48px the same day by B11**, which is the table's number |
| **B6** tall screen at 900 | *record as parked* | **Closed, not doing.** Needs an undrawn ~840 breakpoint; re-measured at 1034 |
| **B7** tile to 108px | approved, then **withdrawn** | **Not shipped.** Measured with a full eight-card shelf, both of its numbers were fixture artifacts and 108px breaks the rail law at 1120. Only the dead `600px` restatement was deleted |
| **B4** vocabulary gap | *do it* | **Partly closed, 2 → 3 live comparisons.** `person/director` now compares. The rest is not a rename, and is re-scoped into three pieces |

**Two findings came out of building these, and one of them had shipped.**

**B9 — the banner left 400px of blank page beside it at 1600.** B3's ceiling
clamped the height of a box with `aspect-ratio` and no definite width, so CSS
kept the ratio and shrank the *width* instead — the opposite of what the
comment beside it claimed. Invisible to every harness in the repo, because
`snap` stops at 1280 and the container is 1200 there. Fixed with `width: 100%`,
and gated: **`verify` check 25**, proved by reinstating the bug and by
blinding its own walker. **Tier 2.**

**B10 — the phone avatar.** The same table that specifies B8's expanded avatar
says the compact one is 64px overlapping by 32; it ships at 48px with no
overlap. Not built — it changes the phone screen, and that was not approved.
It is the one item here that would make the phone page *shorter*, and it needs
your yes.

**A third thing worth saying out loud: D1 cannot render its own overlap.**
The avatar lift the anatomy table specifies has never been visible in the
drawing that specifies it — the drawing's avatar is `position: static` under a
`position: relative` banner, and `elementFromPoint` inside its own overlap
returns the scrim. Copying D1's declarations reproduced that exactly. The
product ships the intent, with one declaration the drawing does not have.

**Still open:** **B4**'s three re-scoped pieces — a 1:N band mechanism, a
band-naming fix in `snap`, and a match-table correction for search. **B5**
stays parked. Everything in section F is untouched.

**B10 was approved and shipped the same day.** The phone avatar is 64px
overlapping by 32, and the phone page is **8px shorter** — 931 / 951 / 1026 at
390 / 600 / 900, with every expanded width unchanged. It turned out not to be
a judgement call: the document already contained a `.pav`/`.phead` pair
declaring exactly `--space-64` and a `-32px` lift, matching its anatomy table,
used by none of its nine drawings. **That is three times in one day** —
B1, B8 and B10 — **that a drawing has disagreed with the document it lives
in, and three times that the rule or the table has been right.** Where a
module doc states a thing twice and draws it once, trust the statements.

**That pattern decided the last open question, and it was approved too.**
B8's expanded overlap is now **48**, not 32 — the number its anatomy table
states (**B11**). Building it found a defect B8 had shipped without seeing:
the overlap was not a constant at all. D1's `align-items: center`, copied into
B8, centres the avatar's *margin box* in a flex line whose height comes from
the text beside it, so the overlap moved with the length of the bio — **44px
empty, 24px against a four-line one**. `flex-start` makes it `padding + margin`
and nothing else. The expanded page is **8px shorter**; the phone is untouched.

So the day's score on the drawings is four from four: **B1, B8, B10 and B11**,
each a case where a drawing disagreed with a statement in its own document, and
each time the statement was right. The working rule stands: where a module doc
states a thing twice and draws it once, trust the statements and measure the
drawing.

**And twice today a measurement was right about the wrong fixture** — B7's
"7–13% occupied" came from a one-film shelf, B11's 44px from a one-line bio.
Both were caught by changing the fixture and measuring again, and nothing in
the repo does that on its own. A second-fixture pass is the gate neither has.
