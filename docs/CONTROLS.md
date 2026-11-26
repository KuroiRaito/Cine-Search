# The control contract

**Scope:** every class the markup puts on something a person can click, type into or focus. 42 of them today.
**Why this document exists:** three bugs reached production in one week — the close cross under a filter chip, the score under the star on every poster, the blue box around the page title — and all three were the same failure. The component was built for the one state somebody happened to be looking at, and met a second state in the wild.
**Draft by Claude, 2026-11-25. Edit or reject by number.**

Numbers are from `npm run states`, which reads the markup and the stylesheets and reports what each control actually styles. Run it before arguing with a figure here.

---

## C1 — What a control owes

A control is unfinished until every line below is answered for it. "Answered" includes *deliberately nothing* — but written down, not left out.

- **C1.1** **Rest.** How it looks doing nothing.
- **C1.2** **Hover.** Pointer feedback. Was 19 of 42 styling none; now 5, and all five are answered by an ancestor — `.bd` and `.th` sit inside `.srow`, `.lfind-in` inside `.lfind`, and `.scrim`/`.sheet` are `<div>` containers rather than controls. A state drawn on a subtree counts: `.tile:hover .art` is a hover.
- **C1.3** **Focus.** Keyboard feedback. See C3.
- **C1.4** **Active.** The moment of the press. Answered once, product-wide, scoped the way the focus ring is: `:is(button, [role="button"], a[href]):not(:disabled):active { transform: scale(.97) }`. A control that must not move overrides that one rule. `transform` rather than a colour step because it is the only answer that works on a filled button, a ghost button, a chip and a poster without knowing what any of them look like.
- **C1.5** **Selected / pressed**, if it is a toggle. See C4.
- **C1.6** **Disabled**, if it can ever be disabled. Not "greyed out by opacity" — opacity on a filled control also fades its border and its shadow, and the result reads as a rendering fault.
- **C1.7** **Busy**, if it can be waiting on the network.
- **C1.8** **Invalid**, if it accepts input.

## C2 — What a control must survive

States are half of it. The other half is content, and it is the half that broke twice this month.

- **C2.1** **With an icon and without one.** `.icon` is `display: block`. A control that holds an icon beside anything else declares a flex or grid context, and thereby says which direction it runs. Enforced: `verify` check 17.
- **C2.1a** **An icon *alone* in a box is not covered by that check**, which only fires when the icon has a sibling. A lone glyph needs a correctly *sized* box as well as a correctly declared one, and it passed all 17 checks while sitting 2px right of centre. Geometry is not checkable by reading CSS — it is checkable by measuring a rendered control, which is C9.
- **C2.2** **The longest label it will really get.** Not "Action" — "Action & Adventure", TMDB's longest genre name, and the Hindi for it. **Drawn and checked** since 2026-11-26: specimens carry a `content` axis beside their `states`, and `gallery:audit` fails on it. Every string in it is real — the 70-character title and the Hangul one are lifted out of `snapshots/tmdb-fixtures.json.gz`, the product's own recorded TMDB responses, and the Devanagari is there because `facets.js` leads with Hindi, Tamil and Telugu. The rule for adding one: it must be content the product will really hold. An invented 200-character string proves a control *can* be broken; it does not prove anything *will* break it.
- **C2.3** **One child and several.** A chip with a count, a chip with a count and a cross.
- **C2.4** **Both themes.** Light is not dark with the numbers flipped: a floating surface gets *lighter* as it rises in dark and *darker* in light, which is why `--raised` exists and cannot alias the ink scale.
- **C2.5** **All three bands.** 390, 900, 1280. The 900 band is the one nobody draws.
- **C2.6** **Empty, one, and many**, wherever it renders a list. **Drawn and checked** since 2026-11-26 — see C11.

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

- **C5.1** A control used by more than one module belongs in `src/shared/ui/`. **Answered.** `.btn` — the most reused control in the product — was declared in *three* layers: the base in `src/app/shell.css` (journeys), `.btn-lg` and `.btn.ghost` in `src/modules/entry/entry.css` (one module). So the full set of appearances it could produce was written down nowhere. All of it is now in `ui.css`. Proved inert by measuring all 8 variants × 14 paint and box properties before and after the move: 0 of 112 changed. The measurement was itself proved by setting `.btn-lg`'s height back to `--control-h`, which it caught as `52px → 44px` on two variants.
- **C5.2** **A module never restyles a shared control.** 6 controls are defined in one layer and reached into from another, down from 7. That is how `search.css` came to carry a `vertical-align: middle` patch for a chip it does not own — a declaration that cannot move a block box and never did anything, sitting one layer away from the rule that caused the problem, so no reader ever saw both at once.
- **C5.3** If a module needs a shared control to be different, the difference is a **variant on the shared control**, declared where the control lives. Three moved this way when the component layer landed: `.chip.on` → `.chip.applied`, `.btn-lg`/`.btn.ghost`, and `text-decoration: none` on `.chip` (Discover had stripped the link underline for its own row, so the next module to render a chip as a link would have had to find that out again).
- **C5.4** **A module may *position* a shared control; it may not *repaint* it.** This is the line the remaining `.btn` rules sit on the right side of: `.card.signup .btn { width: 100% }` and `.nothing .btn { margin-top: … }` are a card and an empty state deciding how much room their action gets, which is the parent's business. Colour, radius, shadow, weight and text-decoration are the control's. `npm run states` cannot tell the two apart and counts both, which over-reports — the safe direction.

## C6 — A control is a component, not a convention

- **C6.1** **Answered.** `src/shared/ui/Button.jsx`, `Chip.jsx` and `Segment.jsx` own the markup of the three controls that were class names applied by hand — `.btn` at 45 sites across 19 files, `.chip` at 9 across 4, `.seg` at 3 across 3. Nothing owned them, so a case solved in one file was unknown to the rest, which is precisely how a chip grew a close icon no stylesheet had been told about.
- **C6.2** **It is held by check 19**, not by discipline. A `className` containing `btn`, `chip` or `seg` anywhere outside the three component files fails `verify`, and the message names the prop to use instead. Proved by hand-writing `className="btn quiet"` back into `Picker.jsx`, which it caught by file and line. A control's name used as a *modifier* — `chips`, `pchip`, `fchip`, `filterbtn` — is a different class and is not matched.
- **C6.3** **Writing the components found three bugs that reading the CSS had not.** Each had survived because it required holding two or three files in mind at once:
  - **The Kind filter never looked selected.** `.seg.on` was the only rule that draws a selected segment, and `FilterPanel.jsx` set `aria-pressed` and never added the class. A screen reader announced the state correctly; nobody's eyes could see it, for as long as the control had existed. `selected` is now one prop that writes both spellings.
  - **The chip had two selected appearances, and a third nobody designed.** `ui.css` drew `[aria-pressed="true"]` as a solid fill; `search.css` drew `.on` as a soft tint. Both are 0,2,0, so *which one won was decided by CSS chunk order* — `.on` shipped in the lazily-loaded search chunk and therefore won on the search route by accident of bundling. An element carrying both measured as **neither**: the tint from `.on`, the inset highlight from `aria-pressed`. The first draft of `Chip.jsx` wrote both, and would have shipped that third look everywhere. They are now two named roles, one spelling each, because they were never the same idea — `selected` is an option you turned on, `onRemove` is a filter you take off, and a remove button was never "pressed".
  - **A ninth chip site existed that the inventory grep had missed.** `SearchPage.jsx:259` renders a chip inline inside a sentence; the line also contains `said.chips`, so a `grep -v chips` filter meant to drop the container class hid the control. Check 19 found it on its first run. The machine check caught what the hand inventory did not, which is the entire argument for having it.
- **C6.4** **The component layer made `npm run states` under-report, and that had to be fixed with it.** `<Button className="filterbtn">` renders `class="btn filterbtn"`, so a reader that sees only `filterbtn` concludes the control has no hover — which is what the tool reported for `filterbtn` and `epmark` the moment the migration landed, for two controls that inherit `.btn:hover` and always did. `states.mjs` now restores a component's base class and reads the props that stand for one (`variant`, `size`, `block`, `busy`, `selected`), and `AS` knows the three components render `<button>` by default, without which `.chip` and `.seg` read as unfocusable. See C7.2: this is the fourth time this tool has read too narrowly.

## C7 — How this is held

- **C7.1** `npm run verify` — 19 machine checks, CI-gated. Check 17 is C2.1, check 18 is C12, check 19 is C6.2.
- **C7.2** `npm run states` — the coverage table. Not a gate: the gaps are design decisions and which ones matter is not a machine's call. It has been wrong twice, both times by reading too narrowly — once reporting MISSING focus for 40 controls the scoped global ring covers, once reporting MISSING hover for every control that answers on its subtree, and once filing `:hover:not(:disabled)` as a variant's hover because it counted the pseudos inside `:not()`. A tool that under-reports is worse than no tool, because the clean rows are believed.
- **C7.3** `npm run snap` — 72 screenshots, 7 screens × 3 bands × 2 themes. **It photographs the default state only.** None of this month's three bugs would ever appear in it, because states do not show up in screenshots of pages. Its `fingerprints.json` was the end-to-end proof that the 45-site `.btn` migration changed nothing: 72 of 72 identical. **But that fingerprint is structural, not pixel** — element count and geometry hash — and the proof of that is in the file itself: the dark and light shots of a screen share a hash, so only 36 of the 72 values are distinct. It would not catch a colour change. Colour was covered separately, by reading computed styles.
- **C7.4** `npm run gallery` — `docs/as-built.html`, every control drawn in every state it owes. Two things keep it from drifting away from the product, which is how every gallery dies: the CSS is the product's own, inlined verbatim and never restated; and `:hover`, `:focus-visible`, `:active` and `:disabled`, which markup cannot force, are *derived* — each rule that styles one is duplicated with the pseudo-class swapped for `[data-force~="…"]`. A control with no rule for a state draws the same as rest, so the gap is visible rather than inferred. Icons come from the real `Icon` component through vite-node, so one dropped from the role map disappears from the gallery too.
- **C7.5** `npm run gallery:audit` — reads back the computed style of all 60 cells in both themes and reports any state whose paint is identical to rest. It found six on the first run, and it found two false positives in `npm run states`: a state styled only on a variant (`.circ.sm:disabled`) or behind another pseudo-class (`.searchbox:-webkit-autofill:hover`) was being credited to the bare control. Two tools that disagree are worth more than one that is confident.
- **C7.6** `npm run shot -- <control>` — pulls one row out of the gallery at 3×. The gallery is 18,000px tall; a 24px control cannot be judged at the size it ships at, and "looks fine" at 1× is how a 2px offset survives. `--list` names every row, `--light` switches theme.
- **C7.7** A new check is proved by reverting the bug and watching it fire. **Three checks in this repo have now passed while broken**, and only re-breaking the product found them: the content check compared a long label to a short one and measured a difference of zero because both were broken; the spec-drift check ran *after* its own results had been collected, so its failures were never read; and `states` under-reported for two separate reasons. A check that has only ever seen a clean tree is not evidence of anything. A check that has only ever seen a clean tree has not been tested. The geometry check in C9 was proved this way: with the reset removed it reported `quickadd 2.0px right`, which is the figure measured by hand before the fix.

## C8 — Artwork has no theme

A control that lands on a poster or a still cannot borrow the page's surfaces, because what is underneath it is a photograph in light mode and a photograph in dark mode. It carries its own ground.

- **C8.1** **That ground is one material, named once.** `--glass`, `--glass-hv`, `--glass-line`, `--glass-blur`, `--on-glass`, in `tokens.css`, outside both theme blocks on purpose.
- **C8.2** It was seven controls inventing it separately: rest opacities `.55 .6 .6 .62 .68 .72`, hovers `.72` and `.78`, and two different base colours — `rgba(8,12,20)` for `.quickadd` and `rgba(4,6,12)` for the other six. The top-right and bottom-left corners of the same poster were built out of different glass, which is a thing nobody can see as a bug and everybody can see as cheapness.
- **C8.3** **The hairline is not trim.** A dark control on a dark poster has no edge of its own. `--glass-line` is what stops it dissolving into the artwork, and it belongs to every glass control, not just the one that happened to have it.
- **C8.4** `--scrim-wash` is a different job — the full-screen dim behind a sheet — and keeps its own name even at the same value. `.tplay-b` was using it as a control ground; it now uses `--glass`.

## C12 — The specification and the code agree, and that is checked

- **C12.1** `docs/design-system.html` is what the design **says**; `src/shared/theme/tokens.css` is what the product **does**. They share 83 custom properties and every one currently matches.
- **C12.2** It is a check rather than a note because the failure is silent and expensive: an agent reads the spec, builds to a value the code no longer holds, and nobody finds out until it is on screen. Neither file is wrong in that situation — they simply stopped being the same file, and nobody reads 162 tokens across two documents to notice.
- **C12.3** One level of `var()` is resolved first, because the code legitimately aliases where the spec states a literal — `--sh: var(--shadow-raised)` and the shadow written out are the same shadow said two ways. Proved by changing `--beam-9`: it reported both `--beam-9` and `--acc`, which aliases through it.
- **C12.4** Only the spec's `<style>` blocks are read. An inline `style="--c: …"` in one of its own demos is local to that demo, not a statement about the system.
- **C12.5** **The specification does not declare the spacing or radius scales**, so those are not cross-checked and `tokens.css` is their only statement. Worth closing, and worth knowing until it is.

## C11 — An item's size does not depend on how many are beside it

- **C11.1** A collection is a third kind of case, after what a control is *doing* and what it is *holding*. Specimens carry a `collection` with `counts`, and the gallery draws each count.
- **C11.2** **The invariant is that an item's size must not change with the count.** That is the signature of the two classic collection bugs: `grid-template-columns: repeat(auto-fit, …)` stretches a lone tile across the page, and a flex child that can grow turns two posters into two half-screens. Both are one word away from true in any stylesheet.
- **C11.3** This product gets both right already — `.grid` is `auto-fill`, `.rail > *` is `flex: 0 0 auto` — **which is exactly why it is worth pinning.** Proved by flipping `auto-fill` to `auto-fit`: one search result became 844px wide and 1302px tall, and the check named it with those numbers.
- **C11.4** **0 is a count.** `.chips` was rendered unconditionally by `SearchPage`, so with no filters on there was an empty 12px row above the results, and applying the first filter shoved them down by the height of a chip. Fixed at the container rather than the call site — `.chips:empty, .rail:empty, .grid:empty { display: none; }` — so it is true of every instance, including ones nobody has written yet. `:empty` matches no children *and* no text, so a collection holding one chip is untouched. This is not an empty *state*: `.empty` is a component somebody renders on purpose.
- **C11.5** **A container that scrolls an axis is exempt on that axis.** Content past the edge is what a rail is for. Flagging it taught the content check to report two false breaks before this was added.
- **C11.6** Running past the edge is **reported, never failed**. Whether `.chips` at 8 filters (151px past) and `.rail` at 8 tiles (732px past) need an affordance is a design decision — both set `scrollbar-width: none` deliberately — and the report exists so somebody decides it rather than nobody seeing it.

## C10 — A control that says it is one line is one line

- **C10.1** `white-space: nowrap` is the stylesheet saying this control is a single line. One line has a height computable from the control's own box — line-height, padding, border, `min-height` — and anything taller means something inside took a line of its own. That is the filter-chip bug exactly: 32px became 48px when the close cross, being `display: block`, claimed a row.
- **C10.2** **The first version of this check was relative and proved nothing.** It compared a long-content cell to the control's rest cell and asked whether it grew. With the production bug reinstated it reported *nothing wrong*, because rest holds the cross too — both cells grew by the same 16px and the delta was zero. The invariant has to be absolute.
- **C10.3** It runs on every cell, not only the content ones. A control that is the wrong height with a short label is already broken; it has only not met a long label yet. With the bug reinstated this reports 6 breaks across rest, hover, focus-visible and both content cases.
- **C10.4** Also measured, and needing no baseline: a child whose box leaves its parent's, and content clipped with no `text-overflow: ellipsis` to say the end was lost.
- **C10.5** Growth is a defect **only** where the control declared itself one line. A toast is supposed to wrap — a message that cannot wrap is a message that gets cut off. Flagging it would have trained everyone to ignore the check.

## C9 — A glyph alone in a control is centred, and that is measured

- **C9.1** A control whose entire content is one glyph is making a promise that the glyph is in the middle. `gallery:audit` measures it in a real browser: glyph rect against control rect, both axes, every state, both themes. Over half a pixel is a finding.
- **C9.2** **It fails the run.** The rest of that audit reports — which states a stylesheet never answered is a design decision — but a crooked glyph has no defence, so this one exits non-zero.
- **C9.3** It checks the outcome, not the cause. The cause this time was the UA's `padding: 1px 6px` on `<button>`, never reset anywhere in the product, which leaves a `width: 24px` control with a 12px content box. The padding is symmetric, so it only breaks when the glyph is wider than `width - 12px` and overflow resolves to the start edge: eight of the nine affected controls were drawn correctly and were one icon-size change from not being. A check written against *that* cause would have passed on all nine.
- **C9.4** The reset is `button { padding: 0 }` in `shell.css`, beside the `font-family` reset that was already there. A button that wants padding declares it; a class declaration beats an element one.
