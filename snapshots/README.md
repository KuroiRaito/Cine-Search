# Snapshots

Per-module screenshots and layout fingerprints.

```bash
npm run snap                  # every module
npm run snap -- title person  # just those
npm run snap -- --check       # compare against the committed fingerprints
```

Signed-in screens need the test account:

```bash
SNAP_EMAIL=test@cinesearch.test SNAP_PASSWORD=… npm run snap
```

Without those the sweep still runs; the library and taste screens simply show
what a guest sees.

## Two outputs, two jobs

**`<module>/<screen>@<width>-<theme>.png`** — for a person to look at. Three
widths (390, 900, 1280) in both themes. **Gitignored**: a full-page capture at
1280 is around 2 MB and a sweep is sixty of them, which is not something to put
in git history forever to show what a minute of compute can regenerate. Attach
the ones that matter to a pull request instead.

**`fingerprints.json`** — for a machine to compare, and committed. Each entry
is the position and size of every element on that screen, hashed.

## Why a fingerprint rather than a pixel diff

The artwork changes whenever TMDB's trending list does, so a pixel diff would
cry wolf every day. The fingerprint ignores pixels entirely and catches the
thing pixels are bad at reporting: that a box moved.

This is the comparison that caught the desktop top bar vanishing during the
module carve — at 1280 the phone's tab bar was showing and the top bar was
hidden, because carving the breakpoints out of `base.css` put them above the
rules they override. Nothing else would have noticed until someone opened the
app on a laptop.

Dark and light hash identically on purpose: a theme changes colour, not layout.
If one ever changes layout, that is worth knowing, and this will say so.

## Not in CI

It needs a browser, a TMDB key and a Supabase session, which makes it a poor
gate and a good tool. `npm run verify` is the gate. Run this before opening a
pull request that touches a module, and commit the fingerprints when the change
is intended.
