export default function MovieCard({ movie, isSaved, handleSaveMovie, genreName, onCardClick }) {
    return (
        <div
            className="movie-card"
            onClick={() => onCardClick && onCardClick(movie)}
            style={{ cursor: onCardClick ? 'pointer' : 'default' }}
        >
            <div className="poster-wrapper">
                {movie.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={movie.title} className="movie-poster" />
                ) : (
                    <div className="no-poster"><span>No Poster</span></div>
                )}
                <button
                    className="save-button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleSaveMovie(movie);
                    }}
                    title={isSaved ? "Saved" : "Add to Wishlist"}
                    style={{
                        color: isSaved ? '#facc15' : 'white',
                        opacity: isSaved ? 1 : undefined,
                        transform: isSaved ? 'scale(1)' : undefined
                    }}
                >
                    ★
                </button>
            </div>
            <div className="movie-info">
                <h3 className="movie-title">{movie.title}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <p className="movie-year">{movie.year || 'Unknown'}</p>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {genreName && (
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic', marginRight: '4px' }}>
                                {genreName}
                            </span>
                        )}
                        {movie.media_type && (
                            <span style={{ fontSize: '0.65rem', padding: '2px 4px', borderRadius: '4px', backgroundColor: '#334155', color: '#94a3b8', textTransform: 'uppercase' }}>
                                {movie.media_type === 'tv' ? 'TV' : 'Movie'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
