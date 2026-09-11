// Cine Search eval harness.  npm run eval
//
// Runs the golden query set against the app's real search implementation and
// scores it. Run via vite-node so that src/lib/tmdb.js is imported UNMODIFIED —
// the harness must measure the code the browser actually runs, or the baseline
// measures nothing.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installCachingFetch, getStats, resetStats } from './lib/cache.mjs';
import { getMode } from './lib/tmdb-http.mjs';
import { scoreQuery, aggregate, byCategory } from './lib/metrics.mjs';
import { printReport, saveRun, loadPreviousRun } from './lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, def) => {
    const i = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
    if (i === -1) return def;
    return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1] ?? def;
};

const REFRESH = flag('refresh');
const VARIANT = opt('variant', process.env.VITE_SEARCH_V2 === 'true' ? 'v2' : 'v1-baseline');
const LIMIT = Number(opt('limit', 0));
const COMPARE = opt('compare', null);
const CONCURRENCY = Number(opt('concurrency', 4));

// The exact state a user lands on. Pinned so runs are comparable, and recorded
// in the output so a future reader knows what was measured.
const DEFAULT_UI_STATE = {
    mediaType: 'all', selectedGenre: '', sortBy: 'popularity.desc',
    minRating: 0, year: '', page: 1, pageSize: 20,
};

async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let i = 0, done = 0;
    const total = items.length;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) {
            const idx = i++;
            out[idx] = await fn(items[idx], idx);
            done++;
            if (!process.env.CI) process.stdout.write(`\r  running ${done}/${total}…   `);
        }
    }));
    if (!process.env.CI) process.stdout.write('\r'.padEnd(30) + '\r');
    return out;
}

async function main() {
    const qFile = join(HERE, 'queries.json');
    if (!existsSync(qFile)) {
        console.error(`\n  No query set at eval/queries.json — run: npm run eval:build-set\n`);
        process.exit(1);
    }

    let queries = JSON.parse(readFileSync(qFile, 'utf8')).queries;
    const unlabelled = queries.filter(q => q.answer_type !== 'not_in_catalogue' && !(q.expected || []).length);
    if (unlabelled.length) {
        console.warn(`\n  \x1b[33m${unlabelled.length} of ${queries.length} queries have no labels yet.\x1b[0m`);
        console.warn(`  They are EXCLUDED from this run. Label them: npm run eval:label\n`);
        queries = queries.filter(q => q.answer_type === 'not_in_catalogue' || (q.expected || []).length);
    }
    if (LIMIT) queries = queries.slice(0, LIMIT);
    if (!queries.length) { console.error('  Nothing to score.\n'); process.exit(1); }

    resetStats();
    await installCachingFetch({ refresh: REFRESH });

    // Imported AFTER the fetch patch so its network calls are cached.
    const { searchOrDiscover } = await import('../src/lib/tmdb.js');

    console.log(`\n  ${queries.length} queries · variant "${VARIANT}" · cache ${REFRESH ? 'REFRESH' : 'on'} · tmdb: ${getMode()}`);

    const scores = await mapLimit(queries, CONCURRENCY, async (q) => {
        try {
            const res = await searchOrDiscover(q.query, DEFAULT_UI_STATE.mediaType, DEFAULT_UI_STATE);
            return scoreQuery(q, res.results || []);
        } catch (err) {
            console.error(`\n  error on "${q.query}": ${err.message}`);
            return scoreQuery(q, []);
        }
    });

    const run = {
        run_id: new Date().toISOString(),
        config: { variant: VARIANT, ...DEFAULT_UI_STATE, querySetSize: queries.length },
        cache: getStats(),
        tmdb_mode: getMode(),
        aggregate: aggregate(scores),
        categories: byCategory(scores),
        per_query: scores,
    };

    const prev = COMPARE ? loadPreviousRun(COMPARE) : null;
    printReport(run, prev && prev.run_id !== run.run_id ? prev : null);
    const file = saveRun(run);
    console.log(`  saved → ${file.replace(process.cwd() + '/', '')}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
