// Public search API. The UI and the eval harness both call this and nothing else.
//
// v2 is a SIBLING of v1, never a wrapper. Benchmarking showed v1's unified-fill
// loop costs up to 84 TMDB calls / 9.6s on a filtered deep page; wrapping it
// would multiply that by every retriever v2 adds.

import { getSearchVariant, SEARCH_VARIANTS } from '../searchFlags.js';
import { search as searchV1 } from './v1.js';
import { DEFAULT_SEARCH_OPTS } from './types.js';

export { DEFAULT_SEARCH_OPTS, SEARCH_VARIANTS };

export async function search(query, opts = {}, { variant, signal } = {}) {
    const v = variant || getSearchVariant();
    if (v === SEARCH_VARIANTS.V2) {
        const { search: searchV2 } = await import('./v2/index.js');
        return searchV2(query, opts, { signal });
    }
    return searchV1(query, opts, { signal });
}
