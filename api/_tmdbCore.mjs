// Shared TMDB fetch logic for both the Vercel function (api/tmdb.js) and the
// Vite dev middleware (vite.config.js), so dev and prod behave identically.
// Underscore prefix keeps Vercel from treating this as a route.

export const PATH_RE = /^[a-zA-Z0-9/_-]+$/;

/**
 * The TMDB paths this app actually calls, and nothing else.
 *
 * The character check above stops injection; it does not stop use. With only
 * that, anyone holding the app's URL had a free TMDB proxy — every endpoint
 * under /3/, billed to this key and this Vercel account. The list below is
 * every path in src/lib/tmdb/endpoints.js; adding an endpoint there means
 * adding it here, which is the point.
 */
const ALLOWED = [
    /^search\/(movie|tv|multi|person|collection)$/,
    /^discover\/(movie|tv)$/,
    /^genre\/(movie|tv)\/list$/,
    /^trending\/all\/(day|week)$/,
    /^movie\/(now_playing|upcoming|popular|top_rated)$/,
    /^tv\/(on_the_air|airing_today|popular|top_rated)$/,
    /^(movie|tv)\/\d+$/,
    /^(movie|tv)\/\d+\/(credits|aggregate_credits|keywords|videos|recommendations|similar|release_dates|content_ratings|external_ids)$/,
    /^(movie|tv)\/\d+\/watch\/providers$/,
    /^tv\/\d+\/season\/\d+$/,
    /^person\/\d+(\/combined_credits)?$/,
    // One credit_id rehydrates a whole favourite-character card: the character
    // name, the person with their profile_path, and the title with its poster.
    /^credit\/[A-Za-z0-9]+$/,
    /^collection\/\d+$/,
    /^configuration$/,
];

export function validatePath(path) {
    if (!path) return 'Missing path parameter';
    if (!PATH_RE.test(path)) return 'Invalid path';
    const clean = path.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!ALLOWED.some((re) => re.test(clean))) return 'Path not allowed';
    return null;
}

/**
 * True when a request's Origin (or, for same-origin fetches that omit it, its
 * Referer) is the host serving the app. A browser on our own page passes; a
 * script on someone else's page, or curl with no headers, does not.
 *
 * Deliberately a same-host check and not a token: a token in a public bundle
 * is not a secret. This is a fence against casual use of the proxy, not a
 * wall — that would need rate limiting with state, which this app has no
 * reason to carry yet.
 */
export function isSameOrigin(headers = {}) {
    const from = headers.origin || headers.referer;
    if (!from) return false;
    const host = headers['x-forwarded-host'] || headers.host;
    try { return new URL(from).host === host; } catch { return false; }
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
