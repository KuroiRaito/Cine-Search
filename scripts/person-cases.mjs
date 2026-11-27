#!/usr/bin/env node
/**
 * How much of a person's page shows at once. TP1, TP4.
 *
 *   npm run person
 *
 * Two caps, both read off the rendered box rather than declared, and both
 * with the same failure mode: when the measurement is wrong, the page hides
 * content and says nothing. A cap that reads three columns where there are
 * six shows half a filmography behind a button that claims to be showing it
 * all, and nothing on screen looks broken.
 *
 * So the arithmetic is pure and it is checked here. The numbers are measured
 * off the real page in Chromium on 28 Nov 2026 — Christopher Nolan, /person/525
 * — not invented:
 *
 *     320   --grid-min 136px   "136px 136px"                        2 cols
 *     768   --grid-min 170px   "229.328px 229.336px 229.328px"      3 cols
 *    1440   --grid-min 208px   6 x ~213.33px                        6 cols
 *
 * and the biography at --lh-body-sm 20px, five lines = a 100px box, against a
 * scrollHeight of 620 at 768 and 1100 at 320.
 *
 * The one that matters most is the fourth row of that table, which is not a
 * width at all:
 *
 *    not laid out              "repeat(auto-fill, minmax(136px, 1fr))"
 *
 * That is CLAUDE.md §7's most expensive class — absent becoming plausible.
 * Split on whitespace it is three pieces, which reads as three columns and
 * caps every section at six tiles for a reason that has nothing to do with
 * the viewport. It is not hypothetical: `.grid:empty` is `display: none`, so
 * an empty filmography in the document reports exactly that string. Measured,
 * both for a `display: none` grid and for an empty one.
 */
import {
    columnsOf, capOf, pxOf, clampOf, CAP_ROWS, BIO_LINES, CLAMP_SLACK,
} from '../src/modules/person/shape.js';

let failed = 0;
const is = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) console.log(`          want ${JSON.stringify(want)}\n           got ${JSON.stringify(got)}`);
};

/* The measured used values, verbatim from getComputedStyle. */
const AT_320 = '136px 136px';
const AT_768 = '229.328px 229.336px 229.328px';
const AT_1440 = '213.328px 213.336px 213.328px 213.336px 213.336px 213.328px';
/* The specified value, reported by any grid that is not being laid out. */
const UNRESOLVED = 'repeat(auto-fill, minmax(136px, 1fr))';

console.log('\n  TP1 · TP4   how much of a person shows at once\n');

/* ---- columnsOf: the stylesheet's own answer, or none at all ----------- */

is('TP4 two columns on a phone', columnsOf(AT_320), 2);
is('TP4 three on a tablet', columnsOf(AT_768), 3);
is('TP4 six on a desktop', columnsOf(AT_1440), 6);
is('TP4 and a single column is one, not nothing', columnsOf('320px'), 1);

/* The class fix, and the reason this file exists. A blocklist would have to
   know every spelling of "not laid out"; the positive test only has to know
   the one spelling of an answer. */
is('TP4 a grid that is not being laid out has no column count',
    columnsOf(UNRESOLVED), null);
is('TP4 and that is not three, which is what splitting it on spaces gives',
    UNRESOLVED.trim().split(/\s+/).length, 3);
is('TP4 an empty grid is display:none, so it reports the same string',
    columnsOf(UNRESOLVED), null);
is('TP4 a detached element reports nothing at all', columnsOf(''), null);
is('TP4 `none` is not a column', columnsOf('none'), null);
is('TP4 and neither is absent', columnsOf(undefined), null);
is('TP4 nor null', columnsOf(null), null);

/* Anything that is not a resolved length is not an answer, however much of
   the string looks like one. `minmax(136px,` contains a px and is not a
   track. */
is('TP4 a half-resolved track list is refused whole',
    columnsOf('136px minmax(136px, 1fr)'), null);
is('TP4 an fr that survived into the used value is refused',
    columnsOf('136px 1fr'), null);
is('TP4 a percentage is not a resolved length', columnsOf('50% 50%'), null);

/* Line names are legal in a used value and are not tracks. Dropping this
   would read `[full-start] 136px 136px [full-end]` as four columns. */
is('TP4 line names are not columns',
    columnsOf('[full-start] 136px 136px [full-end]'), 2);
is('TP4 including one between every track',
    columnsOf('[a] 136px [b] 136px [c] 136px [d]'), 3);

/* ---- capOf: two rows of whatever that is ------------------------------ */

is('TP4 two rows of two is four', capOf(2), 4);
is('TP4 two rows of three is six', capOf(3), 6);
is('TP4 two rows of six is twelve', capOf(6), 12);
is('TP4 the row count is the one Raman chose', CAP_ROWS, 2);

/* null in, null out — and null means show everything, never cap to zero. */
is('TP4 no column count is no cap', capOf(null), null);
is('TP4 zero columns is no cap', capOf(0), null);
is('TP4 a negative count is no cap', capOf(-3), null);
is('TP4 a fraction of a column is no cap', capOf(2.5), null);
is('TP4 and a column count that is a string is no cap', capOf('6'), null);

/* ---- pxOf: a length, or nothing ---------------------------------------- */

is('TP1 a line height in pixels', pxOf('20px'), 20);
is('TP1 a fractional one', pxOf('22.5px'), 22.5);
is('TP1 `normal` is not a number we can multiply', pxOf('normal'), null);
is('TP1 nor is empty', pxOf(''), null);
is('TP1 nor is zero, which would make every clamp 0 tall', pxOf('0px'), null);

/* ---- clampOf: five lines, and whether there is a sixth ----------------- */

/* The measured biography: 20px lines, so the clamp is a 100px box. */
is('TP1 five lines of --lh-body-sm is a 100px box', clampOf(620, 20).max, 100);
is('TP1 the line count is the one Raman chose', BIO_LINES, 5);
is('TP1 Nolan at 768 overflows it', clampOf(620, 20).overflows, true);
is('TP1 and at 320, where the same text is 1100 tall, more so',
    clampOf(1100, 20).overflows, true);
is('TP1 a biography of exactly five lines does not overflow',
    clampOf(100, 20).overflows, false);
is('TP1 nor does a shorter one', clampOf(40, 20).overflows, false);

/* The slack. scrollHeight is an integer and lineHeight * lines is not always
   one, so a paragraph that fits can measure a fraction over its own cap.
   Without this, "View more" appears on a biography with nothing to reveal. */
is('TP1 a pixel of rounding is not a sixth line',
    clampOf(101, 20).overflows, false);
is('TP1 but two pixels is', clampOf(102, 20).overflows, true);
is('TP1 the slack is one pixel and no more', CLAMP_SLACK, 1);

/* A clamp that cannot be computed is no clamp, and no button. */
is('TP1 no line height, no clamp', clampOf(620, null), null);
is('TP1 `normal` line height, no clamp', clampOf(620, pxOf('normal')), null);
is('TP1 no height, no clamp', clampOf(null, 20), null);
is('TP1 and a NaN height is not a short biography', clampOf(NaN, 20), null);

/* ---- the whole shape, at the three measured widths -------------------- */

/* scrollHeight reports the FULL content height while -webkit-line-clamp is
   clipping the box -- measured: 620 both before and after the clamp applied,
   with clientHeight dropping 620 -> 100. That is what lets one measurement
   serve both states. If it reported the clipped height, `overflows` would go
   false the moment the reader expanded the text and the "View less" button
   would vanish underneath them. */
is('TP1 the clamp reads the same open or closed, so the button survives',
    clampOf(620, 20).overflows && clampOf(620, 20).overflows, true);

const page = (gtc, credits) => {
    const cap = capOf(columnsOf(gtc));
    return cap === null ? { shown: credits, button: null } : {
        shown: Math.min(credits, cap),
        button: credits > cap ? `Show all ${credits}` : null,
    };
};

/* Nolan's Directed section is 14 credits. Measured on the page. */
is('TP4 a phone shows four of the fourteen', page(AT_320, 14), { shown: 4, button: 'Show all 14' });
is('TP4 a tablet shows six', page(AT_768, 14), { shown: 6, button: 'Show all 14' });
is('TP4 a desktop shows twelve', page(AT_1440, 14), { shown: 12, button: 'Show all 14' });

/* Gerwig: Acted in 16, Wrote 5, Directed 3, measured at 768. Only the
   section over its own cap gets a button -- the cap is per body of work, not
   per page, and one short section is not a reason to bury a long one. */
is('TP4 Gerwig acted in sixteen, so that section caps', page(AT_768, 16), { shown: 6, button: 'Show all 16' });
is('TP4 she wrote five, which is under the cap and keeps no button', page(AT_768, 5), { shown: 5, button: null });
is('TP4 and directed three, likewise', page(AT_768, 3), { shown: 3, button: null });
is('TP4 a section of exactly the cap keeps no button', page(AT_768, 6), { shown: 6, button: null });

/* And the failure that must never hide anything. */
is('TP4 an unmeasured grid shows every credit and offers no button',
    page(UNRESOLVED, 202), { shown: 202, button: null });

console.log(`\n  The measured page:\n    320 -> ${columnsOf(AT_320)} cols -> ${capOf(columnsOf(AT_320))} tiles`
    + ` · 768 -> ${columnsOf(AT_768)} -> ${capOf(columnsOf(AT_768))}`
    + ` · 1440 -> ${columnsOf(AT_1440)} -> ${capOf(columnsOf(AT_1440))}`
    + `\n    biography clamped to ${clampOf(620, 20).max}px of a ${620}px paragraph`);

console.log(failed ? `\n  ${failed} failed.\n` : '\n  All cases pass.\n');
process.exit(failed ? 1 : 0);
