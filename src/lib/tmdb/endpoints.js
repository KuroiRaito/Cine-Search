// Thin, named wrappers around the TMDB endpoints this app uses.
// No ranking, no pagination logic, no filtering - those belong in search/.

import { get } from './client.js';
import { toItem, toItems } from './normalize.js';

const withPage = (data, mediaType) => ({
    results: toItems(data.results, mediaType),
    totalPages: data.total_pages || 1,
    totalResults: data.total_results || 0,
});

export const searchMovies = (query, params = {}, opts) =>
    get('/search/movie', { query, ...params }, opts).then((d) => withPage(d, 'movie'));

export const searchTV = (query, params = {}, opts) =>
    get('/search/tv', { query, ...params }, opts).then((d) => withPage(d, 'tv'));

/** Movies + TV + people in one call. Unused by v1; v2's person route needs it. */
export const searchMulti = (query, params = {}, opts) =>
    get('/search/multi', { query, ...params }, opts).then((d) => ({
        people: (d.results || []).filter((r) => r.media_type === 'person'),
        titles: toItems((d.results || []).filter((r) => r.media_type !== 'person')),
    }));

export const searchPerson = (query, opts) =>
    get('/search/person', { query }, opts).then((d) => d.results || []);

export const searchCollection = (query, opts) =>
    get('/search/collection', { query }, opts).then((d) => d.results || []);

export const personCredits = (personId, opts) =>
    get(`/person/${personId}/combined_credits`, {}, opts).then((d) => ({
        cast: toItems(d.cast),
        crew: (d.crew || []).map((c) => ({ ...toItem(c), job: c.job, department: c.department })),
    }));

export const collection = (collectionId, opts) =>
    get(`/collection/${collectionId}`, {}, opts).then((d) => toItems(d.parts, 'movie'));

export const discoverMovies = (params = {}, opts) =>
    get('/discover/movie', params, opts).then((d) => withPage(d, 'movie'));

export const discoverTV = (params = {}, opts) =>
    get('/discover/tv', params, opts).then((d) => withPage(d, 'tv'));

export const genres = (mediaType, opts) =>
    get(`/genre/${mediaType === 'tv' ? 'tv' : 'movie'}/list`, {}, opts).then((d) => d.genres || []);

export const details = (id, mediaType, opts) =>
    get(`/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}`, {}, opts);

export const credits = (id, mediaType, opts) =>
    get(`/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}/credits`, {}, opts);

export const season = (tvId, seasonNumber, opts) =>
    get(`/tv/${tvId}/season/${seasonNumber}`, {}, opts);

export const watchProviders = (id, mediaType, opts) =>
    get(`/${mediaType}/${id}/watch/providers`, {}, opts).then((d) => d.results || {});

export const keywords = (id, mediaType, opts) =>
    get(`/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}/keywords`, {}, opts)
        .then((d) => d.keywords || d.results || []);
