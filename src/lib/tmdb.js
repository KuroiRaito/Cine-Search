// All TMDB traffic goes through /api/tmdb in every environment:
//   dev  -> the Vite dev-server proxy in vite.config.js
//   prod -> the Vercel function in api/tmdb.js
// The API key therefore never reaches the browser. The previous dev path read
// import.meta.env.VITE_TMDB_API_KEY, which Vite inlines into the client bundle
// where anyone can read it - that is how the earlier key leaked and was revoked.
function getFetchUrl(path, queryParams = new URLSearchParams()) {
    const qString = queryParams.toString();
    return `/api/tmdb?path=${path}${qString ? '&' + qString : ''}`;
}

export async function searchMovies(query, page = 1, year = '') {
    if (!query) return { results: [] };

    const params = new URLSearchParams({ query, page });
    if (year) params.append('year', year);
    const response = await fetch(getFetchUrl('/search/movie', params));

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

    return { results: results.slice(0, 20), totalPages: data.total_pages || 1 };
}

export async function searchTV(query, page = 1, year = '') {
    if (!query) return { results: [] };

    const params = new URLSearchParams({ query, page });
    if (year) params.append('first_air_date_year', year);
    const response = await fetch(getFetchUrl('/search/tv', params));

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

    return { results: results.slice(0, 20), totalPages: data.total_pages || 1 };
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
    if (filters.minRating) params.append('vote_average.gte', filters.minRating);
    if (filters.with_original_language) params.append('with_original_language', filters.with_original_language);
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    if (filters.page) params.append('page', filters.page);
    return params;
}

export async function discoverMovies(filters = {}) {
    const params = buildQueryParams(filters);
    if (filters.year) params.append('primary_release_year', filters.year);

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

    return { results: results.slice(0, 20), totalPages: data.total_pages || 1 };
}

export async function discoverTV(filters = {}) {
    const params = buildQueryParams(filters);
    if (filters.year) params.append('first_air_date_year', filters.year);

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

    return { results: results.slice(0, 20), totalPages: data.total_pages || 1 };
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
    const isSearch = !!(query && query.trim());
    const pageSize = filters.pageSize || 20;
    const needsUnifiedFill = pageSize !== 20 || mediaType === 'all' || (isSearch && (filters.minRating || filters.selectedGenre));
    const uiPage = filters.page || 1;
    const year = filters.year || '';

    const getSortParam = (type, sortBy) => {
        const [field, dir] = sortBy ? sortBy.split('.') : ['popularity', 'desc'];
        if (field === 'date') return type === 'movie' ? `primary_release_date.${dir}` : `first_air_date.${dir}`;
        return `${field}.${dir}`;
    };

    if (!needsUnifiedFill) {
        // Fast path: TMDB perfectly matches 1:1 with UI pagination
        if (isSearch) {
            return mediaType === 'movie' ? await searchMovies(query, uiPage, year) : await searchTV(query, uiPage, year);
        } else {
            const localFilters = { ...filters, with_genres: filters.selectedGenre, page: uiPage };
            return mediaType === 'movie'
                ? await discoverMovies({ ...localFilters, sort_by: getSortParam('movie', filters.sortBy) })
                : await discoverTV({ ...localFilters, sort_by: getSortParam('tv', filters.sortBy) });
        }
    }

    // Unified Fill Path: loops TMDB pages to guarantee pageSize items per UI page
    const targetCount = uiPage * pageSize;
    let validItems = [];
    let currentTmdbPage = 1;
    let maxTmdbPages = uiPage; // Updated dynamically below

    while (validItems.length < targetCount && currentTmdbPage <= maxTmdbPages) {
        let mRes = { results: [], totalPages: 0 };
        let tRes = { results: [], totalPages: 0 };
        let fetchPromises = [];

        if (mediaType === 'movie' || mediaType === 'all') {
            if (isSearch) {
                fetchPromises.push(searchMovies(query, currentTmdbPage, year).then(r => mRes = r));
            } else {
                const localFilters = { ...filters, with_genres: filters.selectedGenre, page: currentTmdbPage };
                fetchPromises.push(discoverMovies({ ...localFilters, sort_by: getSortParam('movie', filters.sortBy) }).then(r => mRes = r));
            }
        }

        if (mediaType === 'tv' || mediaType === 'all') {
            if (isSearch) {
                fetchPromises.push(searchTV(query, currentTmdbPage, year).then(r => tRes = r));
            } else {
                const localFilters = { ...filters, with_genres: filters.selectedGenre, page: currentTmdbPage };
                fetchPromises.push(discoverTV({ ...localFilters, sort_by: getSortParam('tv', filters.sortBy) }).then(r => tRes = r));
            }
        }

        await Promise.all(fetchPromises);

        let mergedMax = Math.max(mRes.totalPages || 1, tRes.totalPages || 1);
        maxTmdbPages = Math.max(maxTmdbPages, mergedMax);

        let combined = [...mRes.results, ...tRes.results];

        // Apply client filters universally
        if (filters.minRating) combined = combined.filter(r => r.vote_average >= filters.minRating);
        if (filters.selectedGenre) combined = combined.filter(r => r.genre_ids && r.genre_ids.includes(Number(filters.selectedGenre)));

        validItems = [...validItems, ...combined];
        currentTmdbPage++;
    }

    // Sort accumulated valid items
    const [field, dir] = filters.sortBy ? filters.sortBy.split('.') : ['popularity', 'desc'];
    const multiplier = dir === 'asc' ? 1 : -1;

    validItems.sort((a, b) => {
        if (field === 'date') {
            const dateA = new Date(a.date || '1970-01-01').getTime();
            const dateB = new Date(b.date || '1970-01-01').getTime();
            return (dateA - dateB) * multiplier;
        } else if (field === 'vote_average') {
            return ((a.vote_average || 0) - (b.vote_average || 0)) * multiplier;
        } else {
            return ((a.popularity || 0) - (b.popularity || 0)) * multiplier;
        }
    });

    // Deduplicate in case of overlapping TMDB pages over time
    const uniqueItems = [];
    const seen = new Set();
    for (const item of validItems) {
        const key = `${item.media_type}-${item.id}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueItems.push(item);
        }
    }

    const startIndex = (uiPage - 1) * pageSize;
    const pageResults = uniqueItems.slice(startIndex, startIndex + pageSize);

    // Provide a continuous pagination experience
    let calculatedTotalPages = Math.ceil(uniqueItems.length / pageSize);
    if (currentTmdbPage <= maxTmdbPages) {
        // If we haven't exhausted TMDB, guarantee there are at least 4 visible pages to keep the UI static
        calculatedTotalPages = Math.max(uiPage + 3, calculatedTotalPages);
    }

    return { results: pageResults, totalPages: calculatedTotalPages };
}

export async function getWatchProviders(id, mediaType) {
    const response = await fetch(getFetchUrl(`/${mediaType}/${id}/watch/providers`));
    const data = await response.json();
    return data.results || {};
}
