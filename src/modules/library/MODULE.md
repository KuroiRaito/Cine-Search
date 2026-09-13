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
