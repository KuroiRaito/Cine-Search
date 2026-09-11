// Decides how the harness reaches TMDB.
//
// Preferred: direct with a local API key (fastest).
// Fallback:  through the deployed /api/tmdb proxy, which holds a valid key
//            server-side. Also the path production actually uses.
//
// Either way src/lib/tmdb.js is untouched - we rewrite at the fetch layer.

const PROXY = process.env.EVAL_TMDB_PROXY || 'https://v0-cine-search.vercel.app/api/tmdb';
// Un-prefixed TMDB_API_KEY is preferred: a VITE_-prefixed var is bundled into
// client JS and publicly readable, which is how the previous key leaked.
const KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;

let mode = null;

export async function detectMode(realFetch = fetch) {
    if (mode) return mode;
    if (KEY) {
        // Retry: a single transient ECONNRESET must not silently downgrade the
        // whole run to proxy mode, which would change measured latency.
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const r = await realFetch(`https://api.themoviedb.org/3/configuration?api_key=${KEY}`);
                if (r.ok) return (mode = 'direct');
                if (r.status === 401) break;          // genuinely bad key
            } catch { /* transient - retry */ }
            await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
    }
    return (mode = 'proxy');
}

export function getMode() { return mode; }

/**
 * src/lib/tmdb.js now emits app-relative "/api/tmdb?path=..." URLs in every
 * environment. Node has no origin to resolve those against, so normalise them
 * back to a canonical TMDB url (no key) - used both as the cache key and as the
 * basis for the real request.
 */
export function toCanonicalTmdb(url) {
    const raw = String(url);
    if (raw.startsWith('http')) {
        const u = new URL(raw);
        u.searchParams.delete('api_key');
        return u.toString();
    }
    const u = new URL(raw, 'http://local');
    const path = u.searchParams.get('path') || '';
    u.searchParams.delete('path');
    u.searchParams.delete('api_key');
    const rest = u.searchParams.toString();
    const clean = path.startsWith('/') ? path : '/' + path;
    return `https://api.themoviedb.org/3${clean}${rest ? '?' + rest : ''}`;
}

/**
 * src/lib/tmdb.js builds its dev URLs from import.meta.env.VITE_TMDB_API_KEY,
 * which is intentionally absent. Inject the real key here so the harness can
 * run the production module unmodified instead of editing it.
 */
export function withKey(url) {
    const u = new URL(String(url));
    if (!u.hostname.includes('themoviedb.org')) return String(url);
    u.searchParams.set('api_key', KEY);
    return u.toString();
}

/** Rewrite a direct TMDB URL to go through the deployed proxy. */
export function toProxyUrl(url) {
    const u = new URL(String(url));
    if (!u.hostname.includes('themoviedb.org')) return String(url);
    const path = u.pathname.replace(/^\/3/, '');
    u.searchParams.delete('api_key');
    const rest = u.searchParams.toString();
    return `${PROXY}?path=${path}${rest ? '&' + rest : ''}`;
}

/** Build a TMDB request URL appropriate to the current mode. */
export function tmdbUrl(path, params = {}) {
    const qs = new URLSearchParams(params);
    if (mode === 'direct') {
        qs.set('api_key', KEY);
        return `https://api.themoviedb.org/3${path}?${qs}`;
    }
    const rest = qs.toString();
    return `${PROXY}?path=${path}${rest ? '&' + rest : ''}`;
}
