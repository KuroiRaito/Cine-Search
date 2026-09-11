import { useState, useEffect } from 'react';
import { search } from '../lib/search/index.js';

const DEBOUNCE_MS = 250;

export function useMovieSearch(query, mediaType, selectedGenre, sortBy, minRating, year, page, pageSize = 20) {
    const [results, setResults] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        // Cancel the previous request on every change. Without this a slow
        // response for "int" can land after "interstellar" and overwrite it -
        // the user sees results for a query they already finished typing.
        const controller = new AbortController();

        const timer = setTimeout(async () => {
            try {
                const res = await search(
                    query,
                    { mediaType, selectedGenre, sortBy, minRating, year, page, pageSize },
                    { signal: controller.signal },
                );
                if (controller.signal.aborted) return;
                setResults(res.results || []);
                setTotalPages(res.totalPages || 1);
            } catch (error) {
                if (error?.name === 'AbortError' || controller.signal.aborted) return;
                console.error('Search error:', error);
                setResults([]);
                setTotalPages(1);
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }, DEBOUNCE_MS);

        return () => { clearTimeout(timer); controller.abort(); };
    }, [query, mediaType, selectedGenre, sortBy, minRating, year, page, pageSize]);

    return { results, totalPages, isLoading };
}
