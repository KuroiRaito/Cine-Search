/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient.js';

const AuthContext = createContext(null);

/**
 * A guest is someone who isn't signed in — never a fabricated user object.
 * The old `guest-local-id` and its mirrored localStorage library are gone, and
 * they are not coming back: two databases to maintain forever the moment
 * episode progress and rewatch counts land.
 */
export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async (userId) => {
        if (!userId) return setProfile(null);
        const { data } = await supabase
            .from('profiles').select('id, username, region, services, theme')
            .eq('id', userId).maybeSingle();
        setProfile(data ?? null);
    }, []);

    useEffect(() => {
        let live = true;
        supabase.auth.getSession().then(({ data }) => {
            if (!live) return;
            setSession(data.session ?? null);
            loadProfile(data.session?.user?.id).finally(() => live && setLoading(false));
        }).catch(() => live && setLoading(false));

        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
            if (!live) return;
            setSession(s ?? null);
            loadProfile(s?.user?.id);
        });
        return () => { live = false; sub?.subscription?.unsubscribe(); };
    }, [loadProfile]);

    const value = {
        session,
        user: session?.user ?? null,
        profile,
        loading,
        isSignedIn: Boolean(session?.user),
        signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
        signUp: (email, password) => supabase.auth.signUp({ email, password }),
        signOut: () => supabase.auth.signOut(),
        /**
         * profiles has no signup trigger, so the row is ours to create.
         * The id is passed in rather than read from state: straight after
         * signUp resolves, onAuthStateChange hasn't flushed to React yet, and
         * reading session here finds nothing.
         */
        createProfile: async (username, userId) => {
            const id = userId || session?.user?.id;
            if (!id) return { error: new Error('Not signed in') };
            const { error } = await supabase.from('profiles').insert({ id, username });
            if (!error) await loadProfile(id);
            return { error };
        },
        refreshProfile: () => loadProfile(session?.user?.id),
    };

    // Never block the app on the session check: a guest must not wait behind
    // authentication they don't have.
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
