import { useEffect } from 'react';
import MovieCard from '../components/MovieCard';

export default function ProfileView({ username, savedMovies, handleSaveMovie, wishlistDetails, fetchWishlistDetails, onCardClick }) {

    useEffect(() => {
        fetchWishlistDetails();
    }, [fetchWishlistDetails]);

    return (
        <main className="app-main">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{username}'s Profile</h2>
                <p style={{ color: '#94a3b8' }}>Your Wishlist</p>
            </div>
            {wishlistDetails.length > 0 ? (
                <div className="movie-grid">
                    {wishlistDetails.map(movie => (
                        <MovieCard
                            key={movie.id}
                            movie={movie}
                            isSaved={true}
                            handleSaveMovie={handleSaveMovie}
                            genreName={null}
                            onCardClick={onCardClick}
                        />
                    ))}
                </div>
            ) : (
                <p style={{ textAlign: 'center', color: '#64748b', marginTop: '4rem' }}>No movies in your wishlist yet.</p>
            )}
        </main>
    );
}
