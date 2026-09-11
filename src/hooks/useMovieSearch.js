import { useState, useEffect } from 'react';
import { searchOrDiscover } from '../lib/tmdb';
import { isV2 } from '../lib/searchFlags';

export function useMovieSearch(query, mediaType, selectedGenre, sortBy, minRating, year, page, pageSize = 20) {
    const [results, setResults] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const delayDebounceFn = setTimeout(async () => {
            try {
                // v2 lands here once Phase 2 ships. Until then both branches are
                // identical, so the flag is a verified no-op.
                const res = isV2()
                    ? await searchOrDiscover(query, mediaType, { selectedGenre, sortBy, minRating, year, page, pageSize })
                    : await searchOrDiscover(query, mediaType, { selectedGenre, sortBy, minRating, year, page, pageSize });
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
