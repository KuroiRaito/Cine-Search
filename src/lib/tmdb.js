// Compatibility facade.
//
// The TMDB layer now lives in lib/tmdb/ (transport, endpoints, normalize) and
// search lives in modules/search/lib/. This file keeps the old import paths working so
// the restructure did not have to touch every consumer at once.
//
// New code imports from shared/tmdb/endpoints.js, or calls search() through
// the search module's index. Only the eval harness still uses this file.

import * as api from '../shared/tmdb/endpoints.js';
import { toItem, attachGenreNames } from '../shared/tmdb/normalize.js';
import { search as runSearch } from '../modules/search/index.js';

export { attachGenreNames as mapGenreIdsToNames };

export const searchMovies = (query, page = 1, year = '') =>
    query ? api.searchMovies(query, { page, year: year || undefined }) : Promise.resolve({ results: [] });

export const searchTV = (query, page = 1, year = '') =>
    query ? api.searchTV(query, { page, first_air_date_year: year || undefined }) : Promise.resolve({ results: [] });

export const discoverMovies = (filters = {}) =>
    api.discoverMovies({
        with_genres: filters.with_genres, 'vote_average.gte': filters.minRating,
        with_original_language: filters.with_original_language, sort_by: filters.sort_by,
        page: filters.page, primary_release_year: filters.year,
    });

export const discoverTV = (filters = {}) =>
    api.discoverTV({
        with_genres: filters.with_genres, 'vote_average.gte': filters.minRating,
        with_original_language: filters.with_original_language, sort_by: filters.sort_by,
        page: filters.page, first_air_date_year: filters.year,
    });

export const getGenres = (mediaType) => api.genres(mediaType);
export const getWatchProviders = (id, mediaType) => api.watchProviders(id, mediaType);
export const getTVSeasonDetails = (tvId, seasonNumber) => api.season(tvId, seasonNumber);
export const getMovieDetails = (id) => api.details(id, 'movie');

export async function getDetails(id, media_type) {
    const raw = await api.details(id, media_type);
    return { ...toItem(raw, media_type), overview: raw.overview, genres: raw.genres };
}

export async function getTVFullDetails(tvId) {
    const [details, cr] = await Promise.all([api.details(tvId, 'tv'), api.credits(tvId, 'tv')]);
    return {
        id: details.id, name: details.name, overview: details.overview,
        poster_path: details.poster_path, first_air_date: details.first_air_date,
        seasons: details.seasons || [], genres: details.genres || [],
        vote_average: details.vote_average,
        cast: (cr.cast || []).slice(0, 10).map((c) => ({
            name: c.name, character: c.character, profile_path: c.profile_path,
        })),
    };
}

/** @deprecated import { search } from './search/index.js' */
export const searchOrDiscover = (query, mediaType, filters = {}) =>
    runSearch(query, { ...filters, mediaType });
