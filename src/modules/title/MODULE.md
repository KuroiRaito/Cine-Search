# Title

The detail page for one film or one series. Screens 3 and 4 in the design
system; acceptance criteria M1 §1.4–1.5 and M2 §2.2–2.4.

## Public surface

```js
import Title from '../modules/title';   // the route component, default export
```

Nothing else is importable from outside. The route is `/title/:mediaType/:id`;
the module reads its own params and fetches its own data.

## What it owns

| File | |
|---|---|
| `Title.jsx` | the screen: one `titleFull` request, state, handlers, layout |
| `title.css` | every rule for this screen, its tablet and desktop breakpoints, and the loading shimmer for its hero and stills |

Classes introduced in `title.css` may be used only by files in this folder.
Scoping a *shared* class inside one of its own (`.tside .prow`) is allowed —
that is styling its own composition, not claiming a primitive.

## What it depends on

- `shared/` — the primitives (`Tile`, `PersonRow`, `Poster`, `Toast`, …),
  `useAsync`, `useRegion`, the TMDB layer, the session.
- The library, for everything a person records: this title's entry, saving,
  episode ticks, the editor sheet. Those still live under `context/`, `lib/`
  and `components/`; when the library module exists, this will import its
  index and nothing deeper.

## Rules it carries

These are product decisions, not implementation details. Changing one is a
design decision, not a refactor.

- A film offers three statuses, a series six. Rating locks until Watched.
- Ticking an episode promotes an untracked or want-to-watch series to
  Watching, and never demotes anything.
- Ticking the last aired episode *offers* to mark the series watched; it never
  assumes, because unaired seasons exist.
- "Mark all" is per season, never per series.
- Specials are recorded, and not counted toward progress.
- Every control a guest can reach raises the sign-in sheet, with the verb of
  the control that was tapped.

## Known headroom

- `videos` and `external_ids` are fetched on every load and drawn nowhere —
  a trailer affordance and an IMDb link cost no extra request.
- "Jump to episode" was deferred at grooming.
- There is no card for *your* history with the title (started, finished,
  rewatches, notes), which is the one thing no other film app can show.
