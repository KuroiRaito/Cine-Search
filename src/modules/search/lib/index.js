// Public search API. The UI and the eval harness both call this and nothing else.
//
// The app runs v2. v1 — the search that shipped, measured at 52% null-and-low
// and MRR 0.47 — is preserved exactly as the baseline, and v2 falls through to
// it for every case it does not handle. The eval harness names a variant
// explicitly so the two can be scored side by side.

import { search as searchV1 } from './v1.js';
import { search as searchV2 } from './v2/index.js';
import { search as searchLadder } from './ladder.js';
import { DEFAULT_SEARCH_OPTS } from './types.js';

export { DEFAULT_SEARCH_OPTS };

export async function search(query, opts = {}, { variant, signal } = {}) {
    if (variant === 'v1' || variant === 'v1-baseline') return searchV1(query, opts, { signal });
    if (variant === 'v2') return searchV2(query, opts, { signal });
    // The app runs the ladder. v2 is still the thing it wraps, and still
    // nameable, so the harness can score the rungs against the search without
    // them.
    return searchLadder(query, opts, { signal });
}
