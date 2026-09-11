// TMDB payload -> the app's item shape. One place, so v1 and v2 emit identical
// objects and the eval harness can score either interchangeably.

const yearOf = (d) => (d ? String(d).substring(0, 4) : 'Unknown');

/** @returns {{id:number,title:string,year:string,media_type:'movie'|'tv',...}} */
export function toItem(raw, mediaType) {
    const type = mediaType || raw.media_type || (raw.title ? 'movie' : 'tv');
    const isMovie = type === 'movie';
    const date = isMovie ? raw.release_date : raw.first_air_date;
    return {
        id: raw.id,
        title: isMovie ? raw.title : raw.name,
        year: yearOf(date),
        poster_path: raw.poster_path,
        media_type: type,
        genre_ids: raw.genre_ids,
        popularity: raw.popularity,
        vote_average: raw.vote_average,
        vote_count: raw.vote_count,
        date,
    };
}

export const toItems = (list, mediaType) => (list || []).map((r) => toItem(r, mediaType));

/** Stable identity across movie/tv — TMDB ids collide between the two. */
export const keyOf = (item) => `${item.media_type}:${item.id}`;

export function dedupe(items) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
        const k = keyOf(it);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(it);
    }
    return out;
}

export function attachGenreNames(items, genresList) {
    if (!items || !genresList) return items || [];
    const map = Object.fromEntries(genresList.map((g) => [g.id, g.name]));
    return items.map((it) => ({ ...it, genres: (it.genre_ids || []).map((id) => map[id]).filter(Boolean) }));
}
