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
    // A different transport means different answers; nothing cached under the
    // old one may be served under the new one.
    clearCache();
    return () => { fetchImpl = prev; clearCache(); };
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

/* ---------------------------------------------------------------
   Session cache.

   Measured before this existed: navigating Discover → a title → back fetched
   all four rails again; the You screen fetched twelve people on every visit;
   React's dev double-mount fetched everything twice. A five-minute session was
   ~30 requests, nearly all for data that had not changed.

   One Map, keyed by the exact URL, holding the PROMISE rather than the data:
   two callers asking for the same URL at the same moment share one request.
   The underlying fetch never takes a caller's abort signal — if it did, the
   first caller unmounting would poison the shared result for the second,
   which is precisely what the dev double-mount does. Each caller's signal is
   honoured on its own wrapper instead (withSignal), so useAsync's semantics
   are unchanged: an aborted caller sees AbortError, and the fetch completes
   for whoever is still listening.

   Failures are never cached. Entities that do not change while you look at
   them keep for half an hour; feeds and searches for five minutes.
   --------------------------------------------------------------- */

const CACHE = new Map();      // url -> { expires, promise }
const MAX_ENTRIES = 200;

function ttlFor(path) {
    const p = String(path).replace(/^\/+/, '');
    if (/^(movie|tv|person|collection)\/\d+/.test(p)) return 30 * 60_000;
    if (/^(genre|configuration)/.test(p)) return 24 * 3_600_000;
    return 5 * 60_000;
}

const abortError = () => {
    const e = new Error('The operation was aborted');
    e.name = 'AbortError';
    return e;
};

/** Reject when `signal` fires, without touching the shared promise. */
function withSignal(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
        const onAbort = () => reject(abortError());
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then(
            (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
            (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
        );
    });
}

/** Drop everything. Called when the transport is swapped (tests, eval). */
export function clearCache() {
    CACHE.clear();
}

async function fetchJson(url, path) {
    let res;
    try {
        res = await fetchImpl(url);
    } catch (err) {
        throw new TmdbError(err?.message || 'network error', { path });
    }
    if (!res.ok) throw new TmdbError(`TMDB responded ${res.status}`, { status: res.status, path });
    return res.json();
}

/**
 * GET a TMDB path. Rejects with TmdbError rather than returning a half-empty
 * object, so callers cannot mistake a transport failure for an empty result set
 * — that confusion silently corrupted eval scores once already.
 *
 * `fresh: true` bypasses the session cache for one call.
 */
export async function get(path, params = {}, { signal, fresh = false } = {}) {
    const url = buildUrl(path, params);
    const now = Date.now();
    const hit = CACHE.get(url);
    if (!fresh && hit && hit.expires > now) return withSignal(hit.promise, signal);

    const promise = fetchJson(url, path);
    CACHE.set(url, { expires: now + ttlFor(path), promise });
    while (CACHE.size > MAX_ENTRIES) CACHE.delete(CACHE.keys().next().value);
    // A failed request must not be served from the cache — and a rejection
    // nobody is listening to (every caller aborted) must not surface as an
    // unhandled rejection either.
    promise.catch(() => { if (CACHE.get(url)?.promise === promise) CACHE.delete(url); });

    return withSignal(promise, signal);
}
