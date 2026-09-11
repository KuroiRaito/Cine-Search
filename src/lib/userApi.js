import { supabase } from './supabaseClient';

const LOCAL_STORAGE_KEY = 'cine_saved_movies';

function getLocalSaved() {
    try {
        const item = localStorage.getItem(LOCAL_STORAGE_KEY);
        return item ? JSON.parse(item) : [];
    } catch {
        return [];
    }
}

function setLocalSaved(list) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
        console.error('Failed to save to localStorage', e);
    }
}

export async function getSavedForUser(userId) {
    if (userId === 'guest-local-id' || !userId) {
        return { data: getLocalSaved(), error: null };
    }
    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase request timeout')), 3000)
        );
        const requestPromise = supabase
            .from('user_movies')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'wishlist')
            .order('created_at', { ascending: false });

        const { data, error } = await Promise.race([requestPromise, timeoutPromise]);
        if (error) throw error;
        return { data, error: null };
    } catch (e) {
        console.warn('Supabase fetch failed, falling back to local storage:', e);
        return { data: getLocalSaved(), error: null };
    }
}

export async function saveUserContent({ userId, tmdbId, media_type, title, rating, status }) {
    const payload = {
        user_id: userId,
        tmdb_id: tmdbId,
        media_type: media_type || 'movie',
        title: title,
        created_at: new Date().toISOString()
    };
    if (rating) payload.rating = rating;
    if (status) payload.status = status;

    if (userId === 'guest-local-id' || !userId) {
        const current = getLocalSaved();
        const updated = current.filter(m => !(m.tmdb_id === tmdbId && m.media_type === (media_type || 'movie')));
        updated.unshift(payload);
        setLocalSaved(updated);
        return { data: payload, error: null };
    }

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase request timeout')), 3000)
        );
        const requestPromise = supabase
            .from('user_movies')
            .upsert(payload, { onConflict: 'user_id,tmdb_id,media_type' })
            .select()
            .single();

        return await Promise.race([requestPromise, timeoutPromise]);
    } catch (e) {
        console.warn('Supabase save failed, updating local storage:', e);
        const current = getLocalSaved();
        const updated = current.filter(m => !(m.tmdb_id === tmdbId && m.media_type === (media_type || 'movie')));
        updated.unshift(payload);
        setLocalSaved(updated);
        return { data: payload, error: null };
    }
}

export async function removeUserContent(userId, tmdbId, media_type) {
    if (userId === 'guest-local-id' || !userId) {
        const current = getLocalSaved();
        const updated = current.filter(m => !(m.tmdb_id === tmdbId && m.media_type === (media_type || 'movie')));
        setLocalSaved(updated);
        return { error: null };
    }

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase request timeout')), 3000)
        );
        const requestPromise = supabase
            .from('user_movies')
            .delete()
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('media_type', media_type || 'movie');

        return await Promise.race([requestPromise, timeoutPromise]);
    } catch (e) {
        console.warn('Supabase delete failed, updating local storage:', e);
        const current = getLocalSaved();
        const updated = current.filter(m => !(m.tmdb_id === tmdbId && m.media_type === (media_type || 'movie')));
        setLocalSaved(updated);
        return { error: null };
    }
}

