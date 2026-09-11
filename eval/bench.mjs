// Latency + request-cost benchmark for the CURRENT search path.
// npm run eval:bench   (add --cached to measure warm-cache behaviour)
//
// Answers: how long does one search take, how many TMDB round trips does it
// cost, and how much headroom is there before adding retrievers hurts.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectMode, getMode, withKey, toCanonicalTmdb } from './lib/tmdb-http.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const N = Number(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] || 25);

await detectMode();
const realFetch = globalThis.fetch;
let calls = 0, netMs = 0;

globalThis.fetch = async (url, opts) => {
    calls++;
    const t = performance.now();
    const res = await realFetch(withKey(toCanonicalTmdb(url)), opts);
    netMs += performance.now() - t;
    return res;
};

const { searchOrDiscover } = await import('../src/lib/tmdb.js');
const queries = JSON.parse(readFileSync(join(HERE, 'queries.json'), 'utf8')).queries.slice(0, N);

const UI = { mediaType: 'all', selectedGenre: '', sortBy: 'popularity.desc', minRating: 0, year: '', page: 1, pageSize: 20 };

const rows = [];
for (const q of queries) {
    calls = 0; netMs = 0;
    const t0 = performance.now();
    let n = 0;
    try { n = (await searchOrDiscover(q.query, UI.mediaType, UI)).results.length; } catch { n = -1; }
    rows.push({ query: q.query, cat: q.category, ms: performance.now() - t0, calls, netMs, n });
}

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const ms = rows.map(r => r.ms), cs = rows.map(r => r.calls);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

console.log(`\n  BENCH — current search path (v1), ${rows.length} queries, tmdb: ${getMode()}\n`);
console.log(`  latency/search   p50 ${pct(ms,.5).toFixed(0)}ms   p95 ${pct(ms,.95).toFixed(0)}ms   max ${Math.max(...ms).toFixed(0)}ms`);
console.log(`  TMDB calls/search  avg ${(sum(cs)/cs.length).toFixed(2)}   p95 ${pct(cs,.95)}   max ${Math.max(...cs)}`);
console.log(`  total TMDB calls   ${sum(cs)} for ${rows.length} searches`);
console.log(`  + UI debounce      400ms (useMovieSearch.js) — added to every one of these\n`);

console.log(`  slowest 8:`);
[...rows].sort((a, b) => b.ms - a.ms).slice(0, 8)
    .forEach(r => console.log(`    ${String(Math.round(r.ms)).padStart(5)}ms  ${String(r.calls)} call(s)  ${r.n < 0 ? 'ERR' : r.n + ' results'}  "${r.query}"`));

console.log(`\n  by pagination path:`);
const zero = rows.filter(r => r.n === 0), some = rows.filter(r => r.n > 0);
console.log(`    returned results  n=${some.length}  p50 ${some.length?pct(some.map(r=>r.ms),.5).toFixed(0):'-'}ms  avg ${some.length?(sum(some.map(r=>r.calls))/some.length).toFixed(2):'-'} calls`);
console.log(`    returned nothing  n=${zero.length}  p50 ${zero.length?pct(zero.map(r=>r.ms),.5).toFixed(0):'-'}ms  avg ${zero.length?(sum(zero.map(r=>r.calls))/zero.length).toFixed(2):'-'} calls`);
console.log();
