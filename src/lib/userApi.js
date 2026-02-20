import { supabase } from './supabaseClient';

export async function getSavedForUser(userId) {
    return await supabase
        .from('user_movies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
}

export async function saveUserMovie({ userId, tmdbId, title, rating, status }) {
    const payload = {
        user_id: userId,
        tmdb_id: tmdbId,
        title: title,
    };

    if (rating) payload.rating = rating;
    if (status) payload.status = status;

    return await supabase
        .from('user_movies')
        .upsert(payload);
}

export async function removeUserMovie(userId, tmdbId) {
    return await supabase
        .from('user_movies')
        .delete()
        .eq('user_id', userId)
        .eq('tmdb_id', tmdbId);
}
