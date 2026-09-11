// TMDB transport. The ONLY place that talks to the network.
//
// Every call goes to /api/tmdb — the Vercel function in prod, the Vite dev
// middleware locally. Both inject TMDB_API_KEY server-side, so the key never
// reaches the browser.
//
// The fetch implementation is injectable. The eval harness previously patched
// globalThis.fetch, which was fragile: one transient error silently changed the
// transport mid-run and corrupted a whole set of latency measurements.

let fetchImpl = (...args) => globalThis.fetch(...args);

/** Swap the transport (tests, eval harness). Returns a restore function. */
export function setFetchImpl(fn) {
    const prev = fetchImpl;
    fetchImpl = fn;
    return () => { fetchImpl = prev; };
}

export class TmdbError extends Error {
    constructor(message, { status = 0, path = '' } = {}) {
        super(message);
        this.name = 'TmdbError';
        this.status = status;
        this.path = path;
    }
}

export function buildUrl(path, params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        qs.append(k, String(v));
    }
    const q = qs.toString();
    return `/api/tmdb?path=${path}${q ? '&' + q : ''}`;
}

/**
 * GET a TMDB path. Rejects with TmdbError rather than returning a half-empty
 * object, so callers cannot mistake a transport failure for an empty result set
 * — that confusion silently corrupted eval scores once already.
 */
export async function get(path, params = {}, { signal } = {}) {
    let res;
    try {
        res = await fetchImpl(buildUrl(path, params), { signal });
    } catch (err) {
        if (err?.name === 'AbortError') throw err;
        throw new TmdbError(err?.message || 'network error', { path });
    }
    if (!res.ok) throw new TmdbError(`TMDB responded ${res.status}`, { status: res.status, path });
    return res.json();
}
