# Library

The record: everything a person can record about a title, the screen that reads
it back, and the editor sheet. Screen 6 and 4b; acceptance criteria M2.

## Public surface

```js
import {
  LibraryProvider, useLibrary, useTileStates, useQuickAdd,
  Library, Editor,
  statusMeta, statusTone, collectionProgress, episodesWatched, /* … */
} from '../modules/library';
```

`useTileStates()` and `useQuickAdd()` are how a screen gives the shared `Tile`
primitive its saved state and its tap behaviour without the primitive knowing
anything about libraries.

## Find, sort, density

`docs/library-module.html` §03's three controls, on one bar. They exist because
a library is the one screen that only grows: the reference account benchmarked
for this design carries 1,497 titles and measures 157 screens of scroll.

| | | Remembered? |
|---|---|---|
| **Find** | Filters as you type, across all statuses. Title only. | No |
| **Sort** | Six orders; the options and the default depend on the shelf. | Per shelf, this session |
| **Density** | Comfortable or compact. A toggle, because two states need no sheet. | Globally, across visits |

**Find is not search.** Search goes to the catalogue and answers "does this
exist"; find stays home and answers "where did I put it". It is word-prefix and
diacritic-insensitive — `ame` finds *Amélie*, and deliberately not a substring
match, because `art` returning every title containing a-r-t is what makes
somebody stop trusting the box. When it fails it hands over to Search carrying
the typed text (L6), and while it is in use the status filter is **visibly set
aside rather than hidden** (L20): the chips stay, and tapping one is the way
back.

**Sort's options are asked of the rows, not listed per shelf.** A list would
drift from what is actually there — "Your rating" on an unrated shelf is a
control that does nothing. Every order breaks ties on title, without which two
films rated 8 swap places every time a tick lands.

**Density changes the shape, never the destination.** A compact row links where
a poster links. Its trailing slot carries the whole behavioural difference: a
series in progress keeps the `+`, anything finished shows its score, and
unrated leaves the slot empty rather than removing it so the column stays a
column.

## Reading past a thousand rows

PostgREST caps a response and says nothing. Measured on this project: a view of
5,000 rows returns 1,000 with `Content-Range: 0-999/5000`. Every read here
pages until the server sends a short page, which is the only reliable signal
that there is nothing left — `pageThrough` in `library.js`. A library that
silently drops rows is worse than one that is slow, because slow is visible.

## What it owns

| File | |
|---|---|
| `LibraryProvider.jsx` | one in-memory copy of the person's library; optimistic writes with rollback |
| `library.js` | the status vocabulary, the RPC calls, the progress arithmetic, the person-totals cache |
| `Library.jsx` | the screen |
| `Editor.jsx` | the editor sheet |

## Rules it carries

- Every write is optimistic, rolled back on failure, and the failure is said
  out loud. A write that fails quietly is worse than one that fails.
- One in-memory library, so the same title never shows two states in two
  places.
- Series are rows and films are a grid, inside one filter: a series carries
  progress, which a poster cannot show and a row can.
- The `+` marks the next unwatched episode and names it — never "add one to a
  number". Undo lasts six seconds.
- When a filter is empty for one media type, say why. An empty grid is not an
  answer.
- Save is explicit; remove is footer-isolated and confirms.

## Known internal work

`library.js` is still one file doing four jobs — vocabulary, transport,
arithmetic, cache. Splitting it into `statuses.js` / `api.js` / `progress.js`
is mechanical and was deliberately deferred so the module move stayed a move.

## Seeing it

```bash
npm run snap -- library            # screenshots at 390 / 900 / 1280, both themes
npm run snap -- library --check    # did anything move that shouldn't have?
```
