#!/usr/bin/env node
/**
 * Coming back to where you were. A7, E31, M8.
 *
 *   npm run restore
 *
 * Two rules decide whether the back button lands somewhere true, and both of
 * them were wrong in a way that looked like flakiness rather than like a bug.
 * They are pure, they are arithmetic about heights, and they are exactly the
 * kind of thing nobody re-checks after reading the code once and agreeing with
 * it. The numbers in these cases are measured off the real page, not invented:
 * a browse grid two pages deep is 1714 tall in a 768 viewport, which puts its
 * own bottom at 946 and the recorded position at 946.5.
 */
import { isClamp, reachable } from '../src/app/restore.js';

let failed = 0;
const is = (label, got, want) => {
    const ok = got === want;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) console.log(`          want ${JSON.stringify(want)}\n           got ${JSON.stringify(got)}`);
};

/* The measured page: two pages of browse results. */
const GRID = 1714;
const VIEW = 768;
const BOTTOM = 946.5;
const MAX = GRID - VIEW;

console.log('\n  A7 · E31 · M8   coming back to where you were\n');

/* ---- reachable: the restore must not wait for a height it cannot get --- */

is('A7 the greatest position a page can hold is its height less the viewport',
    reachable(BOTTOM, GRID, VIEW), MAX);
is('A7 a position in the middle is reached exactly',
    reachable(400, GRID, VIEW), 400);
is('A7 and nothing is ever restored above the top',
    reachable(900, 400, VIEW), 0);

/* The half-pixel. The old rule asked whether GRID >= BOTTOM + VIEW, which is
   1714 >= 1714.5 — false, so a position at the bottom of a list never
   restored, which is exactly where somebody is when they tap a result. */
is('A7 the bottom of a list is a half-pixel beyond what the list can hold',
    GRID >= BOTTOM + VIEW, false);
is('A7 so it is clamped rather than waited for',
    reachable(BOTTOM, GRID, VIEW) < BOTTOM, true);

/* Read each frame, it follows the document down as the rest of it arrives —
   so an early answer is corrected rather than being the final one. */
is('M8 a half-built page gives back only what it has',
    reachable(BOTTOM, 900, VIEW), 132);
is('M8 and the finished page gives back the rest',
    reachable(BOTTOM, GRID, VIEW), MAX);

/* ---- isClamp: the page moving is not the person moving ---------------- */

/* The measured failure: a 1714-tall grid is replaced by a title page that
   arrives at the top, the browser clamps, and that clamp was recorded as the
   person having scrolled to zero. Every restore in the app read that zero. */
is('E31 a tall list replaced by a short page is the page moving',
    isClamp(0, 700, VIEW, GRID), true);
is('E31 the position recorded for that entry would otherwise have been zero',
    isClamp(0, 700, VIEW, GRID) ? 'ignored' : 'recorded 0', 'ignored');

/* And the cases it must not swallow, because they are the person. */
is('E31 scrolling to the bottom of a page that did not change is the person',
    isClamp(BOTTOM, GRID, VIEW, GRID), false);
is('E31 scrolling to the top of a page that did not change is the person',
    isClamp(0, GRID, VIEW, GRID), false);
is('E31 scrolling up a page that grew is the person',
    isClamp(200, 2400, VIEW, GRID), false);
is('E31 and a short page getting shorter still records a position above its floor',
    isClamp(0, 2400, VIEW, GRID), false);

/* A list that shrinks while you are halfway up it is still the page moving,
   but only at the point the clamp actually bites. */
is('M8 a shrink that does not reach you is not a clamp',
    isClamp(100, 1200, VIEW, GRID), false);
is('M8 a shrink that does reach you is',
    isClamp(432, 1200, VIEW, GRID), true);

console.log(`\n  The measured round trip:\n    left at ${BOTTOM}, the page holds ${MAX}, restored to ${reachable(BOTTOM, GRID, VIEW)}`);
is('  which is the whole feature',
    reachable(BOTTOM, GRID, VIEW), 946);

console.log(failed ? `\n  ${failed} failed.\n` : '\n  All cases pass.\n');
process.exit(failed ? 1 : 0);
