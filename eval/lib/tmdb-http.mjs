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
        try {
            const r = await realFetch(`https://api.themoviedb.org/3/configuration?api_key=${KEY}`);
            if (r.ok) return (mode = 'direct');
        } catch { /* fall through */ }
    }
    return (mode = 'proxy');
}

export function getMode() { return mode; }

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
