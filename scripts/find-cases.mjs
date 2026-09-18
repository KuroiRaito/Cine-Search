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
} from '../src/modules/search/normalise.js';

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
    const count = async (q, year) => {
        if (!q) return 0;
        const params = new URLSearchParams({ path: '/search/multi', query: q, include_adult: 'false' });
        if (year) params.set('year', String(year));
        for (let i = 0; i < 3; i += 1) {
            try {
                const r = await fetch(`${base}/api/tmdb?${params}`);
                if (r.ok) return ((await r.json()).results || []).length;
            } catch { /* fall through to the wait */ }
            await new Promise((res) => setTimeout(res, 400 * (i + 1)));
        }
        return null;
    };

    console.log('  Against live TMDB — zero-result rate by category\n');
    console.log('    category       n   as typed   after the rungs');
    const live = {};
    let unmeasured = 0;
    for (const q of set) {
        const c = (live[q.category] ||= { n: 0, raw: 0, done: 0 });
        c.n += 1;
        const first = await count(q.query);
        if (first === null) { unmeasured += 1; continue; }
        if (!first) c.raw += 1;
        let best = first;
        if (!first) {
            for (const attempt of rungs(q.query).slice(1)) {
                const n = await count(attempt.query, attempt.year);
                if (n === null) continue;
                if (n) { best = n; break; }
            }
        }
        if (!best) c.done += 1;
    }
    const pc = (x, n) => `${Math.round((x / n) * 100)}%`;
    let N = 0, R = 0, D = 0;
    for (const [k, c] of Object.entries(live)) {
        N += c.n; R += c.raw; D += c.done;
        console.log(`    ${k.padEnd(13)}${String(c.n).padStart(2)}   ${pc(c.raw, c.n).padStart(6)}   ${pc(c.done, c.n).padStart(6)}`);
    }
    console.log(`    ${'all'.padEnd(13)}${String(N).padStart(2)}   ${pc(R, N).padStart(6)}   ${pc(D, N).padStart(6)}`);
    if (unmeasured) console.log(`\n    ${unmeasured} could not be measured — requests failed, not empty answers.`);
    console.log('');
    await server.close();
}

process.exit(failed ? 1 : 0);
