import { useState, useEffect, useRef } from 'react';
import SearchBar from '../components/SearchBar';
import Filters from '../components/Filters';
import MovieCard from '../components/MovieCard';
import { useGenres } from '../hooks/useGenres';
import { useMovieSearch } from '../hooks/useMovieSearch';

export default function HomeView({ savedMovies, handleSaveMovie, onCardClick }) {
    const [showFilters, setShowFilters] = useState(false);
    const [query, setQuery] = useState('');
    const [mediaType, setMediaType] = useState('all'); // 'all', 'movie', 'tv'
    const [selectedGenre, setSelectedGenre] = useState('');
    const [sortBy, setSortBy] = useState('popularity.desc');
    const [minRating, setMinRating] = useState(0);
    const [year, setYear] = useState('');
    const [page, setPage] = useState(1);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
    const isTransitioningOptions = useRef(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 600);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const pageSize = isMobile ? 10 : 20;
    const { genresList, allGenresMap } = useGenres(mediaType, selectedGenre, setSelectedGenre);
    const { results, totalPages, isLoading } = useMovieSearch(query, mediaType, selectedGenre, sortBy, minRating, year, page, pageSize);

    // Reset page to 1 when filters or query or pageSize change
    useEffect(() => {
        setPage(1);
    }, [query, mediaType, selectedGenre, sortBy, minRating, year, pageSize]);

    const handleQueryChange = (newQuery) => {
        setQuery(newQuery);
        // Reset previous filters if starting a completely new search (fast clearing or pasting new distinct text)
        if (newQuery === '' || (!newQuery.startsWith(query) && !query.startsWith(newQuery))) {
            setMediaType('all');
            setSelectedGenre('');
            setSortBy('popularity.desc');
            setMinRating(0);
            setYear('');
        }
    };

    const handleApplyFilters = (filters) => {
        setMediaType(filters.mediaType);
        setSelectedGenre(filters.selectedGenre);
        setSortBy(filters.sortBy);
        setMinRating(filters.minRating);
        setYear(filters.year);
        setShowFilters(false);
    };

    const isFilterActive = mediaType !== 'all' || selectedGenre !== '' || sortBy !== 'popularity.desc' || minRating !== 0 || year !== '';

    const handleRemoveFilters = () => {
        setMediaType('all');
        setSelectedGenre('');
        setSortBy('popularity.desc');
        setMinRating(0);
        setYear('');
        setShowFilters(false);
    };

    const handleProtectedPageChange = (newPage) => {
        if (isTransitioningOptions.current || newPage === page || newPage < 1 || newPage > totalPages) return;
        isTransitioningOptions.current = true;
        setPage(newPage);
        setTimeout(() => {
            isTransitioningOptions.current = false;
        }, 300); // 300ms transition lock
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const maxVisiblePages = 5; // Number of page buttons to show
        let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        const pages = Array.from({ length: (endPage - startPage + 1) }, (_, i) => startPage + i);
        const activeIndex = pages.indexOf(page);

        return (
            <div className="pagination">
                <button
                    className={`page-btn arrow ${page <= 1 ? 'disabled' : ''}`}
                    onClick={() => handleProtectedPageChange(page - 1)}
                    disabled={page <= 1}
                >
                    &laquo;
                </button>

                <div className="pagination-numbers">
                    {activeIndex !== -1 && (
                        <div
                            className="active-pill"
                            style={{
                                transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 0.5}rem))`,
                            }}
                        />
                    )}

                    {pages.map(p => (
                        <button
                            key={p}
                            className={`page-btn num-btn ${page === p ? 'active-text' : ''}`}
                            onClick={() => handleProtectedPageChange(p)}
                        >
                            {p}
                        </button>
                    ))}
                </div>

                <button
                    className={`page-btn arrow ${page >= totalPages ? 'disabled' : ''}`}
                    onClick={() => handleProtectedPageChange(page + 1)}
                    disabled={page >= totalPages}
                >
                    &raquo;
                </button>
            </div>
        );
    };

    return (
        <>
            <header className="app-header">
                <h1>Cine Search</h1>
                <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto' }}>

                    <SearchBar
                        query={query}
                        setQuery={handleQueryChange}
                        onOpenFilters={() => setShowFilters(true)}
                    />
                    <Filters
                        show={showFilters}
                        onClose={() => setShowFilters(false)}
                        onApply={handleApplyFilters}
                        initialFilters={{ mediaType, selectedGenre, sortBy, minRating, year }}
                        genresList={genresList}
                        isFilterActive={isFilterActive}
                        onRemoveFilters={handleRemoveFilters}
                    />
                </div>
            </header>

            <main className="app-main">
                {results.length > 0 ? (
                    <section className="results-section" style={{ position: 'relative' }}>
                        {renderPagination()}

                        <div
                            className="movie-grid"
                            style={{
                                opacity: isLoading ? 0.5 : 1,
                                transition: 'opacity 0.2s',
                                pointerEvents: isLoading ? 'none' : 'auto'
                            }}
                        >
                            {results.map(movie => {
                                const movieType = movie.media_type || 'movie';
                                const isSaved = savedMovies.some(m => m.tmdb_id === movie.id && m.media_type === movieType);

                                // Get first genre name
                                const genreName = movie.genre_ids && movie.genre_ids.length > 0
                                    ? allGenresMap[movie.genre_ids[0]]
                                    : null;

                                return (
                                    <MovieCard
                                        key={movie.id}
                                        movie={movie}
                                        isSaved={isSaved}
                                        handleSaveMovie={handleSaveMovie}
                                        genreName={genreName}
                                        onCardClick={onCardClick}
                                    />
                                );
                            })}
                        </div>

                        {renderPagination()}
                    </section>
                ) : isLoading ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--secondary-text)' }}>
                        <h2>Loading...</h2>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--secondary-text)' }}>
                        <h2>No results found</h2>
                        <p style={{ marginTop: '0.5rem' }}>Try adjusting your filters or search query.</p>
                        {page > 1 && (
                            <button
                                onClick={() => setPage(1)}
                                className="search-button"
                                style={{ marginTop: '1.5rem' }}
                            >
                                Back to Page 1
                            </button>
                        )}
                    </div>
                )}
            </main>
        </>
    );
}
