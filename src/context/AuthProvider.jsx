/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const timer = setTimeout(() => {
            if (isMounted && loading) {
                setLoading(false);
            }
        }, 3000);

        const storedGuest = localStorage.getItem('cine_guest_user');
        if (storedGuest) {
            try {
                const parsed = JSON.parse(storedGuest);
                setUser(parsed);
                setLoading(false);
                clearTimeout(timer);
                return;
            } catch (e) {
                console.error(e);
                localStorage.removeItem('cine_guest_user');
            }
        }

        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!isMounted) return;
            setSession(session);
            if (session?.user) setUser(session.user);
            setLoading(false);
            clearTimeout(timer);
        }).catch((err) => {
            console.warn('Supabase session check failed:', err);
            if (isMounted) setLoading(false);
            clearTimeout(timer);
        });

        // Listen for changes on auth state (sign in, sign out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return;
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => {
            isMounted = false;
            clearTimeout(timer);
            subscription?.unsubscribe();
        };
    }, []);

    const loginAsGuest = (guestName = 'Guest Explorer') => {
        const mockUser = {
            id: 'guest-local-id',
            email: 'guest@cinesearch.local',
            user_metadata: { username: guestName },
            isGuest: true
        };
        localStorage.setItem('cine_guest_user', JSON.stringify(mockUser));
        setUser(mockUser);
    };

    const signOut = async () => {
        localStorage.removeItem('cine_guest_user');
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.warn('Supabase signout notice:', e);
        }
        setUser(null);
        setSession(null);
    };

    // Will be passed down to AuthContext.Provider
    const value = {
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signOut,
        loginAsGuest,
        user,
        session,
        loading,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

