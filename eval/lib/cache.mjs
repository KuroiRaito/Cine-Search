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
import { detectMode, getMode, toProxyUrl, withKey, toCanonicalTmdb } from './tmdb-http.mjs';

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache');

let stats = { hits: 0, misses: 0, errors: 0 };

export function resetStats() { stats = { hits: 0, misses: 0, errors: 0 }; }
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
        // Normalise first: src/lib/tmdb.js emits app-relative /api/tmdb URLs,
        // which Node cannot fetch. Canonical form is also the cache key, so
        // direct and proxy runs share a cache and stay comparable.
        const canonical = toCanonicalTmdb(url);
        const file = join(CACHE_DIR, keyFor(canonical) + '.json');
        const target = getMode() === 'proxy' ? toProxyUrl(canonical) : withKey(canonical);

        if (!refresh && existsSync(file)) {
            stats.hits++;
            const body = JSON.parse(readFileSync(file, 'utf8'));
            return new Response(JSON.stringify(body), {
                status: 200, headers: { 'content-type': 'application/json' }
            });
        }

        stats.misses++;
        // Retry transient network failures. Without this a dropped connection is
        // indistinguishable from "search returned nothing" and silently corrupts
        // the score - which is worse than a crash, because it looks like data.
        let res, lastErr;
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                res = await realFetch(target, opts);
                if (res.status >= 500 || res.status === 429) {
                    lastErr = new Error(`HTTP ${res.status}`);
                    await new Promise(r => setTimeout(r, 400 * 2 ** attempt));
                    continue;
                }
                lastErr = null;
                break;
            } catch (e) {
                lastErr = e;
                await new Promise(r => setTimeout(r, 400 * 2 ** attempt));
            }
        }
        if (lastErr) { stats.errors++; throw lastErr; }
        const text = await res.text();
        if (res.ok) {
            try { writeFileSync(file, JSON.stringify(JSON.parse(text))); } catch { /* non-JSON: skip cache */ }
        }
        return new Response(text, { status: res.status, headers: res.headers });
    };
}
