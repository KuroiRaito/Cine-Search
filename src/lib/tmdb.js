const isDev = import.meta.env.DEV;
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;

function getFetchUrl(path, queryParams = new URLSearchParams()) {
    if (isDev) {
        queryParams.append('api_key', TMDB_KEY);
        const qString = queryParams.toString();
        return `https://api.themoviedb.org/3${path}${qString ? '?' + qString : ''}`;
    } else {
        const qString = queryParams.toString();
        return `/api/tmdb?path=${path}${qString ? '&' + qString : ''}`;
    }
}

export async function searchMulti(query) {
    if (!query) return { results: [] };

    const params = new URLSearchParams({ query });
    const response = await fetch(getFetchUrl('/search/multi', params));

    const data = await response.json();

    const results = (data.results || [])
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .map(item => {
            const isMovie = item.media_type === 'movie';
            return {
                id: item.id,
                title: isMovie ? item.title : item.name,
                year: isMovie
                    ? (item.release_date ? item.release_date.substring(0, 4) : 'Unknown')
                    : (item.first_air_date ? item.first_air_date.substring(0, 4) : 'Unknown'),
                poster_path: item.poster_path,
                media_type: item.media_type,
                genre_ids: item.genre_ids,
                popularity: item.popularity,
                vote_average: item.vote_average,
                date: isMovie ? item.release_date : item.first_air_date
            };
        });

    return { results };
}

export async function getMovieDetails(id) {
    const response = await fetch(getFetchUrl(`/movie/${id}`));
    return response.json();
}

export async function getDetails(id, media_type) {
    const endpoint = media_type === 'tv' ? 'tv' : 'movie';
    const response = await fetch(getFetchUrl(`/${endpoint}/${id}`));
    const item = await response.json();

    const isMovie = endpoint === 'movie';
    return {
        id: item.id,
        title: isMovie ? item.title : item.name,
        year: isMovie
            ? (item.release_date ? item.release_date.substring(0, 4) : 'Unknown')
            : (item.first_air_date ? item.first_air_date.substring(0, 4) : 'Unknown'),
        poster_path: item.poster_path,
        media_type: media_type || (isMovie ? 'movie' : 'tv'),
        overview: item.overview,
        vote_average: item.vote_average,
        genres: item.genres
    };
}

export async function getGenres(mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const response = await fetch(getFetchUrl(`/genre/${endpoint}/list`));
    const data = await response.json();
    return data.genres || [];
}

function buildQueryParams(filters) {
    const params = new URLSearchParams();
    if (filters.with_genres) params.append('with_genres', filters.with_genres);
    if (filters.vote_average_gte) params.append('vote_average.gte', filters.vote_average_gte);
    if (filters.with_original_language) params.append('with_original_language', filters.with_original_language);
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    if (filters.page) params.append('page', filters.page);
    return params;
}

export async function discoverMovies(filters = {}) {
    const params = buildQueryParams(filters);
    if (filters.primary_release_year) params.append('primary_release_year', filters.primary_release_year);

    const response = await fetch(getFetchUrl('/discover/movie', params));
    const data = await response.json();

    const results = (data.results || []).map(item => ({
        id: item.id,
        title: item.title,
        year: item.release_date ? item.release_date.substring(0, 4) : 'Unknown',
        poster_path: item.poster_path,
        media_type: 'movie',
        genre_ids: item.genre_ids,
        popularity: item.popularity,
        vote_average: item.vote_average,
        date: item.release_date
    }));

    return { results };
}

export async function discoverTV(filters = {}) {
    const params = buildQueryParams(filters);
    if (filters.first_air_date_year) params.append('first_air_date_year', filters.first_air_date_year);

    const response = await fetch(getFetchUrl('/discover/tv', params));
    const data = await response.json();

    const results = (data.results || []).map(item => ({
        id: item.id,
        title: item.name,
        year: item.first_air_date ? item.first_air_date.substring(0, 4) : 'Unknown',
        poster_path: item.poster_path,
        media_type: 'tv',
        genre_ids: item.genre_ids,
        popularity: item.popularity,
        vote_average: item.vote_average,
        date: item.first_air_date
    }));

    return { results };
}

export function mapGenreIdsToNames(items, genresList) {
    if (!items || !genresList) return items || [];

    const genreMap = {};
    genresList.forEach(g => genreMap[g.id] = g.name);

    return items.map(item => ({
        ...item,
        genres: (item.genre_ids || []).map(id => genreMap[id]).filter(Boolean)
    }));
}

export async function getTVFullDetails(tvId) {
    const detailsRes = await fetch(getFetchUrl(`/tv/${tvId}`));
    const details = await detailsRes.json();

    const creditsRes = await fetch(getFetchUrl(`/tv/${tvId}/credits`));
    const credits = await creditsRes.json();

    return {
        id: details.id,
        name: details.name,
        overview: details.overview,
        poster_path: details.poster_path,
        first_air_date: details.first_air_date,
        seasons: details.seasons || [],
        genres: details.genres || [],
        vote_average: details.vote_average,
        cast: (credits.cast || []).slice(0, 10).map(c => ({
            name: c.name,
            character: c.character,
            profile_path: c.profile_path
        }))
    };
}

export async function getTVSeasonDetails(tvId, seasonNumber) {
    const response = await fetch(getFetchUrl(`/tv/${tvId}/season/${seasonNumber}`));
    const data = await response.json();
    return data;
}

export async function searchOrDiscover(query, mediaType, filters) {
    if (query && query.trim()) {
        const { results } = await searchMulti(query);
        let filtered = results;
        if (mediaType !== 'all') {
            filtered = filtered.filter(item => item.media_type === mediaType);
        }
        return { results: filtered };
    } else {
        const getSortParam = (type) => {
            if (filters.sortBy === 'newest') {
                return type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
            }
            return filters.sortBy;
        };

        const localFilters = {
            with_genres: filters.selectedGenre,
            page: 1,
            ...filters
        };

        if (mediaType === 'movie') {
            return await discoverMovies({ ...localFilters, sort_by: getSortParam('movie') });
        } else if (mediaType === 'tv') {
            return await discoverTV({ ...localFilters, sort_by: getSortParam('tv') });
        } else {
            const [mRes, tRes] = await Promise.all([
                discoverMovies({ ...localFilters, sort_by: getSortParam('movie') }),
                discoverTV({ ...localFilters, sort_by: getSortParam('tv') })
            ]);

            let combined = [...mRes.results, ...tRes.results];

            combined.sort((a, b) => {
                if (filters.sortBy === 'newest') {
                    const dateA = new Date(a.date || '1970-01-01');
                    const dateB = new Date(b.date || '1970-01-01');
                    return dateB - dateA;
                } else if (filters.sortBy === 'vote_average.desc') {
                    return (b.vote_average || 0) - (a.vote_average || 0);
                } else {
                    return (b.popularity || 0) - (a.popularity || 0);
                }
            });

            return { results: combined };
        }
    }
}
