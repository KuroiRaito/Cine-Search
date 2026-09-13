import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// createClient() throws synchronously when the URL/key are missing, which would
// take down the whole app at module load - including the guest flow, which does
// not need Supabase at all. Fall back to an inert client so guest mode still
// works on an environment where Supabase vars are not configured.
function createUnconfiguredClient() {
    const notConfigured = () => ({
        data: { user: null, session: null },
        error: new Error('Supabase is not configured'),
    });

    return {
        auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({
                data: { subscription: { unsubscribe: () => {} } },
            }),
            signUp: async () => notConfigured(),
            signInWithPassword: async () => notConfigured(),
            signOut: async () => ({ error: null }),
        },
        from() {
            throw new Error('Supabase is not configured');
        },
    };
}

if (!isSupabaseConfigured) {
    console.warn(
        'Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
        'Account sign-in is disabled; guest mode still works.'
    );
}

export const supabase = isSupabaseConfigured
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : createUnconfiguredClient();
