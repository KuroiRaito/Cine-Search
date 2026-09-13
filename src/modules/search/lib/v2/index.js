// v2 — one request where v1 made three.
//
// A plain query with no filters is what almost every search is. v1 answered it
// with /search/movie and /search/tv in parallel, then re-sorted the union by
// popularity — and the people section made a third call to /search/person.
// /search/multi returns titles and people together, in TMDB's own relevance
// order, in one round trip.
//
// Anything v2 does not handle — a media-type filter, a genre, a rating floor, a
// year, page two — falls through to v1 unchanged, so no path gets worse than
// the measured baseline. Measured, not assumed: the eval harness scores both.
import { search as searchV1 } from '../v1.js';
import { searchMulti } from '../../../../shared/tmdb/endpoints.js';
import { DEFAULT_SEARCH_OPTS } from '../types.js';

export async function search(query, opts = {}, { signal } = {}) {
    const o = { ...DEFAULT_SEARCH_OPTS, ...opts };
    const plain = Boolean(query && query.trim())
        && o.mediaType === 'all'
        && !o.selectedGenre && !o.minRating && !o.year
        && (o.page || 1) === 1 && (o.pageSize || 20) === 20;

    if (!plain) {
        const r = await searchV1(query, opts, { signal });
        return { ...r, meta: { ...r.meta, variant: 'v2', path: 'v1-fallback' } };
    }

    const r = await searchMulti(query.trim(), {}, { signal });
    return {
        results: r.titles.slice(0, 20),
        people: r.people,
        totalPages: r.totalPages,
        meta: { variant: 'v2', path: 'multi', calls: 1 },
    };
}
