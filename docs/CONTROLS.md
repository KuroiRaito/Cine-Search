# The control contract

**Scope:** every class the markup puts on something a person can click, type into or focus. 42 of them today.
**Why this document exists:** three bugs reached production in one week — the close cross under a filter chip, the score under the star on every poster, the blue box around the page title — and all three were the same failure. The component was built for the one state somebody happened to be looking at, and met a second state in the wild.
**Draft by Claude, 2026-11-25. Edit or reject by number.**

Numbers are from `npm run states`, which reads the markup and the stylesheets and reports what each control actually styles. Run it before arguing with a figure here.

---

## C1 — What a control owes

A control is unfinished until every line below is answered for it. "Answered" includes *deliberately nothing* — but written down, not left out.

- **C1.1** **Rest.** How it looks doing nothing.
- **C1.2** **Hover.** Pointer feedback. **19 of 42 controls style no hover at all.**
- **C1.3** **Focus.** Keyboard feedback. See C3.
- **C1.4** **Active.** The moment of the press. Nothing in the product styles this.
- **C1.5** **Selected / pressed**, if it is a toggle. See C4.
- **C1.6** **Disabled**, if it can ever be disabled. Not "greyed out by opacity" — opacity on a filled control also fades its border and its shadow, and the result reads as a rendering fault.
- **C1.7** **Busy**, if it can be waiting on the network.
- **C1.8** **Invalid**, if it accepts input.

## C2 — What a control must survive

States are half of it. The other half is content, and it is the half that broke twice this month.

- **C2.1** **With an icon and without one.** `.icon` is `display: block`. A control that holds an icon beside anything else declares a flex or grid context, and thereby says which direction it runs. Enforced: `verify` check 17.
- **C2.1a** **An icon *alone* in a box is not covered by that check**, which only fires when the icon has a sibling. A lone glyph needs a correctly *sized* box as well as a correctly declared one, and it passed all 17 checks while sitting 2px right of centre. Geometry is not checkable by reading CSS — it is checkable by measuring a rendered control, which is C9.
- **C2.2** **The longest label it will really get.** Not "Action" — "Science Fiction & Fantasy", and the Hindi for it.
- **C2.3** **One child and several.** A chip with a count, a chip with a count and a cross.
- **C2.4** **Both themes.** Light is not dark with the numbers flipped: a floating surface gets *lighter* as it rises in dark and *darker* in light, which is why `--raised` exists and cannot alias the ink scale.
- **C2.5** **All three bands.** 390, 900, 1280. The 900 band is the one nobody draws.
- **C2.6** **Empty, one, and many**, wherever it renders a list.

## C3 — Focus has exactly one owner

Today it has three, and that is the blue box around the page title.

- **C3.1** The global ring in `shell.css` is the default and should stay. **40 of 42 controls rely on it** — that is fine, that is what a default is for.
- **C3.2** **The global ring applies to controls only.** It currently matches anything focusable, including the `<h1>` that `Navigation.jsx` focuses on every route change so a screen reader announces the new page. That heading is a destination, not a control, and must not be drawn as one. Scope the selector to real controls.
- **C3.3** **No component uses bare `:focus`.** `:focus` fires on a mouse click and stays after it. `.searchbox` and `.inp` both do this today, which is why clicking the search field leaves a ring behind. `:focus-visible` is the only correct spelling.
- **C3.4** A component overrides the global ring only when the default is genuinely wrong for it — an inset ring on a field that sits flush in a bar, for instance — and then it styles `:focus-visible`, not `:focus`.

## C4 — One state, one spelling

Selection is written two ways today: `aria-pressed` on some controls, an `.on` class on others, and `.chip` uses both at once.

- **C4.1** **`aria-pressed` / `aria-selected` / `aria-current` is the source of truth**, because it is the one the browser and a screen reader can both read.
- **C4.2** The stylesheet selects on that attribute, never on a parallel `.on` class. A second class that means the same thing as an attribute is a second thing to forget.
- **C4.3** Where the two disagree, the control is already broken and nobody can see it.

## C5 — Where a control lives

- **C5.1** A control used by more than one module belongs in `src/shared/ui/`. **`.btn` — the most reused control in the product — lives in `src/app/shell.css`,** the journeys layer.
- **C5.2** **A module never restyles a shared control.** 7 controls are defined in one layer and reached into from another. That is how `search.css` came to carry a `vertical-align: middle` patch for a chip it does not own — a declaration that cannot move a block box and never did anything, sitting one layer away from the rule that caused the problem, so no reader ever saw both at once.
- **C5.3** If a module needs a shared control to be different, the difference is a **variant on the shared control**, declared where the control lives.

## C6 — A control is a component, not a convention

- **C6.1** There is no `<Button>`, `<Chip>` or `<Segment>` in this codebase. `.btn`, `.chip` and `.seg` are class names applied by hand in roughly twenty files. Nothing owns their markup, so a case solved in one file is unknown to the other nineteen — which is precisely how a chip grew a close icon that no stylesheet had been told about.
- **C6.2** Extracting them is the single change that would prevent most of C1 and C2 from recurring. It is JSX, so it is a development task, not a design one, and it should be scoped and estimated rather than done in passing.

## C7 — How this is held

- **C7.1** `npm run verify` — 17 machine checks, CI-gated. Check 17 is C2.1.
- **C7.2** `npm run states` — the coverage table. Not a gate: the gaps are design decisions and which ones matter is not a machine's call.
- **C7.3** `npm run snap` — 72 screenshots, 7 screens × 3 bands × 2 themes. **It photographs the default state only.** None of this month's three bugs would ever appear in it, because states do not show up in screenshots of pages.
- **C7.4** `npm run gallery` — `docs/as-built.html`, every control drawn in every state it owes. Two things keep it from drifting away from the product, which is how every gallery dies: the CSS is the product's own, inlined verbatim and never restated; and `:hover`, `:focus-visible`, `:active` and `:disabled`, which markup cannot force, are *derived* — each rule that styles one is duplicated with the pseudo-class swapped for `[data-force~="…"]`. A control with no rule for a state draws the same as rest, so the gap is visible rather than inferred. Icons come from the real `Icon` component through vite-node, so one dropped from the role map disappears from the gallery too.
- **C7.5** `npm run gallery:audit` — reads back the computed style of all 60 cells in both themes and reports any state whose paint is identical to rest. It found six on the first run, and it found two false positives in `npm run states`: a state styled only on a variant (`.circ.sm:disabled`) or behind another pseudo-class (`.searchbox:-webkit-autofill:hover`) was being credited to the bare control. Two tools that disagree are worth more than one that is confident.
- **C7.6** `npm run shot -- <control>` — pulls one row out of the gallery at 3×. The gallery is 18,000px tall; a 24px control cannot be judged at the size it ships at, and "looks fine" at 1× is how a 2px offset survives. `--list` names every row, `--light` switches theme.
- **C7.7** A new check is proved by reverting the bug and watching it fire. A check that has only ever seen a clean tree has not been tested. The geometry check in C9 was proved this way: with the reset removed it reported `quickadd 2.0px right`, which is the figure measured by hand before the fix.

## C8 — Artwork has no theme

A control that lands on a poster or a still cannot borrow the page's surfaces, because what is underneath it is a photograph in light mode and a photograph in dark mode. It carries its own ground.

- **C8.1** **That ground is one material, named once.** `--glass`, `--glass-hv`, `--glass-line`, `--glass-blur`, `--on-glass`, in `tokens.css`, outside both theme blocks on purpose.
- **C8.2** It was seven controls inventing it separately: rest opacities `.55 .6 .6 .62 .68 .72`, hovers `.72` and `.78`, and two different base colours — `rgba(8,12,20)` for `.quickadd` and `rgba(4,6,12)` for the other six. The top-right and bottom-left corners of the same poster were built out of different glass, which is a thing nobody can see as a bug and everybody can see as cheapness.
- **C8.3** **The hairline is not trim.** A dark control on a dark poster has no edge of its own. `--glass-line` is what stops it dissolving into the artwork, and it belongs to every glass control, not just the one that happened to have it.
- **C8.4** `--scrim-wash` is a different job — the full-screen dim behind a sheet — and keeps its own name even at the same value. `.tplay-b` was using it as a control ground; it now uses `--glass`.

## C9 — A glyph alone in a control is centred, and that is measured

- **C9.1** A control whose entire content is one glyph is making a promise that the glyph is in the middle. `gallery:audit` measures it in a real browser: glyph rect against control rect, both axes, every state, both themes. Over half a pixel is a finding.
- **C9.2** **It fails the run.** The rest of that audit reports — which states a stylesheet never answered is a design decision — but a crooked glyph has no defence, so this one exits non-zero.
- **C9.3** It checks the outcome, not the cause. The cause this time was the UA's `padding: 1px 6px` on `<button>`, never reset anywhere in the product, which leaves a `width: 24px` control with a 12px content box. The padding is symmetric, so it only breaks when the glyph is wider than `width - 12px` and overflow resolves to the start edge: eight of the nine affected controls were drawn correctly and were one icon-size change from not being. A check written against *that* cause would have passed on all nine.
- **C9.4** The reset is `button { padding: 0 }` in `shell.css`, beside the `font-family` reset that was already there. A button that wants padding declares it; a class declaration beats an element one.
