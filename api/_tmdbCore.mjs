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
 * TMDB connections drop intermittently (ECONNRESET). Without a retry every drop
 * surfaces as a 500 to the user - measured at roughly 40% of dev requests before
 * this existed.
 */
export async function fetchTmdb(path, queryParams, apiKey, { retries = 3 } = {}) {
    const params = new URLSearchParams({ api_key: apiKey, ...queryParams });
    const clean = path.startsWith('/') ? path.slice(1) : path;
    const url = `https://api.themoviedb.org/3/${clean}?${params}`;

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url);
            if (res.status >= 500 || res.status === 429) {
                lastErr = new Error(`TMDB ${res.status}`);
            } else {
                return { status: res.status, data: await res.json() };
            }
        } catch (err) {
            lastErr = err;
        }
        if (attempt < retries) await new Promise(r => setTimeout(r, 250 * 2 ** attempt));
    }
    throw lastErr ?? new Error('TMDB request failed');
}
