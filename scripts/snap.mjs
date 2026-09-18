#!/usr/bin/env node
/**
 * Per-module screenshots and layout fingerprints.
 *
 *   npm run snap                     every module
 *   npm run snap -- title person     just those
 *   npm run snap -- --check          compare against the committed fingerprints
 *   npm run snap -- --record         re-record the frozen TMDB responses
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
 *   snapshots/tmdb-fixtures.json.gz                   so the machine gets the same page twice
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
import { gzipSync, gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'snapshots');
const FINGERPRINTS = join(OUT, 'fingerprints.json');
const FIXTURES = join(OUT, 'tmdb-fixtures.json.gz');

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
    profile:  [{ name: 'profile', path: '/you' },
               { name: 'settings', path: '/settings' }],
};
const WIDTHS = [390, 900, 1280];
const THEMES = ['dark', 'light'];

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const RECORD = args.includes('--record');

/**
 * Every third-party response, frozen.
 *
 * This is the fix the previous version of this comment described and deferred.
 * A fingerprint is meant to be a fact about the code, and it was not: `title`
 * moved twelve fingerprints in a week because TMDB added twenty recommendations
 * to Breaking Bad, and `discover` could not agree with itself across three
 * consecutive runs — 579, 576, then 756 elements. A check that goes red for
 * reasons nobody caused teaches everyone to ignore it.
 *
 * The old note assumed this needed two passes, because the screenshots want
 * real artwork. It does not. Freezing the JSON does not freeze the pictures:
 * image.tmdb.org is left alone, so every poster and still still loads over the
 * network exactly as before. What is pinned is *which* ones — and a reviewer
 * comparing two runs of a module wants that pinned anyway.
 *
 *   npm run snap -- --record      re-record from live TMDB and Wikipedia
 *
 * Re-record when an endpoint changes or a screen starts asking for something
 * new; a request with no fixture falls through to the network and is listed at
 * the end, so a stale set says so rather than going quietly wrong.
 */
const NOT_COMPARED = new Set();
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

/* ---------------------------------------------------------------
   A session, and a library behind it.

   Every screen here used to be photographed as a guest, because signing in
   needed real credentials in SNAP_EMAIL and nobody sets them. So two whole
   modules were fingerprinted at their sign-in state and nothing else:

       library/library@390-dark     41 elements
       profile/profile@390-dark     41 elements
       title/series@390-dark       346 elements

   41 is the sign-in wall. The library's shelves, its chip row, its compact
   rows and its sort sheet were uncovered, as was every screen in profile —
   which is how a change to the chip, a shared class both modules draw with,
   moved exactly zero fingerprints.

   The session is fabricated rather than obtained: the same shape Supabase
   returns, written into the storage key its client reads. That makes the
   signed-in screens deterministic in a way a real account never could be,
   because a real library changes whenever somebody ticks an episode.

   SNAP_EMAIL still wins when it is set. A real account photographs the real
   thing; this photographs the layout, which is what a fingerprint is for.
   --------------------------------------------------------------- */

/* The storage key Supabase's client reads is sb-<project-ref>-auth-token, and
   the ref comes from VITE_SUPABASE_URL — which this process does not have.
   Vite loads .env for the app, not for the script that starts Vite, so
   process.env.VITE_SUPABASE_URL is undefined here and the obvious fallback
   writes sb-project-auth-token: a key nothing reads, a session nothing sees,
   and a screen that photographs its own sign-in wall while reporting success.
   It is asked of the server instead, once it is up. */
let REF = 'project';
const UID = '11111111-2222-3333-4444-555555555555';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/* Fixed, not now(): an expiry computed from the clock is a different string
   every run, and the client would refresh at a different moment each time. */
const EXPIRES_AT = 4102444800;   // 2100-01-01, comfortably in the future
const USER = {
    id: UID, aud: 'authenticated', role: 'authenticated', email: 'snap@cinesearch.test',
    email_confirmed_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
    identities: [{ id: UID, provider: 'email' }], is_anonymous: false,
};
const SESSION = {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
        sub: UID, aud: 'authenticated', role: 'authenticated',
        exp: EXPIRES_AT, iat: EXPIRES_AT - 3600, session_id: 'snap',
    })}.sig`,
    refresh_token: 'snap', token_type: 'bearer', expires_in: 3600,
    expires_at: EXPIRES_AT, user: USER,
};
const PROFILE = {
    id: UID, username: 'snap', region: 'US', services: [], theme: null,
    display_name: 'Snapshot', bio: null, avatar_colour: 'acc', joined_at: '2026-01-01T00:00:00Z',
};

/* A library small enough to read and wide enough to draw every shape the
   screens have: a series in progress, a series not started, a film watched
   with a rating, and one wanted. Dates are fixed for the same reason the
   expiry is. */
const shelfRow = (id, media, status, o = {}) => ({
    tmdb_id: id, media_type: media, status, rating: o.rating ?? null,
    is_favourite: o.fav ?? false, favourite_order: null,
    watched_episodes: o.watched || {}, rewatch_count: 0,
    recommended_by: null, recommended_at: null, notes: null,
    added_at: '2026-01-02T00:00:00Z', started_at: null, completed_at: null,
    updated_at: '2026-01-03T00:00:00Z',
    catalog_titles: {
        title: o.title, release_date: o.date || '2020-01-01', poster_path: o.poster || '/snap.jpg',
        number_of_episodes: o.eps || 0, seasons: o.seasons || null,
    },
});
const LIBRARY = [
    shelfRow(1396, 'tv', 'watching', {
        title: 'Breaking Bad', date: '2008-01-20', eps: 62,
        seasons: [{ n: 1, c: 7 }, { n: 2, c: 13 }], watched: { 1: [1, 2, 3] },
    }),
    shelfRow(1399, 'tv', 'want_to_watch', { title: 'Game of Thrones', date: '2011-04-17', eps: 73 }),
    shelfRow(155, 'movie', 'watched', { title: 'The Dark Knight', date: '2008-07-16', rating: 9, fav: true }),
    shelfRow(27205, 'movie', 'want_to_watch', { title: 'Inception', date: '2010-07-15' }),
];

const reply = (route, body) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(body),
});

async function pinSession(ctx) {
    /* Catch-all FIRST: Playwright matches the most recently added route, so a
       general pattern registered last silently shadows every specific one. */
    await ctx.route('**/rest/v1/**', (r) => reply(r, []));
    await ctx.route('**/rest/v1/rpc/**', (r) => reply(r, {}));
    await ctx.route('**/rest/v1/rpc/profile_stats**', (r) => reply(r, {
        films: 1, series: 2, episodes: 3, hours: 4, ratings: 1, favourites: 1,
    }));
    await ctx.route('**/rest/v1/profiles**', (r) => reply(r, [PROFILE]));
    await ctx.route('**/rest/v1/user_library**', (r) => {
        const asked = /status=eq\.([a-z_]+)/.exec(r.request().url());
        return reply(r, asked ? LIBRARY.filter((x) => x.status === asked[1]) : LIBRARY);
    });
    await ctx.route('**/auth/v1/**', (r) => reply(r, { user: USER, session: SESSION }));
    await ctx.addInitScript(([key, value]) => {
        localStorage.setItem(key, value);
    }, [`sb-${REF}-auth-token`, JSON.stringify(SESSION)]);
    /* A fingerprint that silently measures the wrong screen is worse than no
       fingerprint, so this asserts rather than hopes. */
    if (!REF) throw new Error('cannot fabricate a session without the Supabase project ref');
}

const server = await createServer({ root: ROOT, server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = `http://localhost:${server.config.server.port ?? server.httpServer.address().port}`;

REF = (server.config.env?.VITE_SUPABASE_URL || '').split('//')[1]?.split('.')[0] || '';
if (!REF) {
    console.log('\n  No VITE_SUPABASE_URL — the signed-in screens will photograph their sign-in wall.\n');
}

const browser = await chromium.launch();
const results = {};
let shots = 0;

/* TMDB is keyed by its query string — client.js builds every call as
   /api/tmdb?path=<path>&<params>, and the dev server's port changes per run so
   the rest of the URL is not stable. Wikidata and Wikipedia are keyed by the
   whole URL, because that is what identifies them. */
const fixtures = !RECORD && existsSync(FIXTURES)
    ? JSON.parse(gunzipSync(readFileSync(FIXTURES)).toString('utf8'))
    : {};
const recorded = {};
const missed = new Set();

const keyOf = (url) => {
    const u = new URL(url);
    return u.pathname === '/api/tmdb' ? u.search.replace(/^\?/, '') : url;
};

/* Wikipedia arrives after the page has drawn and changes its height by a line.
   Left live, it would put the fingerprints back where they were before they
   were pinned — and worse, because the article text itself is edited. */
const THIRD_PARTY = ['**/api/tmdb**', '**wikidata.org/**', '**wikipedia.org/**'];

/* TMDB answers the provider and certification questions for every country it
   knows, and a title page renders exactly one. Keeping all of them made the
   recorded set twice the size to no effect on a single pixel. Everything a
   screen actually draws is kept whole — the cast list is 218 KB on Inception
   and stays 218 KB, because trimming it would make the fingerprint measure a
   shorter page than the one people load. */
const REGIONS = ['US', 'IN'];
function trim(body) {
    let data;
    try { data = JSON.parse(body); } catch { return body; }
    for (const field of ['watch/providers', 'release_dates', 'content_ratings']) {
        const block = data[field];
        if (!block?.results) continue;
        block.results = Array.isArray(block.results)
            ? block.results.filter((r) => REGIONS.includes(r.iso_3166_1))
            : Object.fromEntries(Object.entries(block.results).filter(([k]) => REGIONS.includes(k)));
    }
    return JSON.stringify(data);
}

async function pinThirdParty(ctx) {
    for (const pattern of THIRD_PARTY) await ctx.route(pattern, async (route) => {
        const key = keyOf(route.request().url());
        const hit = fixtures[key];
        if (hit) {
            return route.fulfill({ status: hit.status, contentType: 'application/json', body: hit.body });
        }
        missed.add(key);
        const res = await route.fetch();
        const body = await res.text();
        if (RECORD) recorded[key] = { status: res.status(), body: trim(body) };
        return route.fulfill({ status: res.status(), contentType: 'application/json', body });
    });
}

try {
    for (const mod of modules) {
        mkdirSync(join(OUT, mod), { recursive: true });
        for (const screen of MODULES[mod]) {
            for (const theme of THEMES) {
                const ctx = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 900 } });
                await pinThirdParty(ctx);
                /* The guest screens stay guests — the cover and the auth steps
                   are what a signed-out person sees, and that is the point of
                   them. */
                if (!screen.guest && !process.env.SNAP_EMAIL) await pinSession(ctx);
                const page = await ctx.newPage();
                /* useRegion asks ipapi.co where the browser is, and the answer
                   decides which TMDB requests the app makes at all — two
                   recordings taken minutes apart differed by two endpoints
                   because of it. Snap is not testing geolocation, so it says
                   where it is and the lookup never happens. */
                await page.addInitScript(() => localStorage.setItem('user_region', 'US'));
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
                    /* The signed-in screens make two round trips before they
                       have anything to draw — the profile, then the library —
                       so the settle is longer than the 600ms a guest needed. A
                       fingerprint taken mid-load is a fingerprint of a
                       skeleton. */
                    await page.waitForTimeout(1500);
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

if (RECORD) {
    writeFileSync(FIXTURES, gzipSync(JSON.stringify(recorded), { level: 9 }));
    const kb = Math.round(readFileSync(FIXTURES).length / 1024);
    const wiki = Object.keys(recorded).filter((k) => k.startsWith('http')).length;
    console.log(`\n  Recorded ${Object.keys(recorded).length} responses`
        + ` (${Object.keys(recorded).length - wiki} TMDB, ${wiki} Wikidata/Wikipedia), ${kb} KB.\n`);
    process.exit(0);
}

if (missed.size) {
    console.log(`\n  ${missed.size} request(s) had no fixture and went to the network:`);
    for (const k of [...missed].slice(0, 8)) console.log(`    ${k}`);
    console.log('  Those screens are measuring live data. Re-record: npm run snap -- --record\n');
}

if (CHECK) {
    if (!existsSync(FINGERPRINTS)) {
        console.log('\n  No committed fingerprints to compare against. Run without --check first.\n');
        process.exit(1);
    }
    const before = JSON.parse(readFileSync(FINGERPRINTS, 'utf8'));
    const comparable = Object.fromEntries(
        Object.entries(results).filter(([k]) => !NOT_COMPARED.has(k.split('/')[0])),
    );
    const skipped = Object.keys(results).length - Object.keys(comparable).length;
    const moved = Object.entries(comparable).filter(([k, v]) =>
        before[k] && (before[k].hash !== v.hash || before[k].elements !== v.elements));
    const added = Object.keys(comparable).filter((k) => !before[k]);
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
    console.log(`\n  ${Object.keys(comparable).length} screens unchanged`
        + `${added.length ? `, ${added.length} new` : ''}`
        + `${skipped ? `, ${skipped} not compared (live data)` : ''}.\n`);
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
