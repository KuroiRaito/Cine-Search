# Every command, in one place

Run all of these from the worktree:

```
/Users/raman/Documents/Cine Search/.claude/worktrees/design-system-exploration-c125fd
```

## The one that does everything

```
npm run check
```

Runs verify → states → gallery → gallery:audit → lint → build, in order, and
stops at the first failure. This is the only command you need day to day.

## The six it runs, if you want one on its own

| command | what it answers | fails the build? |
| --- | --- | --- |
| `npm run verify` | 17 design contracts — undefined classes, raw colours, off-scale lengths, an icon beside content with no row | **yes** |
| `npm run states` | which of the 42 controls forgot hover, focus, disabled or selected | no, prints |
| `npm run gallery` | regenerates `docs/as-built.html` | no, writes |
| `npm run gallery:audit` | which states render identically to rest — a hover that does nothing, a disabled control that looks clickable | no, prints |
| `npm run lint` | JavaScript | **yes** |
| `npm run build` | production bundle | **yes** |

## Looking at things

```
npm run dev
```

Then, in the browser:

| url | what |
| --- | --- |
| `http://localhost:5173/docs/as-built.html` | **the design system** — every token, icon and component the product actually renders |
| `http://localhost:5173/` | the app |
| `http://localhost:5173/search?genre=28&lang=hi&rated=7` | the app with filters applied, which is where the chip bug was |

`docs/as-built.html` is a plain file — you can also just open it from Finder,
no server needed.

## Screenshots of the real screens

```
npm run snap
```

72 PNGs into `snapshots/` — 7 screens × 390/900/1280 × dark/light. Needs no
credentials: TMDB comes from a fixture file and the session is fabricated.
`npm run snap -- --check` compares against the committed fingerprints instead
of rewriting them.

## The documents

| file | what |
| --- | --- |
| `docs/CONTROLS.md` | the contract — C1 states, C2 content cases, C3 focus, C4 selection, C5 layers, C6 components, C7 tooling. Numbered so you can strike any line |
| `docs/as-built.html` | what the code produces |
| `docs/design-system.html` and the seven beside it | what was designed |
