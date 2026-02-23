import { useState, useEffect } from 'react';
import { searchOrDiscover } from '../lib/tmdb';

export function useMovieSearch(query, mediaType, selectedGenre, sortBy, minRating, year, page, pageSize = 20) {
    const [results, setResults] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const delayDebounceFn = setTimeout(async () => {
            try {
                const res = await searchOrDiscover(query, mediaType, { selectedGenre, sortBy, minRating, year, page, pageSize });
                setResults(res.results || []);
                setTotalPages(res.totalPages || 1);
            } catch (error) {
                console.error('Search/Discover Error:', error);
                setResults([]);
                setTotalPages(1);
            } finally {
                setIsLoading(false);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [query, mediaType, selectedGenre, sortBy, minRating, year, page, pageSize]);

    return { results, totalPages, isLoading };
}
