// Disk cache for TMDB responses.
//
// Why: baseline-vs-variant comparison is only valid if both runs saw the same
// catalogue. TMDB's index drifts daily (popularity scores especially), so an
// uncached re-run would mix "my change helped" with "TMDB moved underneath me".
// Cache on by default; `--refresh` busts it when you *want* fresh data.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectMode, getMode, toProxyUrl } from './tmdb-http.mjs';

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache');

let stats = { hits: 0, misses: 0 };

export function resetStats() { stats = { hits: 0, misses: 0 }; }
export function getStats() {
    const total = stats.hits + stats.misses;
    return { ...stats, total, hitRate: total ? stats.hits / total : 0 };
}

function keyFor(url) {
    // Strip the API key so the cache file name never contains a secret,
    // and so rotating the key does not invalidate every cached response.
    const stripped = String(url).replace(/([?&])api_key=[^&]*/, '$1api_key=REDACTED');
    return createHash('sha256').update(stripped).digest('hex').slice(0, 32);
}

/**
 * Wraps globalThis.fetch with a read-through disk cache.
 * Monkey-patching rather than editing src/lib/tmdb.js is deliberate: the harness
 * must measure the production module *unmodified*, or the baseline is not a
 * baseline of anything real.
 */
export async function installCachingFetch({ refresh = false } = {}) {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    const realFetch = globalThis.fetch;
    await detectMode(realFetch);

    globalThis.fetch = async function cachingFetch(url, opts) {
        // Cache key is the ORIGINAL TMDB url, so direct and proxy runs share a
        // cache and stay comparable.
        const file = join(CACHE_DIR, keyFor(url) + '.json');
        const target = getMode() === 'proxy' ? toProxyUrl(url) : url;

        if (!refresh && existsSync(file)) {
            stats.hits++;
            const body = JSON.parse(readFileSync(file, 'utf8'));
            return new Response(JSON.stringify(body), {
                status: 200, headers: { 'content-type': 'application/json' }
            });
        }

        stats.misses++;
        const res = await realFetch(target, opts);
        const text = await res.text();
        if (res.ok) {
            try { writeFileSync(file, JSON.stringify(JSON.parse(text))); } catch { /* non-JSON: skip cache */ }
        }
        return new Response(text, { status: res.status, headers: res.headers });
    };
}
