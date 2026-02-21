import { supabase } from './supabaseClient';

export async function getSavedForUser(userId) {
    return await supabase
        .from('user_movies')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'wishlist')
        .order('created_at', { ascending: false });
}

export async function saveUserContent({ userId, tmdbId, media_type, title, rating, status }) {
    const payload = {
        user_id: userId,
        tmdb_id: tmdbId,
        media_type: media_type || 'movie',
        title: title,
    };

    if (rating) payload.rating = rating;
    if (status) payload.status = status;

    return await supabase
        .from('user_movies')
        .upsert(payload, { onConflict: 'user_id,tmdb_id,media_type' })
        .select()
        .single();
}

export async function removeUserContent(userId, tmdbId, media_type) {
    return await supabase
        .from('user_movies')
        .delete()
        .eq('user_id', userId)
        .eq('tmdb_id', tmdbId)
        .eq('media_type', media_type || 'movie');
}
