// Public search API. The UI and the eval harness both call this and nothing else.
//
// The app always runs v1 — the plain TMDB search that shipped. No flags, no env
// var, no URL override: one path, so search behaves the same everywhere until we
// deliberately come back to it.
//
// The eval harness is the one caller that may ask for another variant, by
// passing { variant } explicitly. Nothing in the app does.

import { search as searchV1 } from './v1.js';
import { DEFAULT_SEARCH_OPTS } from './types.js';

export { DEFAULT_SEARCH_OPTS };

export async function search(query, opts = {}, { variant, signal } = {}) {
    if (variant === 'v2') {
        const { search: searchV2 } = await import('./v2/index.js');
        return searchV2(query, opts, { signal });
    }
    return searchV1(query, opts, { signal });
}
