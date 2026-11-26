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

                return {
                    label,
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

        const rest = cells.find((c) => c.label === 'rest');
        if (!rest?.sig) continue;
        for (const c of cells) {
            if (c.label === 'rest' || !c.sig) continue;
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
