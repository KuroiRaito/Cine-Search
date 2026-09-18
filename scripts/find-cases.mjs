#!/usr/bin/env node
/**
 * The normaliser, held to the golden set.
 *
 *   npm run find            the rules, offline — no network, no TMDB
 *   npm run find -- --live  and then the 120 queries against live TMDB
 *
 * §11 of the Find design: "Word lists are in this document; they belong in one
 * file with the golden set as its test." This is that test.
 *
 * Two halves, deliberately. The rules half is pure and instant, and it is where
 * a regression gets caught. The live half is the only thing that can say
 * whether the rules still rescue what they claimed — TMDB's index moves, so a
 * number measured in September is evidence, not a guarantee, and it is worth
 * re-running rather than trusting.
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
    INTENT, PARTICLES, stripIntent, stripParticles, splitYear, rungs,
    prefixes, MIN_PREFIX, isCorrectionOf,
} from '../src/modules/search/normalise.js';
import { parseFacets, isBrowse, chipsOf } from '../src/modules/search/facets.js';

/* TMDB's film list, which is what a search with no medium chosen offers. Fixed
   here so the rules half stays offline; the app fetches it. */
const GENRES = [
    { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' }, { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' }, { id: 14, name: 'Fantasy' },
    { id: 36, name: 'History' }, { id: 27, name: 'Horror' }, { id: 10402, name: 'Music' },
    { id: 9648, name: 'Mystery' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Science Fiction' },
    { id: 10770, name: 'TV Movie' }, { id: 53, name: 'Thriller' }, { id: 10752, name: 'War' },
    { id: 37, name: 'Western' },
];
const vocab = { genres: GENRES };
const facets = (q) => chipsOf(parseFacets(q, vocab).matched).map((m) => `${m.kind}:${m.label}`).join(' ');

const LIVE = process.argv.includes('--live');
const set = JSON.parse(readFileSync(new URL('../eval/queries.json', import.meta.url), 'utf8')).queries;

let failed = 0;
const is = (label, got, want) => {
    const ok = got === want;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) console.log(`          want ${JSON.stringify(want)}\n           got ${JSON.stringify(got)}`);
};

console.log('\n  The three silent rungs\n');

/* ---- rung 1, and the trap in calling it a word list ------------------- */

is('rung 1  drops the filler and keeps the name',
    stripIntent('christopher nolan movies'), 'christopher nolan');
is('rung 1  a phrase is not a word — "all parts" cannot be split and matched',
    stripIntent('avengers all parts'), 'avengers');
is('rung 1  nor can "in order"',
    stripIntent('harry potter in order'), 'harry potter');
is('rung 1  the singular the design\'s printed list leaves out',
    stripIntent('koi acchi thriller movie'), 'koi acchi thriller');
is('rung 1  "movie" in the languages this product is for — Hinglish',
    stripIntent('hindi comedy picture'), 'hindi comedy');
is('rung 1  Tamil',
    stripIntent('tamil thriller padam'), 'tamil thriller');
is('rung 1  and Hindi',
    stripIntent('purani hindi filme'), 'purani hindi');
is('rung 1  removes whole words only — "by" must not eat "Bye Bye Birdie"',
    stripIntent('bye bye birdie'), 'bye bye birdie');
is('rung 1  and does not eat a title that IS the filler word',
    stripIntent('the show'), 'the');
is('rung 1  leaves a clean query alone',
    stripIntent('inception'), 'inception');

/* ---- rung 1b, the paste nobody can currently make --------------------- */

is('rung 1b a pasted year, in brackets',
    JSON.stringify(splitYear('inception (2010)')), '{"query":"inception","year":2010}');
is('rung 1b and without them',
    JSON.stringify(splitYear('Inception 2010')), '{"query":"Inception","year":2010}');
is('rung 1b a year no film could have been released in is part of the title',
    JSON.stringify(splitYear('blade runner 2049')), '{"query":"blade runner 2049","year":null}');
is('rung 1b and one that could be is a year',
    JSON.stringify(splitYear('dune (2021)')), '{"query":"dune","year":2021}');
is('rung 1b a year that is the whole query is a title',
    JSON.stringify(splitYear('2012')), '{"query":"2012","year":null}');
is('rung 1b and a number that is not a year is left alone',
    JSON.stringify(splitYear('district 9')), '{"query":"district 9","year":null}');

/* ---- rung 2 ----------------------------------------------------------- */

is('rung 2  particles around a name',
    stripParticles(stripIntent('salman bhai ki movie')), 'salman');
is('rung 2  keeps a name that contains one as a substring',
    stripParticles('kiki delivery service'), 'kiki delivery service');

/* ---- the ladder ------------------------------------------------------- */

is('ladder  a clean query makes exactly one attempt',
    rungs('inception').length, 1);
is('ladder  and never repeats itself',
    rungs('dune movie').map((a) => a.query).join(' → '), 'dune movie → dune');
is('ladder  runs 0, 1, 1b, 2 in that order',
    rungs('salman bhai ki movie 2010').map((a) => String(a.rung)).join(','), '0,1,1b,2');

/* ---- rung 3, and the ordering bug the simulation found ----------------- */

console.log('');
is('rung 3  a misspelt name truncates, longest first',
    prefixes('intersteller').slice(0, 2).join(','), 'interstelle,interstell');
is('rung 3  and stops at six — below that a correction becomes a new search',
    prefixes('intersteller').at(-1).length, MIN_PREFIX);
is('rung 3  a six-letter misspelling cannot be truncated at all',
    prefixes('titanc').length, 0);
is('rung 3  which is why titanc is one of the five only a dictionary reaches',
    prefixes('dangl').length, 0);

is('gate    a genre is a kind of thing, not a misspelt name',
    isBrowse('hindi comedy', vocab), true);
is('gate    "movies from the 90s" is a browse — the case that broke the ladder',
    isBrowse('from the 90s', vocab), true);
is('gate    and a misspelt title is not',
    isBrowse('intersteller', vocab), false);
is('gate    nor is a name that merely looks like one',
    isBrowse('gladaitor', vocab), false);
is('gate    a genre word inside a title is not a facet — the design\'s own false positive',
    isBrowse('the family man', vocab), false);
is('gate    and neither is the partial of it',
    isBrowse('the family m', vocab), false);

is('facets  language and genre together',
    facets('hindi comedy'), 'genre:Comedy language:hindi');
is('facets  Tamil',
    facets('tamil thriller'), 'genre:Thriller language:tamil');
is('facets  a decade',
    facets('from the 90s'), 'decade:1990s');
is('facets  purani is a date range, per the golden set\'s own label rule',
    facets('purani hindi'), 'language:hindi decade:before 2000');
is('facets  a runtime',
    facets('under 2 hours'), 'runtime:under 120 min');
is('facets  a rating band',
    facets('telugu rated above 8'), 'language:telugu rating:8+');
is('facets  acchi is one rung of rating, per the same label rule',
    facets('acchi thriller'), 'genre:Thriller rating:7+');
is('facets  south is four languages',
    JSON.stringify(parseFacets('south action', vocab).matched.find((m) => m.kind === 'language').value),
    '["ta","te","ml","kn"]');
is('facets  single-select genre — two is an AND, and an AND of two is four films',
    parseFacets('action comedy', vocab).matched.filter((m) => m.kind === 'genre').length, 1);
is('facets  a mood word is not a genre — sad is not Drama',
    facets('sad war'), 'genre:War');
is('facets  and a plain title parses as nothing',
    facets('breaking bad'), '');

/* ---- what the rules do to the whole set ------------------------------- */

const cats = {};
for (const q of set) {
    const c = (cats[q.category] ||= { n: 0, touched: 0 });
    c.n += 1;
    if (rungs(q.query).length > 1) c.touched += 1;
}
console.log('\n  Queries the silent rungs change at all\n');
for (const [k, c] of Object.entries(cats)) {
    console.log(`    ${k.padEnd(12)} ${String(c.touched).padStart(2)} of ${c.n}`);
}
const touched = Object.values(cats).reduce((n, c) => n + c.touched, 0);
console.log(`    ${'all'.padEnd(12)} ${touched} of ${set.length}`);
is('  exact titles are never touched — the rungs cannot hurt what works',
    cats.exact_title.touched, 0);
is('  nor are partials',
    cats.partial.touched, 0);

/* The ordering bug, counted. Truncation used to run on anything the silent
   rungs could not answer — 44 of the 120, which is a third of the set being
   "corrected" when most of it was never misspelt. */
const after = set.map((q) => ({ q, left: rungs(q.query).at(-1).query }));
const browse = after.filter((x) => isBrowse(x.left, vocab));
const truncate = after.filter((x) => !isBrowse(x.left, vocab) && prefixes(x.left).length);
console.log('\n  Where the ladder sends a query the silent rungs could not answer\n');
console.log(`    parses as facets, goes to Browse   ${browse.length}`);
console.log(`    a name to truncate                 ${truncate.length}`);
console.log(`    neither — the honest exit          ${set.length - browse.length - truncate.length}`);
const byCat = (list) => [...new Set(list.map((x) => x.q.category))].sort().join(', ');
console.log(`\n    Browse:    ${byCat(browse)}`);
is('  no exact title is ever sent to Browse',
    browse.some((x) => x.q.category === 'exact_title'), false);
is('  and no typo is either — a misspelling is a name, not a kind',
    browse.some((x) => x.q.category === 'typo'), false);

console.log(`\n  ${INTENT.length} intent terms, ${PARTICLES.length} particles.`);
console.log(failed ? `\n  ${failed} failed.\n` : '\n  All rules pass.\n');

/* ---- and then, only if asked, the index itself ------------------------ */

if (LIVE) {
    const { createServer } = await import('vite');
    const server = await createServer({
        root: fileURLToPath(new URL('..', import.meta.url)), server: { port: 0 }, logLevel: 'error',
    });
    await server.listen();
    const base = `http://localhost:${server.config.server.port ?? server.httpServer.address().port}`;

    /* A failed request and an empty answer look identical and mean opposite
       things — the module's own point, and the bug its author hit while
       measuring. Retry, and never count a failure as a zero. */
    const ask = async (q, year) => {
        if (!q) return { n: 0, top: null };
        const params = new URLSearchParams({ path: '/search/multi', query: q, include_adult: 'false' });
        if (year) params.set('year', String(year));
        for (let i = 0; i < 3; i += 1) {
            try {
                const r = await fetch(`${base}/api/tmdb?${params}`);
                if (r.ok) {
                    const rows = (await r.json()).results || [];
                    return { n: rows.length, top: rows[0]?.title || rows[0]?.name || null };
                }
            } catch { /* fall through to the wait */ }
            await new Promise((res) => setTimeout(res, 400 * (i + 1)));
        }
        return null;
    };
    const count = async (q, year) => (await ask(q, year))?.n ?? null;

    console.log('  Against live TMDB — zero-result rate by category\n');
    console.log('    category       n   as typed   after the ladder   browse   truncated');
    const live = {};
    let unmeasured = 0;
    for (const q of set) {
        const c = (live[q.category] ||= { n: 0, raw: 0, done: 0, browse: 0, cut: 0, cutQ: [] });
        c.n += 1;
        const first = await count(q.query);
        if (first === null) { unmeasured += 1; continue; }
        if (!first) c.raw += 1;
        let best = first;
        let how = null;
        if (!first) {
            for (const attempt of rungs(q.query).slice(1)) {
                const n = await count(attempt.query, attempt.year);
                if (n === null) continue;
                if (n) { best = n; how = `rung ${attempt.rung}`; break; }
            }
        }
        const left = rungs(q.query).at(-1).query;
        if (!best && isBrowse(left, vocab)) { best = 1; how = 'browse'; c.browse += 1; }
        if (!best) {
            /* Rung 3, and only now: truncation is for a name somebody spelled
               wrong, and the gate above has just established this is one. */
            for (const candidate of prefixes(left)) {
                const hit = await ask(candidate);
                if (hit === null) continue;
                // A correction is a prefix of the answer, not merely a query
                // that returned rows.
                if (hit.n && isCorrectionOf(candidate, hit.top)) {
                    best = hit.n; how = 'rung 3'; c.cut += 1; break;
                }
            }
        }
        if (!best) c.done += 1;
        if (how === 'rung 3') c.cutQ.push(`${q.query}`);
    }
    const pc = (x, n) => `${Math.round((x / n) * 100)}%`;
    let N = 0, R = 0, D = 0;
    for (const [k, c] of Object.entries(live)) {
        N += c.n; R += c.raw; D += c.done;
        console.log(`    ${k.padEnd(13)}${String(c.n).padStart(2)}   ${pc(c.raw, c.n).padStart(6)}   ${pc(c.done, c.n).padStart(12)}   ${String(c.browse).padStart(6)}   ${String(c.cut).padStart(9)}`);
    }
    const B = Object.values(live).reduce((n, c) => n + c.browse, 0);
    const C = Object.values(live).reduce((n, c) => n + c.cut, 0);
    console.log(`    ${'all'.padEnd(13)}${String(N).padStart(2)}   ${pc(R, N).padStart(6)}   ${pc(D, N).padStart(12)}   ${String(B).padStart(6)}   ${String(C).padStart(9)}`);
    const cuts = Object.values(live).flatMap((c) => c.cutQ);
    if (cuts.length) console.log(`\n    truncation rescued: ${cuts.join(', ')}`);
    if (unmeasured) console.log(`\n    ${unmeasured} could not be measured — requests failed, not empty answers.`);
    console.log('');
    await server.close();
}

process.exit(failed ? 1 : 0);
