import { useState } from 'react';
import SearchBar from '../components/SearchBar';
import Filters from '../components/Filters';
import MovieCard from '../components/MovieCard';
import { useGenres } from '../hooks/useGenres';
import { useMovieSearch } from '../hooks/useMovieSearch';

export default function HomeView({ savedMovies, handleSaveMovie, onCardClick }) {
    const [query, setQuery] = useState('');
    const [mediaType, setMediaType] = useState('all'); // 'all', 'movie', 'tv'
    const [selectedGenre, setSelectedGenre] = useState('');
    const [sortBy, setSortBy] = useState('popularity.desc');

    const { genresList, allGenresMap } = useGenres(mediaType, selectedGenre, setSelectedGenre);
    const { results } = useMovieSearch(query, mediaType, selectedGenre, sortBy);

    return (
        <>
            <header className="app-header">
                <h1>Cine Search</h1>
                <SearchBar query={query} setQuery={setQuery} />
                <Filters
                    mediaType={mediaType}
                    setMediaType={setMediaType}
                    selectedGenre={selectedGenre}
                    setSelectedGenre={setSelectedGenre}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    genresList={genresList}
                />
            </header>

            <main className="app-main">
                {results.length > 0 && (
                    <section className="results-section">
                        <div className="movie-grid">
                            {results.map(movie => {
                                const isSaved = savedMovies.some(m => m.tmdb_id === movie.id);
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
                    </section>
                )}
            </main>
        </>
    );
}
