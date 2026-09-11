// v1 — the search behaviour that shipped. Preserved exactly.
//
// This is the measured baseline (52% null-and-low, MRR 0.47). Its logic is
// moved here verbatim, not improved: if these numbers move, the port is wrong.
//
// Known defects, deliberately NOT fixed here (they are what v2 exists to beat):
//   - re-sorts TMDB's relevance-ordered results by popularity
//   - filters client-side after fetching, so restrictive filters force deep
//     pagination: measured 84 TMDB calls / 9.6s for filtered page 5
//   - no typo tolerance: TMDB returns 0 results for "intersteller"

import { searchMovies, searchTV, discoverMovies, discoverTV } from '../tmdb/endpoints.js';
import { dedupe } from '../tmdb/normalize.js';
import { DEFAULT_SEARCH_OPTS } from './types.js';

function sortParam(type, sortBy) {
    const [field, dir] = sortBy ? sortBy.split('.') : ['popularity', 'desc'];
    if (field === 'date') return type === 'movie' ? `primary_release_date.${dir}` : `first_air_date.${dir}`;
    return `${field}.${dir}`;
}

const discoverParams = (o, page) => ({
    with_genres: o.selectedGenre || undefined,
    'vote_average.gte': o.minRating || undefined,
    with_original_language: o.with_original_language || undefined,
    page,
});

export async function search(query, opts = {}, { signal } = {}) {
    const o = { ...DEFAULT_SEARCH_OPTS, ...opts };
    const sig = { signal };
    const isSearch = Boolean(query && query.trim());
    const pageSize = o.pageSize || 20;
    const uiPage = o.page || 1;
    const year = o.year || '';
    const mediaType = o.mediaType;

    const needsUnifiedFill =
        pageSize !== 20 || mediaType === 'all' || (isSearch && (o.minRating || o.selectedGenre));

    // Fast path: TMDB pagination maps 1:1 onto UI pagination.
    if (!needsUnifiedFill) {
        if (isSearch) {
            const r = mediaType === 'movie'
                ? await searchMovies(query, { page: uiPage, year: year || undefined }, sig)
                : await searchTV(query, { page: uiPage, first_air_date_year: year || undefined }, sig);
            return { ...r, results: r.results.slice(0, 20), meta: { variant: 'v1', path: 'fast' } };
        }
        const p = discoverParams(o, uiPage);
        const r = mediaType === 'movie'
            ? await discoverMovies({ ...p, primary_release_year: year || undefined, sort_by: sortParam('movie', o.sortBy) }, sig)
            : await discoverTV({ ...p, first_air_date_year: year || undefined, sort_by: sortParam('tv', o.sortBy) }, sig);
        return { ...r, results: r.results.slice(0, 20), meta: { variant: 'v1', path: 'fast' } };
    }

    // Unified fill: loop TMDB pages until pageSize items survive client filtering.
    const targetCount = uiPage * pageSize;
    let validItems = [];
    let tmdbPage = 1;
    let maxTmdbPages = uiPage;
    let calls = 0;

    while (validItems.length < targetCount && tmdbPage <= maxTmdbPages) {
        let mRes = { results: [], totalPages: 0 };
        let tRes = { results: [], totalPages: 0 };
        const jobs = [];

        if (mediaType === 'movie' || mediaType === 'all') {
            jobs.push((isSearch
                ? searchMovies(query, { page: tmdbPage, year: year || undefined }, sig)
                : discoverMovies({ ...discoverParams(o, tmdbPage), primary_release_year: year || undefined, sort_by: sortParam('movie', o.sortBy) }, sig)
            ).then((r) => { mRes = r; }));
        }
        if (mediaType === 'tv' || mediaType === 'all') {
            jobs.push((isSearch
                ? searchTV(query, { page: tmdbPage, first_air_date_year: year || undefined }, sig)
                : discoverTV({ ...discoverParams(o, tmdbPage), first_air_date_year: year || undefined, sort_by: sortParam('tv', o.sortBy) }, sig)
            ).then((r) => { tRes = r; }));
        }

        calls += jobs.length;
        await Promise.all(jobs);

        maxTmdbPages = Math.max(maxTmdbPages, Math.max(mRes.totalPages || 1, tRes.totalPages || 1));

        let combined = [...mRes.results, ...tRes.results];
        if (o.minRating) combined = combined.filter((r) => r.vote_average >= o.minRating);
        if (o.selectedGenre) combined = combined.filter((r) => r.genre_ids && r.genre_ids.includes(Number(o.selectedGenre)));

        validItems = [...validItems, ...combined];
        tmdbPage++;
    }

    const [field, dir] = o.sortBy ? o.sortBy.split('.') : ['popularity', 'desc'];
    const mult = dir === 'asc' ? 1 : -1;
    validItems.sort((a, b) => {
        if (field === 'date') {
            return (new Date(a.date || '1970-01-01').getTime() - new Date(b.date || '1970-01-01').getTime()) * mult;
        }
        if (field === 'vote_average') return ((a.vote_average || 0) - (b.vote_average || 0)) * mult;
        return ((a.popularity || 0) - (b.popularity || 0)) * mult;
    });

    const unique = dedupe(validItems);
    const start = (uiPage - 1) * pageSize;
    const pageResults = unique.slice(start, start + pageSize);

    let totalPages = Math.ceil(unique.length / pageSize);
    if (tmdbPage <= maxTmdbPages) totalPages = Math.max(uiPage + 3, totalPages);

    return { results: pageResults, totalPages, meta: { variant: 'v1', path: 'unified-fill', calls } };
}
