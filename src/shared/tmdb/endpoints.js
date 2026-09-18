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

/** Movies + TV + people in one call, in TMDB's own relevance order. */
export const searchMulti = (query, params = {}, opts) =>
    get('/search/multi', { query, ...params }, opts).then((d) => ({
        people: (d.results || []).filter((r) => r.media_type === 'person'),
        titles: toItems((d.results || []).filter((r) => r.media_type !== 'person')),
        totalPages: d.total_pages || 1,
        totalResults: d.total_results || 0,
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

/** "Because you watched X" — TMDB's own neighbours for one title. */
export const recommendations = (id, mediaType, opts) =>
    get(`/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}/recommendations`, {}, opts)
        .then((d) => toItems(d.results, mediaType));

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

/**
 * Every provider a region has, in TMDB's own display order.
 *
 * Fetched, never typed. Ids are per region and they move: Amazon Prime Video is
 * 119 in India and 9 in the United States, and JioHotstar — the most-used
 * service in the country this product is built for — is 2336, an id no
 * hardcoded list written a year ago would carry.
 */
export const providerList = (mediaType, region, opts) =>
    get(`/watch/providers/${mediaType === 'tv' ? 'tv' : 'movie'}`, { watch_region: region }, opts)
        .then((d) => (d.results || [])
            .slice()
            .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
            .map((p) => ({ id: p.provider_id, name: p.provider_name })));

export const watchProviders = (id, mediaType, opts) =>
    get(`/${mediaType}/${id}/watch/providers`, {}, opts).then((d) => d.results || {});

export const keywords = (id, mediaType, opts) =>
    get(`/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}/keywords`, {}, opts)
        .then((d) => d.keywords || d.results || []);

/**
 * One call for a whole title page: details plus everything hanging off it.
 * Replaces the three separate round trips the detail modal used to make.
 * `details` above is left alone - existing callers depend on its signature.
 */
const TITLE_APPEND = 'credits,watch/providers,similar,recommendations,keywords,videos,external_ids';

export const titleFull = (id, mediaType, opts) => {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const append = type === 'tv'
        ? TITLE_APPEND.replace('credits', 'aggregate_credits') + ',content_ratings'
        : TITLE_APPEND + ',release_dates';
    return get(`/${type}/${id}`, { append_to_response: append }, opts);
};

/** A person, with their full filmography across film and TV. */
export const person = (personId, opts) =>
    get(`/person/${personId}`, { append_to_response: 'combined_credits,external_ids' }, opts);

/**
 * One credit — "this person, playing this character, in this title".
 *
 * TMDB's own identifier for exactly what a favourite character is, and one
 * request rehydrates the whole card: the character name, the person with their
 * profile_path, and the title with its poster_path. There is no character
 * entity behind it, which is why the picker has to arrive at a character
 * through a title or an actor rather than by searching for one.
 */
export const credit = (creditId, opts) => get(`/credit/${creditId}`, {}, opts);

/**
 * A title's cast. `aggregate_credits` is the TV-correct call: it rolls a
 * person's several roles into one entry and carries total_episode_count, which
 * is the only thing that makes a 221-name cast list usable.
 */
export const castOf = (mediaType, id, opts) => (mediaType === 'tv'
    ? get(`/tv/${id}/aggregate_credits`, {}, opts)
    : get(`/movie/${id}/credits`, {}, opts));

/* ---- Browse feeds. None of these need a query, which is what lets the home
   screen show something before anyone types. ---- */

export const trending = (window = 'week', opts) =>
    get(`/trending/all/${window}`, {}, opts).then((d) => toItems(d.results));

export const nowPlaying = (region, opts) =>
    get('/movie/now_playing', { region }, opts).then((d) => toItems(d.results, 'movie'));

export const upcoming = (region, opts) =>
    get('/movie/upcoming', { region }, opts).then((d) => toItems(d.results, 'movie'));

export const onTheAir = (opts) =>
    get('/tv/on_the_air', {}, opts).then((d) => toItems(d.results, 'tv'));
