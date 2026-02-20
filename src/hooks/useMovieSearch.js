import { useState, useEffect } from 'react';
import { searchMulti, discoverMovies, discoverTV } from '../lib/tmdb';

export function useMovieSearch(query, mediaType, selectedGenre, sortBy) {
    const [results, setResults] = useState([]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            // 1. Search Mode (Query present)
            if (query.trim()) {
                const { results: searchResults } = await searchMulti(query);
                let filtered = searchResults;

                // Client-side filtering for search results
                if (mediaType !== 'all') {
                    filtered = filtered.filter(item => item.media_type === mediaType);
                }

                setResults(filtered);
            }
            // 2. Discovery Mode (No Query)
            else {
                const getSortParam = (type) => {
                    if (sortBy === 'newest') {
                        return type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';
                    }
                    return sortBy;
                };

                const filters = {
                    with_genres: selectedGenre,
                    page: 1
                };

                let newResults = [];

                if (mediaType === 'movie') {
                    const { results: m } = await discoverMovies({ ...filters, sort_by: getSortParam('movie') });
                    newResults = m;
                } else if (mediaType === 'tv') {
                    const { results: t } = await discoverTV({ ...filters, sort_by: getSortParam('tv') });
                    newResults = t;
                } else {
                    // All: fetch both and merge
                    const [mRes, tRes] = await Promise.all([
                        discoverMovies({ ...filters, sort_by: getSortParam('movie') }),
                        discoverTV({ ...filters, sort_by: getSortParam('tv') })
                    ]);

                    let combined = [...mRes.results, ...tRes.results];

                    // Client-side sort for merged results
                    combined.sort((a, b) => {
                        if (sortBy === 'newest') {
                            const dateA = new Date(a.date || '1970-01-01');
                            const dateB = new Date(b.date || '1970-01-01');
                            return dateB - dateA;
                        } else if (sortBy === 'vote_average.desc') {
                            return (b.vote_average || 0) - (a.vote_average || 0);
                        } else {
                            return (b.popularity || 0) - (a.popularity || 0);
                        }
                    });

                    newResults = combined;
                }

                setResults(newResults);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [query, mediaType, selectedGenre, sortBy]);

    return { results };
}
