# Profile — what is on it, and what you want to keep

A worksheet, not a spec. The columns I can fill from the code are filled. The
one I cannot is **Verdict**, because it is a product ruling and not a fact
about the repo.

Fill that column, answer the four questions at the top, and the result becomes
`P`-numbered rows in `docs/USE_CASES.md` and a design brief for
`docs/profile-module.html`. Nothing here is a recommendation about layout —
that is design's lane and yours with them.

---

## Two things worth knowing before you rule on anything

**1. Nobody has ever seen this screen.** `snap` photographs seven screens at
three widths in two themes. The profile's test fixture had the wrong shape —
`profile_stats` nests its counts under `totals` and the fixture was flat — so
`Profile.jsx` read nothing, took its "Nothing watched yet" branch, and every
committed profile screenshot for months was of the **empty state**: 57 elements
where the title screen has 396. Nothing complained, because a photograph of an
empty page is still a photograph.

Fixed in PR #114. The profile now photographs at 110 elements, and a screen
that draws its empty state while the harness is feeding it a library now fails
the run by name.

So: your impression that the designs are not reaching the product is, for this
screen specifically, *literally* true. There was no gate on it at all.

**2. It was designed for an audience that does not exist.** The profile was
benchmarked against AniList and built as a page you **show other people** —
identity banner, handle, bio, favourite shelves, a taste ranking. Cine Search
ends at Layer 2; the social layer is parked indefinitely. Today nobody can see
your profile but you.

That is not a layout problem and spacing will not fix it. In your own
`FEEDBACK_INTAKE.md` taxonomy it is **mis-designed**, not misbuilt — the code
matches its document exactly, and the document assumed a reader who has not
arrived. The two have opposite fixes, which is why the distinction earns its
keep here.

**This is the ruling that decides most of the table below.** A page you read
yourself wants numbers and progress. A page you show others wants identity and
taste. Most of the clutter is the two sets sitting on top of each other.

---

## The four questions

**Q1 — The job, in one sentence.**
> This screen exists so that someone can ______________________.

If it takes two sentences, the second one is the clutter and you have just
named it.

**Q2 — The reader.** You, or someone else? If someone else: when, and how did
they get here?

**Q3 — The one thing.** Which single element is the thing people come here for
— the one that survives no matter what else goes?

**Q4 — Emptiness.** The existing cold-start rule says *at most one empty
invitation at a time*. Does it still hold?

---

## The inventory

Verdict key: **keep** · **demote** (move behind a tab or below) · **cut** ·
**merge** (say which it joins)

### Persistent — above the tabs, on every tab

| # | Element | What it reads | When there is nothing | Watched by a gate? | Verdict |
|---|---|---|---|---|---|
| P1 | Settings gear | — | always there | snap | |
| P2 | Banner image, editable | `profiles` row | gradient by default | snap | |
| P3 | Display name | `profiles.display_name` | falls back to handle | snap | |
| P4 | Avatar | `profiles.avatar_colour` | coloured initial | snap | |
| P5 | `@handle` | `profiles.username` | — | `auth` | |
| P6 | Bio | `profiles.bio` | placeholder: *"Say something about what you watch."* | snap | |
| P7 | Edit button | — | always there | snap | |

### Tab bar

| # | Element | Note | Verdict |
|---|---|---|---|
| P8 | Overview · Favourites · Stats | three tabs | |
| P9 | `Library →` | **not a tab** — a link out to a route the library module owns | |

### Overview tab

| # | Element | What it reads | When there is nothing | Watched? | Verdict |
|---|---|---|---|---|---|
| P10 | **Films** block — watched, days, mean | `films` + `distribution.movie` | shows zeros; never hides, because a hidden section is indistinguishable from a failed one | snap (new) | |
| P11 | **Series** block — watched, episodes, mean | `series` + `distribution.tv` | as above | snap (new) | |
| P12 | Distribution bar + legend, per block | `distribution` | — | snap (new) | |
| P13 | **Score spread** — "how harsh you are" | `spread` | suppressed below `SCORE_FLOOR` = 3 ratings | snap (new) | |
| P14 | Shelf rail — **Films** | favourites | rail hidden when empty | — | |
| P15 | Shelf rail — **Series** | favourites | as above | — | |
| P16 | Shelf rail — **People** | favourites | as above | — | |
| P17 | Shelf rail — **Characters** | favourites | as above | — | |

Each rail previews the first eight; the Favourites tab holds the whole shelf.
Eight is a display rule, not a limit — nothing ever refuses a ninth.

### Favourites tab

| # | Element | Note | Verdict |
|---|---|---|---|
| P18 | All four shelves in full, reorderable | duplicates P14–P17 at greater length | |

### Stats tab

| # | Element | What it reads | When there is nothing | Watched? | Verdict |
|---|---|---|---|---|---|
| P19 | "Your taste · by count/score" + toggle | — | — | — | |
| P20 | Taste cards — genres, decades, people, ranked and interleaved | `dimensions`, `people` | *"Rate at least 3 titles in something to rank by score. One film you loved isn't a taste."* | — | |

---

## What I notice, offered as observations rather than rulings

**The same four shelves appear twice.** P14–P17 preview them on Overview and
P18 shows them in full behind a tab. That is one idea occupying two places, and
it is the cheapest thing on this page to resolve.

**Three tabs plus a link that looks like a tab.** P9 is styled as a tab and
behaves as a route change. It is honest in the code and ambiguous on screen.

**Overview is doing two jobs.** P10–P13 are *your numbers*. P14–P17 are *your
statement to someone else*. They are stacked in one scroll with nothing marking
the change of subject — and per the second finding above, only one of those two
jobs currently has a reader.

**Nothing on Stats is gated.** P19 and P20 have no automated coverage at all.
Neither do the four rails.

**`profiles.services` is read by AuthProvider and settable nowhere.** It is not
on this screen, but it will surface if settings come up — do not design against
it.

---

## What happens once the Verdict column is full

1. Each ruling becomes a `P`-numbered row in `docs/USE_CASES.md` with its
   journey, trigger and expected behaviour.
2. Design updates `docs/profile-module.html` in place — it is the module's
   authoritative document and should not be replaced with a new one.
3. Development builds against those ids, and every new rule gets a named case
   in a harness, so a future failure says *which* rule broke.
4. `snap` now actually photographs the result, so "did this ship?" is a
   question a machine answers rather than one you ask by scrolling.
