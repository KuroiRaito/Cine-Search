# Discover

The home rails. Screen 1 in the design system; acceptance criteria M1 §1.4.

## Public surface

```js
import Discover from '../modules/discover';   // the route component
```

## Rules it carries

- One sign-up card, after two rails — below the fold, once some value has been
  delivered. Gone entirely once you are signed in.
- One dead feed must not take the page with it: each rail owns its own loading
  and error state.
- Tapping `+` on a tile is how a guest discovers what the product is for, so
  the control is always visible, never hidden until hover.

## Known headroom

- Four fixed rails. The design's guest home also shows genre rails and a
  "because you watched" rail — the second is buildable from `profile_stats`.
- `.head-actions` duplicates controls the shell's top bar owns at desktop. One
  of the two should go.

## Seeing it

```bash
npm run snap -- discover            # screenshots at 390 / 900 / 1280, both themes
npm run snap -- discover --check    # did anything move that shouldn't have?
```
