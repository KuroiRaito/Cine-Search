# You

Taste, worked out from your own records, and settings. Screen 7; acceptance
criteria M3 §3.3–3.7.

## Public surface

```js
import { You, Settings } from '../modules/you';
```

## What it owns

`taste.js` — the one query behind the whole screen, and the formatters that
turn stored minutes into "18.4 days" or "3d 4h". Minutes are stored and
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
