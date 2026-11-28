#!/usr/bin/env node
/**
 * The second-fixture pass — is a number that looks like a constant actually one?
 *
 *   npm run fixtures
 *
 * Every measurement in this repo was taken once, against one seeded account.
 * Twice in a day that produced a correct number about the wrong fixture:
 *
 *   B7   "80px shows 8 tiles and 80% of a 9th", "rails 7-13% occupied"
 *        -- measured on a shelf holding one film, where PREVIEW = 8 means the
 *        ninth tile it described cannot exist. Both numbers were artifacts of
 *        the seed, and both were used to argue for a design change.
 *
 *   B11  the expanded avatar "overlaps the banner by 48px" came back at 44.
 *        The arithmetic was right; `align-items: center` was centring the
 *        avatar's MARGIN BOX in a flex line whose height came from the text
 *        beside it. So the overlap was a function of the user's bio -- 44px
 *        against an empty one, 24px against a four-line one. It read as a
 *        constant because every measurement of it used the same one-line seed.
 *
 * Both were found by hand, by changing the fixture and measuring again, and
 * nothing in the repo did that. This does. It renders a relationship between
 * two boxes under several deliberately different fixtures and fails when the
 * value moves -- because a geometric relationship that moves with content was
 * never the constant somebody wrote down.
 *
 * The claims live in `scripts/fixtures-registry.js`, which `verify` check 26
 * also reads. Two halves of one gate:
 *
 *   check 26   you cannot WRITE a new overlap without declaring it
 *   this       a declared overlap cannot SLIDE without failing
 *
 * ---------------------------------------------------------------------------
 * WHAT MAKES THIS A GATE AND NOT A RITUAL
 *
 * Four ways it fails, and the last is the one that matters:
 *
 *   NO SUCH BOX  a selector matched nothing. An absent relationship is not a
 *                passing one -- CLAUDE.md §7's most expensive class.
 *   SLIDES       the value differs between fixtures. The bug.
 *   WRONG        the value is stable but is not what the design states.
 *   VACUOUS      the fixtures did not stress anything -- the `stress` box came
 *                out the same size under all of them, so a stable value proves
 *                nothing at all.
 *
 * VACUOUS exists because this repo has already shipped a check that compared a
 * long label against a short one and measured a difference of zero, because
 * both were broken (CLAUDE.md §6.3). A fixture axis that does not move the box
 * it is supposed to move is that same check wearing different clothes. So each
 * relationship names the box its fixtures are meant to resize, and this
 * refuses to report a pass until it has watched that box change.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT RENDERS, AND THE LIMIT OF THAT
 *
 * The real stylesheets, every one of them, inlined into a page served from
 * memory -- the same mechanism as `docs/as-built.html`, and for the same
 * reason: it cannot drift from the code because it IS the code. No dev server,
 * no Supabase, no TMDB, no credentials. That is what lets it sit in CI beside
 * `gallery:audit` rather than outside it beside `snap`.
 *
 * The markup, though, is written in the registry rather than taken from the
 * product -- nothing can render real JSX with a layout engine in CI. So this
 * measures the CSS relationship, NOT the product's DOM. If `Identity.jsx`
 * stopped nesting `.pav` inside `.pav-row`, every relationship would still
 * pass while the product broke. Check 26 narrows that hole -- it fails when a
 * class named in the registry stops appearing in the JSX at all -- and does
 * not close it. Nesting is unguarded. Said plainly rather than assumed away.
 *
 * Fonts are deliberately NOT inlined. tokens.css loads its faces with
 * `@import '@fontsource/...'`, which only a bundler resolves, so those are
 * stripped and a fallback stack is set explicitly. That is not a weakness
 * here, it is a fourth fixture: the whole claim of this pass is that these
 * values do not depend on text metrics. A relationship that holds in IBM Plex
 * and slides in the fallback is one this pass SHOULD fail, and would.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { RELATIONSHIPS } from './fixtures-registry.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ---------------------------------------------------------------
   Every stylesheet, discovered rather than listed.

   `scripts/gallery.mjs` names its five in a const, which is right for the
   gallery -- it draws shared controls and has no business carrying search's
   module CSS. This is the opposite: a relationship lives inside a module, so
   a module whose sheet is missing is a module this pass silently cannot see.
   Walking the tree means a new module is covered the day it is written.
   --------------------------------------------------------------- */
function sheetsUnder(dir, out = []) {
    for (const e of readdirSync(join(ROOT, dir))) {
        const rel = `${dir}/${e}`;
        if (statSync(join(ROOT, rel)).isDirectory()) sheetsUnder(rel, out);
        else if (e.endsWith('.css')) out.push(rel);
    }
    return out;
}
const SHEETS = sheetsUnder('src').sort();

/* C7.7 again. A walker that finds nothing passes everything, which is how
   `if (ROLES.size)` once shipped a check that silently approved the whole
   tree. The count is a floor, not the exact number, so adding a module does
   not fail this -- losing most of them does. */
if (SHEETS.length < 8) {
    console.error(`\n  Only ${SHEETS.length} stylesheets found under src/.`
        + '\n  That is fewer than this repo has, so the walker is broken and every'
        + '\n  relationship would be measured against missing CSS.\n');
    process.exit(1);
}

/* tokens.css's `@import '@fontsource/...'` resolves in a bundler and nowhere
   else. Left in, the browser requests a bare specifier, fails, and falls back
   SILENTLY -- CLAUDE.md §8. Stripped and replaced below, the fallback is a
   decision with a name on it. */
const css = SHEETS.map(read).join('\n').replace(/@import\s+'[^']+';?/g, '');

const html = (body) => `<!doctype html><html lang="en" data-theme="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}</style>
<style>
  /* Named, not accidental -- see the header. A stack that resolves the same
     way on every machine is what keeps the measurement reproducible. */
  :root { --f-d: sans-serif; --f-b: sans-serif; --f-s: sans-serif; --f-m: monospace; }
  body { margin: 0; }
</style></head>
<body><main class="app-main"><div class="page">${body}</div></main></body></html>`;

const pages = new Map();
const server = createServer((req, res) => {
    const body = pages.get(req.url);
    res.writeHead(body ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body ?? '');
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const origin = `http://127.0.0.1:${server.address().port}`;

/* `getBoundingClientRect` rather than a computed style, because CLAUDE.md §6.2
   is in this repo for a reason: the plus that looked off-centre was not
   off-centre, and only the rect said so. */
const PROBE = ([of, against, stress]) => {
    const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
            top: r.top, bottom: r.bottom, left: r.left, right: r.right,
            w: Math.round(r.width), h: Math.round(r.height),
            /* The child count is part of the stress signature, not decoration.
               A COUNT fixture changes the DOM and need not change the box: a
               `display: flex` span that is block-level is 1280px wide holding
               two faces or three. Without this the count axis reports VACUOUS
               for exactly the fixtures it exists to prove. */
            n: el.children.length,
        };
    };
    return { of: box(of), against: box(against), stress: box(stress) };
};

const browser = await chromium.launch();
const results = [];

for (const [i, rel] of RELATIONSHIPS.entries()) {
    const ctx = await browser.newContext({ viewport: { width: rel.width, height: 900 } });
    const p = await ctx.newPage();
    const rows = [];
    for (const [label, content] of rel.vary) {
        const url = `/${i}-${rows.length}`;
        pages.set(url, html(rel.markup(content)));
        await p.goto(origin + url);
        const r = await p.evaluate(PROBE, [rel.of, rel.against, rel.stress]);
        const missing = ['of', 'against', 'stress'].filter((k) => !r[k]);
        rows.push({
            label,
            missing: missing.map((k) => rel[k]),
            /* Rounded once, here, rather than compared as floats: half a pixel
               from a fractional line-height is not a sliding relationship. */
            value: missing.length ? null
                : Math.round(rel.axis === 'x'
                    ? r.against.right - r.of.left
                    : r.against.bottom - r.of.top),
            stress: missing.length ? null : `${r.stress.w}x${r.stress.h}/${r.stress.n}`,
        });
    }
    results.push({ rel, rows });
    await ctx.close();
}
await browser.close();
server.close();

/* ---------------------------------------------------------------
   Report. Every relationship is printed whether it held or not -- the point of
   this pass is that both fixtures can be SEEN, so printing only failures would
   leave the next person taking one number off one seed again.
   --------------------------------------------------------------- */
const slides = [];
const wrong = [];
const vacuous = [];
const broken = [];

const renders = RELATIONSHIPS.reduce((n, r) => n + r.vary.length, 0);
console.log(`\n  ${RELATIONSHIPS.length} relationships · ${renders} renders · `
    + `${SHEETS.length} stylesheets\n`);

for (const { rel, rows } of results) {
    const miss = rows.find((r) => r.missing.length);
    const values = [...new Set(rows.map((r) => r.value))];
    const stresses = new Set(rows.map((r) => r.stress));

    const moved = !miss && values.length > 1;
    const off = !miss && !moved && values[0] !== rel.expect;
    const flat = !miss && stresses.size < 2;

    if (miss) broken.push({ rel, miss });
    else if (moved) slides.push({ rel, rows });
    else if (off) wrong.push({ rel, got: values[0] });
    else if (flat) vacuous.push({ rel, rows });

    const verdict = miss ? 'NO SUCH BOX' : moved ? 'SLIDES'
        : off ? 'WRONG' : flat ? 'VACUOUS' : 'holds';
    console.log(`  ${verdict === 'holds' ? ' ' : '!'} ${rel.id}   [${verdict}]`);
    console.log(`      ${rel.of} against ${rel.against} @${rel.width}`
        + `${rel.axis === 'x' ? ' · sideways' : ''} — says ${rel.expect}px`);
    for (const r of rows) {
        console.log(`      ${String(r.value ?? '—').padStart(5)}px  `
            + `${rel.stress} ${String(r.stress ?? '—').padEnd(13)}  ${r.label}`);
    }
    console.log('');
}

let failed = false;

if (broken.length) {
    console.log('  NO SUCH BOX — the markup no longer renders what it names\n');
    for (const { rel, miss } of broken) {
        console.log(`    ${rel.id}`);
        console.log(`      ${miss.missing.join(', ')} matched nothing`);
    }
    console.log('\n  A relationship that cannot find its boxes is not holding, it is absent.\n');
    failed = true;
}

if (slides.length) {
    console.log('  SLIDES — a value that is supposed to be a constant moved with the fixture\n');
    for (const { rel, rows } of slides) {
        const vs = rows.map((r) => r.value);
        console.log(`    ${rel.id}`);
        console.log(`      ${rel.says}`);
        console.log(`      ${Math.min(...vs)}px to ${Math.max(...vs)}px across ${rows.length} fixtures`);
        console.log('      A geometric relationship must not be expressed through a value');
        console.log('      something else can resize — CLAUDE.md §7.');
    }
    console.log('');
    failed = true;
}

if (wrong.length) {
    console.log('  WRONG — stable, but not the number the design states\n');
    for (const { rel, got } of wrong) {
        console.log(`    ${rel.id}`);
        console.log(`      ${rel.says}`);
        console.log(`      measured ${got}px, expected ${rel.expect}px`);
    }
    console.log('');
    failed = true;
}

if (vacuous.length) {
    console.log('  VACUOUS — the fixtures stressed nothing, so holding proves nothing\n');
    for (const { rel, rows } of vacuous) {
        console.log(`    ${rel.id}`);
        console.log(`      ${rel.stress} measured ${rows[0].stress} under all ${rows.length} fixtures.`);
        console.log('      Either the fixture axis is wrong or the box it names is not the one');
        console.log('      the content lands in. A check that has only ever compared a thing to');
        console.log('      itself has not been tested — CLAUDE.md §6.3.');
    }
    console.log('');
    failed = true;
}

if (!failed) {
    console.log(`  All ${RELATIONSHIPS.length} hold under every fixture, and every fixture`
        + '\n  moved the box it names.\n');
}

process.exit(failed ? 1 : 0);
