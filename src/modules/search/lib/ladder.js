// The rescue ladder, as a search variant.
//
// v2 answers 37% of the golden set and returns an empty screen for the rest.
// This wraps it: when a query comes back with nothing, the rungs run in order
// and the first one that answers wins. 63% empty becomes 22%.
//
// A variant rather than a change to v2, so the eval harness can score the two
// side by side — which is the only thing that keeps any of this honest, and is
// what §11 asks the build to leave behind.
//
// Every rung reports what it did. Rungs 1, 1b and 2 remove words that are not
// part of any name, so they say nothing; rungs 3 and 4 change the name itself
// and must both print what they did and offer the original back in one tap
// (L2). The caller gets an `interpretation` and draws at most one of them —
// two stacked is the app arguing with itself.

import { search as searchV2 } from './v2/index.js';
import { DEFAULT_SEARCH_OPTS } from './types.js';
import { genres as fetchGenres } from '../../../shared/tmdb/endpoints.js';
import {
    rungs, prefixes, isCorrectionOf, retryWords, bestGuess,
} from '../normalise.js';
import { parseFacets, isBrowse, chipsOf } from '../facets.js';

const empty = (r) => !r || !(r.results || []).length;

/* The genre vocabulary the facet gate needs. Fetched, never typed: the film and
   series lists differ and only eight of their entries are shared. Cached for
   the session because it is the same answer every time and the gate runs on
   every failed search. */
let genreCache = null;
async function genreVocab(signal) {
    if (genreCache) return genreCache;
    try {
        genreCache = { genres: await fetchGenres('movie', { signal }) };
    } catch {
        // No vocabulary means no facet gate, which means truncation runs where
        // a browse was the better answer. Degraded, not broken.
        genreCache = { genres: [] };
    }
    return genreCache;
}

export async function search(query, opts = {}, { signal } = {}) {
    const o = { ...DEFAULT_SEARCH_OPTS, ...opts };
    const first = await searchV2(query, o, { signal });
    if (!empty(first)) return { ...first, meta: { ...first.meta, variant: 'ladder', rung: 0 } };

    const attempts = rungs(query);

    // Rungs 1, 1b and 2 — silent, because they only remove words the index
    // cannot hold. Nothing is being reinterpreted, so nothing is announced.
    for (const attempt of attempts.slice(1)) {
        const r = await searchV2(attempt.query, o, { signal });
        if (empty(r)) continue;
        return {
            ...r,
            meta: { ...r.meta, variant: 'ladder', rung: attempt.rung },
            interpretation: null,
        };
    }

    const left = attempts.at(-1).query;
    const vocab = await genreVocab(signal);

    // The gate. A query describing a kind of thing is not a misspelt name, and
    // truncating it would answer a different question.
    if (isBrowse(left, vocab)) {
        return {
            results: [],
            people: [],
            meta: { variant: 'ladder', rung: 'browse' },
            interpretation: {
                kind: 'browse',
                chips: chipsOf(parseFacets(left, vocab).matched),
                original: query,
            },
        };
    }

    // Rung 3 — the longest prefix that still matches, announced out loud,
    // because a prefix match is evidence and the screen may say so.
    for (const candidate of prefixes(left)) {
        const r = await searchV2(candidate, o, { signal });
        if (empty(r)) continue;
        const top = r.results[0];
        if (!isCorrectionOf(candidate, top?.title || top?.name)) continue;
        return {
            ...r,
            meta: { ...r.meta, variant: 'ladder', rung: 3 },
            interpretation: { kind: 'correction', showing: top.title || top.name, original: query },
        };
    }

    // Rung 4 — every word alone, pooled, and the best near miss offered as a
    // question. A guess asks.
    const pool = [];
    for (const word of retryWords(left)) {
        const r = await searchV2(word, o, { signal });
        pool.push(...(r.results || []));
    }
    const guess = bestGuess(left, pool);
    if (guess) {
        return {
            results: [],
            people: [],
            meta: { variant: 'ladder', rung: 4 },
            interpretation: { kind: 'guess', guess: guess.title || guess.name, original: query },
        };
    }

    // Nothing survived. The honest exit — which is a screen, not a sentence.
    return {
        ...first,
        meta: { ...first.meta, variant: 'ladder', rung: null },
        interpretation: { kind: 'nothing', original: query },
    };
}
