// Shared shapes for the search layer.

/** The exact state a user lands on. Pinned so eval runs stay comparable. */
export const DEFAULT_SEARCH_OPTS = {
    mediaType: 'all',
    selectedGenre: '',
    sortBy: 'popularity.desc',
    minRating: 0,
    year: '',
    page: 1,
    pageSize: 20,
};

/**
 * Every search path returns this shape, so the eval harness can score v1 and v2
 * interchangeably and the UI does not care which is running.
 * @typedef {{results: object[], totalPages: number, meta: object}} SearchResult
 */
export const emptyResult = (meta = {}) => ({ results: [], totalPages: 1, meta });
