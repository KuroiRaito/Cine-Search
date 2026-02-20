const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function searchMulti(query) {
    if (!query) return { results: [] };

    const response = await fetch(
        `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`
    );

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
    // Note: This defaults to movie details. 
    // If we start saving TV shows, we might need to handle endpoints dynamically.
    const response = await fetch(
        `${TMDB_BASE}/movie/${id}?api_key=${TMDB_KEY}`
    );
    return response.json();
}

export async function getDetails(id, media_type) {
    const endpoint = media_type === 'tv' ? 'tv' : 'movie';
    const response = await fetch(
        `${TMDB_BASE}/${endpoint}/${id}?api_key=${TMDB_KEY}`
    );
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
    const response = await fetch(
        `${TMDB_BASE}/genre/${endpoint}/list?api_key=${TMDB_KEY}`
    );
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
    params.append('api_key', TMDB_KEY);
    return params;
}

export async function discoverMovies(filters = {}) {
    const params = buildQueryParams(filters);
    if (filters.primary_release_year) params.append('primary_release_year', filters.primary_release_year);

    const response = await fetch(`${TMDB_BASE}/discover/movie?${params.toString()}`);
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

    const response = await fetch(`${TMDB_BASE}/discover/tv?${params.toString()}`);
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
    const detailsRes = await fetch(`${TMDB_BASE}/tv/${tvId}?api_key=${TMDB_KEY}`);
    const details = await detailsRes.json();

    const creditsRes = await fetch(`${TMDB_BASE}/tv/${tvId}/credits?api_key=${TMDB_KEY}`);
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
    const response = await fetch(`${TMDB_BASE}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_KEY}`);
    const data = await response.json();
    return data;
}
