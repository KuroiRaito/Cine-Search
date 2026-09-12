// Shared TMDB fetch logic for both the Vercel function (api/tmdb.js) and the
// Vite dev middleware (vite.config.js), so dev and prod behave identically.
// Underscore prefix keeps Vercel from treating this as a route.

export const PATH_RE = /^[a-zA-Z0-9/_-]+$/;

export function validatePath(path) {
    if (!path) return 'Missing path parameter';
    if (!PATH_RE.test(path)) return 'Invalid path';
    return null;
}

/**
 * Fetch from TMDB with retry.
 *
 * TMDB drops connections constantly (ECONNRESET). Measured 2026-09-12 from
 * ap-south: 2 of 3 direct requests were reset, while 6 of 6 through this
 * function succeeded - the retry is doing real work, not defending against a
 * hypothetical.
 *
 * At that failure rate 3 retries still leaves roughly one dead request per
 * page that loads four rails, which is exactly how often a rail was rendering
 * its error state. Hence 5, with the backoff capped so the worst case stays
 * near three seconds rather than eight, and a per-attempt timeout so one hung
 * connection can't eat the whole chain.
 */
export async function fetchTmdb(path, queryParams, apiKey, { retries = 5, timeoutMs = 8000 } = {}) {
    const params = new URLSearchParams({ api_key: apiKey, ...queryParams });
    const clean = path.startsWith('/') ? path.slice(1) : path;
    const url = `https://api.themoviedb.org/3/${clean}?${params}`;

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
            if (res.status >= 500 || res.status === 429) {
                lastErr = new Error(`TMDB ${res.status}`);
            } else {
                return { status: res.status, data: await res.json() };
            }
        } catch (err) {
            lastErr = err;
        }
        if (attempt < retries) {
            await new Promise((r) => setTimeout(r, Math.min(250 * 2 ** attempt, 800)));
        }
    }
    throw lastErr ?? new Error('TMDB request failed');
}
