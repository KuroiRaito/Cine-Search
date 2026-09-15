#!/usr/bin/env node
/**
 * Per-module screenshots and layout fingerprints.
 *
 *   npm run snap                     every module
 *   npm run snap -- title person     just those
 *   npm run snap -- --check          compare against the committed fingerprints
 *
 * Why this exists: the design work on this project kept drifting, and nobody
 * could see it until a person opened the app and scrolled. A module's pull
 * request should carry its own before-and-after, and the reviewer should see
 * that module and only that module.
 *
 * Two outputs, for two different jobs:
 *
 *   snapshots/<module>/<screen>@<width>-<theme>.png   for a human to look at
 *   snapshots/fingerprints.json                       for a machine to compare
 *
 * The images are gitignored. A full-page capture at 1280 is about 2 MB, and a
 * full sweep is over a hundred of them — committing those would put hundreds of
 * megabytes into git history forever, to show something a reviewer can
 * regenerate in a minute. The fingerprints are tiny and are committed.
 *
 * The fingerprint is the position and size of every element on the screen,
 * hashed. It is not a pixel diff: it ignores artwork, which changes whenever
 * TMDB's trending list does, and catches the thing pixels are bad at telling
 * you — that a box moved. This is the same comparison that caught the desktop
 * top bar vanishing during the module carve.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'snapshots');
const FINGERPRINTS = join(OUT, 'fingerprints.json');

/* One representative screen per module, and the widths that change its shape.
   390 is the phone, 900 the tablet band the design system never drew, 1280 the
   desktop three-column layout. */
const MODULES = {
    entry:    [{ name: 'cover', path: '/welcome', guest: true },
               { name: 'signin', path: '/welcome/signin', guest: true },
               // The steps a person actually gets stuck on. `username` and
               // `reset` are not here: both need a session behind them, and a
               // guest visiting either is sent away by design.
               { name: 'signup', path: '/welcome/signup', guest: true },
               { name: 'forgot', path: '/welcome/forgot', guest: true }],
    discover: [{ name: 'home', path: '/' }],
    search:   [{ name: 'results', path: '/search?q=zimmer' }],
    title:    [{ name: 'series', path: '/title/tv/1396' },
               { name: 'film', path: '/title/movie/27205' }],
    person:   [{ name: 'director', path: '/person/137427' }],
    library:  [{ name: 'library', path: '/library' }],
    you:      [{ name: 'taste', path: '/you' },
               { name: 'settings', path: '/settings' }],
};
const WIDTHS = [390, 900, 1280];
const THEMES = ['dark', 'light'];

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const wanted = args.filter((a) => !a.startsWith('--'));
const modules = Object.keys(MODULES).filter((m) => !wanted.length || wanted.includes(m));

/**
 * Every element's box, hashed. Artwork-independent, layout-sensitive.
 *
 * An immediately-invoked expression, not a function literal: page.evaluate()
 * treats a string as an EXPRESSION, so a bare `() => {…}` is returned rather
 * than called, and every fingerprint came back as an empty object.
 *
 * Everything under #root, not under `.app`: the cover and the auth screens
 * render outside the shell, and scoping to `.app` fingerprinted them as zero
 * elements — a screen that could change freely without the check noticing.
 */
const FINGERPRINT = `(() => {
    const parts = [];
    for (const el of document.querySelectorAll('#root *')) {
        const r = el.getBoundingClientRect();
        const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).sort().join('.') : '';
        parts.push(el.tagName + '.' + cls + '|' + Math.round(r.x) + ',' + Math.round(r.y + scrollY)
                 + ',' + Math.round(r.width) + ',' + Math.round(r.height));
    }
    let h = 0;
    for (const c of parts.join('\\n')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return { elements: parts.length, hash: h.toString(16) };
})()`;

const server = await createServer({ root: ROOT, server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = `http://localhost:${server.config.server.port ?? server.httpServer.address().port}`;

const browser = await chromium.launch();
const results = {};
let shots = 0;

try {
    for (const mod of modules) {
        mkdirSync(join(OUT, mod), { recursive: true });
        for (const screen of MODULES[mod]) {
            for (const theme of THEMES) {
                const ctx = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 } });
                const page = await ctx.newPage();
                // Signing in is the app's own flow, not a fixture: the snapshot
                // should show what a signed-in person sees.
                if (!screen.guest && process.env.SNAP_EMAIL) {
                    await page.goto(`${base}/welcome/signin`, { waitUntil: 'networkidle' });
                    await page.fill('input[type=email]', process.env.SNAP_EMAIL);
                    await page.fill('input[type=password]', process.env.SNAP_PASSWORD ?? '');
                    await page.click('button[type=submit]');
                    await page.waitForURL((u) => !u.pathname.startsWith('/welcome'), { timeout: 20000 }).catch(() => {});
                } else {
                    // Skip the cover for everything that is not the cover.
                    await page.goto(base, { waitUntil: 'domcontentloaded' });
                    if (!screen.guest) await page.evaluate(() => localStorage.setItem('cine_seen_cover', '1')).catch(() => {});
                }

                for (const width of WIDTHS) {
                    await page.setViewportSize({ width, height: 900 });
                    await page.goto(base + screen.path, { waitUntil: 'networkidle' });
                    await page.waitForTimeout(600);
                    const key = `${mod}/${screen.name}@${width}-${theme}`;
                    results[key] = await page.evaluate(FINGERPRINT);
                    await page.screenshot({ path: join(OUT, mod, `${screen.name}@${width}-${theme}.png`), fullPage: true });
                    shots++;
                }
                await ctx.close();
            }
        }
        process.stdout.write(`  ${mod}\n`);
    }
} finally {
    await browser.close();
    await server.close();
}

if (CHECK) {
    if (!existsSync(FINGERPRINTS)) {
        console.log('\n  No committed fingerprints to compare against. Run without --check first.\n');
        process.exit(1);
    }
    const before = JSON.parse(readFileSync(FINGERPRINTS, 'utf8'));
    const moved = Object.entries(results).filter(([k, v]) =>
        before[k] && (before[k].hash !== v.hash || before[k].elements !== v.elements));
    const added = Object.keys(results).filter((k) => !before[k]);
    if (moved.length) {
        console.log('\n  LAYOUT CHANGED\n');
        for (const [k, v] of moved) {
            console.log(`    ${k}`);
            console.log(`      was ${before[k].elements} elements ${before[k].hash}`);
            console.log(`      now ${v.elements} elements ${v.hash}`);
        }
        console.log('\n  Intended? Commit the new snapshots and fingerprints.\n');
        process.exit(1);
    }
    console.log(`\n  ${Object.keys(results).length} screens unchanged${added.length ? `, ${added.length} new` : ''}.\n`);
} else {
    const merged = existsSync(FINGERPRINTS)
        ? { ...JSON.parse(readFileSync(FINGERPRINTS, 'utf8')), ...results }
        : results;
    // Sorted into a new object, not passed as JSON.stringify's replacer: an
    // array there filters keys at every level, which silently emptied every
    // value the first time this ran.
    const sorted = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
    mkdirSync(OUT, { recursive: true });
    writeFileSync(FINGERPRINTS, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`\n  ${shots} screenshots → snapshots/\n`);
}
