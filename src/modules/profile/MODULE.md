# Profile

Module 8. Identity, the numbers behind it, and settings —
`docs/profile-module.html`. Absorbs what used to be `you`: screen 7 and
acceptance criteria M3 §3.3–3.7 still apply to the taste half.

## Public surface

```js
import { Profile, Settings } from '../modules/profile';
```

## Becoming the profile

This module is being absorbed into **module 8, Profile**
(`docs/profile-module.html`). The design's D3 ruling is that the profile does
not sit beside `you` — it *is* `you`, with identity and favourites above the
numbers, because two screens showing the same figures is how they come to
disagree.

Landing in order, one PR each:

| | | |
| --- | --- | --- |
| 1 | Stats | done — two medium blocks, distribution bars, score spread |
| 2 | **Identity** | done — banner, avatar, bio, display name, edit sheet, banner picker |
| 3 | **Favourites** | done — order column, tab shell, chip row, films and series shelves |
| 4 | People & characters | both shelves, the picker, `credit_id`, `/credit/{id}` in the proxy allowlist |

The directory was renamed with step 2. The route stays `/you` and the tab still
reads **You**, because that is what your own profile is called from the inside.

Studios is a fifth shelf in the design and is **deliberately not built in v1**
— it needs a company page that no module owns. It stays documented so v2 does
not have to rediscover it.

## What it owns

`identity.js` — the decisions behind the band. Which of the three banner kinds
to draw and what to fall back to; the avatar's letter and its gradient; the
1,000-character bio limit, which is a database constraint as well, because a
limit enforced only in a sheet is not enforced.

Two things in there are less obvious than they look. `firstGrapheme` uses
`Intl.Segmenter` rather than `name[0]`, because 神谷 must render 神 and an emoji
must not render as half of itself. And `colourClass` maps a key to a whole
class name instead of interpolating one: `bg-${key}` builds a name no tool can
see, and `npm run verify` reads it as a class called `bg-`.

`favourites.js` — which shelves exist, the order rule, and the pure `moved()`
that a reorder is expressed as.

**Eight is a display rule, not a limit.** Overview previews the first eight of
a shelf; the Favourites tab shows the whole thing. Nothing refuses a ninth
favourite and there is no "which one does this replace?" sheet — the
constraint does its work on the rail, where the first eight are the statement.

**Two shelves, not four.** Films and series are the two whose ♥ already exists
on a title page. People and characters need a picker they do not have yet, so
they arrive together with it — a chip that opens an empty grid you cannot fill
is worse than a chip that is not there.

**The Library tab is a link, not a tab.** It goes to the screen the library
module owns. Putting two routes behind one control would make the back button
mean two different things.

**Uploads are not built.** The design draws them; §06 recommends the
catalogue-first route partly because it needs no Storage bucket, and none
exists. Picking a still from your library arrives with favourites, since it
reads from the shelves.

`taste.js` — the one query behind the whole screen (`profile_stats()`, which
replaced `taste_summary()`), the formatters that turn stored minutes into
"18.4 days" or "3d 4h", and the two rules that turn numbers into sentences:
the distribution bar's 2% floor, and the score spread's thresholds. Minutes are stored and
returned as integers; the shape they take is decided where they are drawn.

## Rules it carries

- **No streaks, no nudges, nothing that decays.** Every number is cumulative;
  skipping a month costs nothing. This is a record, not a game you can lose.
- One card shape serves genres, people and decades. A person card shows a
  fraction where a genre card shows a count.
- Ranked per kind and interleaved, not by raw count: counting everything
  together lets decades win, and "you watch a lot of 2010s films" is close to
  a tautology.
- People are ranked by how many of your watched titles they worked on, not by
  what proportion of their filmography that is — proportion lets a director
  with two films you happened to see both of outrank one with six.
- "Score" needs three rated titles before a card can rank.
- Nothing is compared against other users, because there are none.

## Known headroom

- A card that cannot rank under "Score" gives no reason. "Rate two more" would.
- Rewatch semantics remain open from M2 grooming: do episode ticks clear per
  pass or persist? The hours multiply by `rewatch_count`, so the question now
  has a visible consequence.

## Seeing it

```bash
npm run snap -- you            # screenshots at 390 / 900 / 1280, both themes
npm run snap -- you --check    # did anything move that shouldn't have?
```
