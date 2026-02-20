import { useState, useEffect } from 'react';
import { searchOrDiscover } from '../lib/tmdb';

export function useMovieSearch(query, mediaType, selectedGenre, sortBy) {
    const [results, setResults] = useState([]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            try {
                const { results: newResults } = await searchOrDiscover(query, mediaType, { selectedGenre, sortBy });
                setResults(newResults || []);
            } catch (error) {
                console.error('Search/Discover Error:', error);
                setResults([]);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [query, mediaType, selectedGenre, sortBy]);

    return { results };
}
