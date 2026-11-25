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
                return {
                    label,
                    sig: paint.map((p) => cs.getPropertyValue(p)).join('|')
                        + `|${r.width.toFixed(1)}x${r.height.toFixed(1)}`,
                };
            });
            out.push({ name, cells });
        }
        return out;
    }, PAINT);

    for (const { name, cells } of rows) {
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
process.exit(0);
