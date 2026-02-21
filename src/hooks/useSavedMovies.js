import { useState, useEffect, useCallback } from 'react';
import { getSavedForUser, saveUserContent, removeUserContent } from '../lib/userApi';
import { getDetails } from '../lib/tmdb';

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

        // Check using both tmdb_id and media_type since it's a composite key now
        const isSaved = savedMovies.some(m => m.tmdb_id === movie.id && m.media_type === (movie.media_type || 'movie'));

        if (isSaved) {
            const { error } = await removeUserContent(userId, movie.id, movie.media_type);
            if (error) console.error('Error removing content:', error);
        } else {
            const { error } = await saveUserContent({
                userId,
                tmdbId: movie.id,
                media_type: movie.media_type,
                title: movie.title || movie.name,
                status: 'wishlist'
            });
            if (error) console.error('Error saving content:', error);
        }
        fetchSavedMovies();
    }

    const fetchWishlistDetails = useCallback(async () => {
        if (savedMovies.length > 0) {
            const wishlistItems = savedMovies.filter(m => m.status === 'wishlist');
            const fetchPromises = wishlistItems.map(item =>
                getDetails(item.tmdb_id, item.media_type).catch(err => {
                    console.error(`Failed to fetch details for ${item.media_type} ${item.tmdb_id}`, err);
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
