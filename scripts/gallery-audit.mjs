#!/usr/bin/env node
/**
 * Does the state actually DO anything?
 *
 * The gallery draws every control in every state it owes. That makes a gap
 * visible, but only to somebody looking carefully at sixty cells in two
 * themes — which is the same attention that missed a star sitting on top of a
 * number on every poster in the product for months.
 *
 * So this looks instead. It opens the gallery, reads back the computed style
 * of every specimen in every state, and compares each one to that specimen's
 * rest cell. A state whose paint is byte-identical to rest is a state the
 * stylesheet never answered: hover that gives no feedback, disabled that
 * looks enabled, selected that cannot be seen.
 *
 * It reports rather than fails. Which gaps matter is a design decision --
 * `.score-badge` has no business having a hover state. The point is that
 * nobody has to notice.
 *
 *   npm run gallery:audit
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGE = join(ROOT, 'docs/as-built.html');

/* Everything that can make one state look different from another. If a state
   changes none of these and moves no box, it changed nothing. */
const PAINT = [
    'background-color', 'background-image', 'color', 'border-color', 'border-width',
    'box-shadow', 'outline-color', 'outline-width', 'outline-style', 'opacity',
    'transform', 'filter', 'text-decoration-line', 'font-weight',
];

const html = readFileSync(PAGE, 'utf8');
const server = createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const findings = [];
const offCentre = [];
const contentBreaks = [];
const sizing = [];
const overflows = [];
let geometryFailed = false;

for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url);
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    const rows = await page.evaluate((paint) => {
        const out = [];
        for (const row of document.querySelectorAll('.g-row')) {
            const name = row.querySelector('.g-name code')?.textContent || '?';
            const cells = [...row.querySelectorAll('.g-cell')].map((c) => {
                const el = c.querySelector('.g-stage > *');
                const label = c.querySelector('.g-state')?.textContent || '?';
                if (!el) return { label, sig: null };
                const cs = getComputedStyle(el);
                const r = el.getBoundingClientRect();

                /* Geometry. A control whose whole content is one glyph is
                   making a promise -- that the glyph is in the middle -- and
                   the promise is checkable. Anything with text in it is not
                   making that promise, so it is skipped. */
                let centring = null;
                const svgs = el.querySelectorAll('svg');
                const text = el.textContent.replace(/\s+/g, '');
                if (svgs.length === 1 && !text) {
                    const g = svgs[0].getBoundingClientRect();
                    if (g.width && g.height) {
                        centring = {
                            dx: (g.left - r.left) - (r.right - g.right),
                            dy: (g.top - r.top) - (r.bottom - g.bottom),
                            box: `${r.width.toFixed(0)}x${r.height.toFixed(0)}`,
                            glyph: `${g.width.toFixed(0)}x${g.height.toFixed(0)}`,
                        };
                    }
                }

                /* A control often answers a state on something inside
                   itself -- `.tile:hover .art` brightens the poster, not the
                   link. Reading only the subject's own paint reported that
                   as a hover which changes nothing, which is the opposite of
                   what it does. The signature covers the subtree. */
                const sub = [...el.querySelectorAll('*')].slice(0, 40).map((d) => {
                    const ds = getComputedStyle(d);
                    return paint.map((p) => ds.getPropertyValue(p)).join('~');
                }).join('/');

                /* Content stress.

                   The first version of this compared a content cell to the
                   control's rest cell and asked whether it grew. It passed
                   with the production bug reinstated, because rest holds the
                   cross too: both cells grew by the same 16px and the delta
                   was zero. A check can look right and prove nothing.

                   So the invariant is absolute, not relative. `white-space:
                   nowrap` is the stylesheet saying this control is one line.
                   One line has a height that can be computed from the
                   control's own box -- line-height, padding, border -- and
                   anything taller means something inside took a line of its
                   own. That is the filter-chip bug, and it is true of the
                   chip whatever words are in it.

                   Applied to every cell, not only content cells: a control
                   that is the wrong height with a short label is already
                   broken, it just has not met a long one yet. */
                let stress = null;
                {
                    const cs2 = getComputedStyle(el);
                    if (cs2.whiteSpace === 'nowrap' && r.height) {
                        const px = (v) => parseFloat(v) || 0;
                        const lh = cs2.lineHeight === 'normal'
                            ? px(cs2.fontSize) * 1.2 : px(cs2.lineHeight);
                        const chrome = px(cs2.paddingTop) + px(cs2.paddingBottom)
                            + px(cs2.borderTopWidth) + px(cs2.borderBottomWidth);
                        const oneLine = Math.max(lh + chrome, px(cs2.minHeight));
                        if (r.height > oneLine + 1.5) {
                            stress = {
                                tall: Math.round((r.height - oneLine) * 10) / 10,
                                is: Math.round(r.height), should: Math.round(oneLine),
                            };
                        }
                    }
                    /* A child whose box leaves its parent's, and content cut
                       off with nothing to say so. Both are losses a person
                       sees; neither depends on a baseline. */
                    /* A container that scrolls an axis is SUPPOSED to hold
                       more than fits on it -- that is what a rail is. So
                       spill is only counted on an axis the container does
                       not scroll, and clipping is only a loss when the
                       content cannot be reached by scrolling to it. */
                    const scrollsX = ['auto', 'scroll'].includes(cs2.overflowX);
                    const scrollsY = ['auto', 'scroll'].includes(cs2.overflowY);
                    let spill = 0;
                    for (const d of el.querySelectorAll('*')) {
                        const b = d.getBoundingClientRect();
                        if (!b.width && !b.height) continue;
                        if (!scrollsY) spill = Math.max(spill, r.top - b.top, b.bottom - r.bottom);
                        if (!scrollsX) spill = Math.max(spill, r.left - b.left, b.right - r.right);
                    }
                    const ell = cs2.textOverflow === 'ellipsis'
                        || [...el.querySelectorAll('*')].some((d) => getComputedStyle(d).textOverflow === 'ellipsis');
                    const clipped = (el.scrollWidth > el.clientWidth + 1) && !ell
                        && !scrollsX && cs2.overflow !== 'visible';
                    if (spill > 1 || clipped) {
                        stress = { ...(stress || {}), spill: Math.round(spill * 10) / 10, clipped };
                    }
                }

                /* Composition. A collection drawn at several counts, and
                   the one thing that must not vary: the size of an item.

                   An item's size depending on how many items are beside it
                   is the signature of `auto-fit` (one tile stretched across
                   the page) or of a flex child that can grow (two posters as
                   two half-screens). Both are one word away from true in any
                   stylesheet, and nothing here would have noticed. */
                let composed = null;
                if (c.dataset.count !== undefined) {
                    const n = Number(c.dataset.count);
                    const first = el.firstElementChild;
                    const fb = first ? first.getBoundingClientRect() : null;
                    composed = {
                        n,
                        w: fb ? Math.round(fb.width * 10) / 10 : null,
                        h: fb ? Math.round(fb.height * 10) / 10 : null,
                        /* Does the collection run past its own visible box?
                           Reported, never failed: .chips and .rail set
                           `overflow-x: auto` with `scrollbar-width: none` on
                           purpose, so this is a judgement about affordance,
                           not a defect. */
                        over: Math.max(0, el.scrollWidth - el.clientWidth),
                        scrolls: ['auto', 'scroll'].includes(getComputedStyle(el).overflowX),
                        drewNothing: n === 0 && el.getBoundingClientRect().height > 0 && !el.children.length,
                    };
                }

                return {
                    label,
                    content: c.dataset.content ?? null,
                    composed,
                    stress,
                    centring,
                    sig: paint.map((p) => cs.getPropertyValue(p)).join('|')
                        + `|${r.width.toFixed(1)}x${r.height.toFixed(1)}`
                        + `|${sub}`,
                };
            });
            out.push({ name, cells });
        }
        return out;
    }, PAINT);

    for (const { name, cells } of rows) {
        for (const c of cells) {
            if (!c.centring) continue;
            const { dx, dy } = c.centring;
            /* Half a pixel. Below that it is a subpixel rounding artefact of
               the layout engine; at or above it, something in the box is
               pushing the glyph off and a person can see it. */
            if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) {
                offCentre.push({ theme, name, state: c.label, ...c.centring });
            }
        }

        {
            const cs = cells.filter((c) => c.composed && c.composed.n > 0 && c.composed.w);
            if (cs.length > 1) {
                const ws = cs.map((c) => c.composed.w);
                const lo = Math.min(...ws), hi = Math.max(...ws);
                if (hi - lo > 1) {
                    const at = cs.map((c) => `${c.composed.n}:${c.composed.w}px`).join('  ');
                    sizing.push({ theme, name, why: `an item's width changes with the count -- ${at}` });
                }
                const hs = cs.map((c) => c.composed.h);
                if (Math.max(...hs) - Math.min(...hs) > 1) {
                    const at = cs.map((c) => `${c.composed.n}:${c.composed.h}px`).join('  ');
                    sizing.push({ theme, name, why: `an item's height changes with the count -- ${at}` });
                }
            }
            for (const c of cells) {
                if (!c.composed) continue;
                if (c.composed.over > 1) {
                    overflows.push({ theme, name, n: c.composed.n, px: c.composed.over, scrolls: c.composed.scrolls });
                }
                if (c.composed.drewNothing) {
                    sizing.push({ theme, name, why: 'at 0 items it still takes vertical space and draws nothing -- an empty state has to be rendered in its place' });
                }
            }
        }

        for (const c of cells) {
            if (!c.stress) continue;
            const why = [];
            if (c.stress.tall) {
                why.push(`declares one line but is ${c.stress.is}px tall, not ${c.stress.should}px`
                    + ` -- ${c.stress.tall}px of something taking its own line`);
            }
            if (c.stress.spill > 1) why.push(`content spills ${c.stress.spill}px outside the control`);
            if (c.stress.clipped) why.push('clipped with no ellipsis -- the end is lost silently');
            if (why.length) contentBreaks.push({ theme, name, content: c.content ?? c.label, why });
        }

        const rest = cells.find((c) => c.label === 'rest');
        if (!rest?.sig) continue;
        for (const c of cells) {
            if (c.label === 'rest' || !c.sig) continue;
            /* A content cell is a different question -- it is the same state
               with different contents, so of course its paint matches rest.
               That is the point of it, not a finding. */
            if (c.content !== null) continue;
            if (c.sig === rest.sig) findings.push({ theme, name, state: c.label });
        }
    }
    await page.close();
}
await browser.close();
server.close();

const byName = new Map();
for (const f of findings) {
    const k = `${f.name}\u0000${f.state}`;
    byName.set(k, [...(byName.get(k) || []), f.theme]);
}

/* Reported first, because it fails rather than informs. A state the
   stylesheet never answered is a design decision somebody can defend; a glyph
   sitting off-centre inside its own button is not. */
console.log('\nGLYPHS THAT ARE NOT CENTRED IN THEIR OWN CONTROL\n');
{
    const seen = new Map();
    for (const f of offCentre) {
        const k = `${f.name}\u0000${f.state}`;
        if (!seen.has(k)) seen.set(k, f);
    }
    if (!seen.size) {
        console.log('  none. Every icon-only control centres its glyph on both axes.\n');
    } else {
        console.log(`  ${'control'.padEnd(22)}${'state'.padEnd(12)}${'box'.padEnd(10)}${'glyph'.padEnd(10)}off by`);
        console.log('  ' + '-'.repeat(72));
        for (const [, f] of [...seen].sort()) {
            const off = [
                Math.abs(f.dx) >= 0.5 ? `${(f.dx / 2).toFixed(1)}px ${f.dx > 0 ? 'right' : 'left'}` : '',
                Math.abs(f.dy) >= 0.5 ? `${(f.dy / 2).toFixed(1)}px ${f.dy > 0 ? 'down' : 'up'}` : '',
            ].filter(Boolean).join(', ');
            console.log(`  ${f.name.padEnd(22)}${f.state.padEnd(12)}${f.box.padEnd(10)}${f.glyph.padEnd(10)}${off}`);
        }
        console.log(`\n  ${seen.size} control(s). This is never intentional.\n`);
        geometryFailed = true;
    }
}

/* Reported with the geometry, and failing like it: a control that cannot
   hold what the product puts in it is broken, not under-designed. */
console.log('\nCOLLECTIONS WHOSE ITEMS CHANGE SIZE WITH THE COUNT\n');
{
    const seen = new Map();
    for (const f of sizing) if (!seen.has(f.name + f.why)) seen.set(f.name + f.why, f);
    if (!seen.size) {
        console.log('  none. An item is the same size whether it has one neighbour or twenty.\n');
    } else {
        for (const [, f] of seen) console.log(`  ${f.name}\n      ${f.why}`);
        console.log(`\n  ${seen.size}. An item's size must not depend on how many are beside it.\n`);
        geometryFailed = true;
    }
}

/* Reported, not failed. A row that runs past its edge may be a deliberate
   scroller or may be hiding the eighth filter where nobody will find it, and
   which one it is depends on whether anything tells the reader to scroll. */
console.log('\nCOLLECTIONS THAT RUN PAST THEIR OWN EDGE\n');
{
    const seen = new Map();
    for (const f of overflows) {
        const k = `${f.name}\u0000${f.n}`;
        if (!seen.has(k)) seen.set(k, f);
    }
    if (!seen.size) console.log('  none.\n');
    else {
        for (const [, f] of [...seen].sort()) {
            console.log(`  ${f.name.padEnd(28)} at ${String(f.n).padStart(2)} items: ${f.px}px past the edge`
                + (f.scrolls ? ' (scrolls -- is there anything saying so?)' : ' (DOES NOT SCROLL -- that content is unreachable)'));
        }
        console.log('');
    }
}

console.log('\nCONTROLS THAT BREAK ON REAL CONTENT\n');
{
    const seen = new Map();
    for (const f of contentBreaks) {
        const k = `${f.name}\u0000${f.content}`;
        if (!seen.has(k)) seen.set(k, f);
    }
    if (!seen.size) {
        console.log('  none. Every content case keeps its control the shape it was.\n');
    } else {
        for (const [, f] of [...seen].sort()) {
            console.log(`  ${f.name}  --  ${f.content}`);
            for (const w of f.why) console.log(`      ${w}`);
        }
        console.log(`\n  ${seen.size} break(s). Content is not an edge case.\n`);
        geometryFailed = true;
    }
}

console.log('\nSTATES THAT RENDER IDENTICALLY TO REST — the stylesheet never answered them\n');
if (!byName.size) {
    console.log('  none. Every state drawn in the gallery changes something.\n');
} else {
    console.log(`  ${'control'.padEnd(22)}${'state'.padEnd(16)}themes`);
    console.log('  ' + '-'.repeat(52));
    for (const [k, themes] of [...byName].sort()) {
        const [name, state] = k.split('\u0000');
        console.log(`  ${name.padEnd(22)}${state.padEnd(16)}${themes.join(' + ')}`);
    }
    console.log(`\n  ${byName.size} gap(s). Which of them matter is a design decision —`);
    console.log('  see docs/CONTROLS.md C1. This reports; it does not fail.\n');
}
/* Paint gaps report. Geometry fails: a crooked glyph has no defence. */
process.exit(geometryFailed ? 1 : 0);
