import { useState, useEffect, useCallback } from 'react';
import { getSavedForUser, saveUserMovie, removeUserMovie } from '../lib/userApi';
import { getMovieDetails } from '../lib/tmdb';

export function useSavedMovies(userId) {
    const [savedMovies, setSavedMovies] = useState([]);
    const [wishlistDetails, setWishlistDetails] = useState([]);

    const fetchSavedMovies = useCallback(async () => {
        if (!userId) return;
        const { data } = await getSavedForUser(userId);
        setSavedMovies(data || []);
    }, [userId]);

    useEffect(() => {
        fetchSavedMovies();
    }, [fetchSavedMovies]);

    async function handleSaveMovie(movie) {
        if (!userId) return;

        const isSaved = savedMovies.some(m => m.tmdb_id === movie.id);

        if (isSaved) {
            await removeUserMovie(userId, movie.id);
        } else {
            await saveUserMovie({
                userId,
                tmdbId: movie.id,
                title: movie.title,
                status: 'wishlist'
            });
        }
        fetchSavedMovies();
    }

    const fetchWishlistDetails = useCallback(async () => {
        if (savedMovies.length > 0) {
            const wishlistItems = savedMovies.filter(m => m.status === 'wishlist');
            const fetchPromises = wishlistItems.map(item =>
                getMovieDetails(item.tmdb_id).catch(err => {
                    console.error(`Failed to fetch details for movie ${item.tmdb_id}`, err);
                    return null;
                })
            );
            const details = await Promise.all(fetchPromises);
            const validDetails = details.filter(d => d && d.id);
            const uniqueDetails = Array.from(new Map(validDetails.map(m => [m.id, m])).values());
            setWishlistDetails(uniqueDetails);
        } else {
            setWishlistDetails([]);
        }
    }, [savedMovies]);

    return { savedMovies, handleSaveMovie, wishlistDetails, fetchWishlistDetails };
}
