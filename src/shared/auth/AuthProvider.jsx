import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';

const AuthContext = createContext(null);

/**
 * Who is this? There are three answers, not two.
 *
 * `restoring` is the one the app used to be missing, and its absence was the
 * bug: a returning session needs a network round trip to renew its access
 * token, and for that whole second every screen asked `isSignedIn`, got
 * `false`, and told a signed-in person they had no account. "We don't know
 * yet" is a state, and screens have to be able to say it.
 */
export const RESTORING = 'restoring';
export const SIGNED_IN = 'signed-in';
export const GUEST = 'guest';

/**
 * A deliberate sign-out, written where every tab can see it.
 *
 * supabase-js broadcasts SIGNED_OUT to the other tabs, but not the reason, so
 * a tab that did not press the button cannot tell "they signed out" from "the
 * session died" — and told the person their session had ended when in fact
 * they had just ended it themselves, next door. A timestamp in shared storage
 * is the missing half of the message.
 */
const SIGNOUT_MARK = 'cine_signed_out_at';
const MARK_WINDOW_MS = 15_000;

function markSignOut() {
    try { localStorage.setItem(SIGNOUT_MARK, String(Date.now())); } catch { /* private mode */ }
}
function signOutWasAsked() {
    try {
        const at = Number(localStorage.getItem(SIGNOUT_MARK));
        return Boolean(at) && Date.now() - at < MARK_WINDOW_MS;
    } catch { return false; }
}

/**
 * And a second question the app also used to answer with a shrug: is there a
 * profile row? `missing` is a real, reachable state — the account is made by
 * Supabase and the profile row by us, so anything that interrupts the gap
 * between them leaves an account with no username. It is recoverable, but only
 * if we can tell it apart from `error`, which is a network blip and recovers
 * itself.
 */
const PROFILE_UNKNOWN = 'unknown';
const PROFILE_LOADING = 'loading';
const PROFILE_READY = 'ready';
const PROFILE_MISSING = 'missing';
const PROFILE_ERROR = 'error';

/**
 * A guest is someone who isn't signed in — never a fabricated user object.
 * The old `guest-local-id` and its mirrored localStorage library are gone, and
 * they are not coming back: two databases to maintain forever the moment
 * episode progress and rewatch counts land.
 */
export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [status, setStatus] = useState(isSupabaseConfigured ? RESTORING : GUEST);
    const [profile, setProfile] = useState(null);
    const [profileState, setProfileState] = useState(PROFILE_UNKNOWN);

    // Set when a session ends without anybody asking it to — a refresh token
    // that was revoked, expired or already used. The person did not sign out;
    // they were signed out, and dropping them to a guest screen with no
    // explanation is the app losing their trust for something it did.
    const [sessionEnded, setSessionEnded] = useState(false);

    // Set when Supabase hands back a session from a password-reset link. It is
    // a real session, so the app would otherwise just look signed in and the
    // person would never be asked for the new password they came to set.
    const [recovering, setRecovering] = useState(false);

    const deliberateSignOut = useRef(false);
    const hadSession = useRef(false);
    // Which user the profile in state belongs to, so a token refresh every hour
    // does not refetch a row that cannot have changed.
    const profileFor = useRef(undefined);

    const loadProfile = useCallback(async (userId, { force = false } = {}) => {
        if (!force && profileFor.current === userId) return;
        profileFor.current = userId;

        if (!userId) {
            setProfile(null);
            setProfileState(PROFILE_UNKNOWN);
            return;
        }
        setProfileState(PROFILE_LOADING);
        const { data, error } = await supabase
            .from('profiles').select('id, username, region, services, theme')
            .eq('id', userId).maybeSingle();

        // A newer load started while this one was in flight: its answer wins.
        if (profileFor.current !== userId) return;

        if (error) {
            // Not the same as "no profile". A blocked or failed read must never
            // be mistaken for an account that needs setting up, or a blip sends
            // someone to choose a username they already have.
            setProfileState(PROFILE_ERROR);
            return;
        }
        setProfile(data ?? null);
        setProfileState(data ? PROFILE_READY : PROFILE_MISSING);
    }, []);

    useEffect(() => {
        let live = true;

        // INITIAL_SESSION always arrives — on success and on failure — so this
        // one subscription resolves `restoring` in every case, including the
        // one where Supabase itself is unreachable. Calling getSession() beside
        // it would only duplicate the answer and the profile fetch under it.
        const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
            if (!live) return;

            if (event === 'PASSWORD_RECOVERY') setRecovering(true);

            if (event === 'SIGNED_OUT') {
                // supabase-js only emits this when there was a session to
                // remove, so it arrives on a revoked refresh token at startup
                // too — before this subscriber has ever seen a session. Asking
                // "did we hold one?" would miss exactly that case, which is the
                // commonest way a session ends without anyone asking.
                setSessionEnded(!deliberateSignOut.current && !signOutWasAsked());
                deliberateSignOut.current = false;
                hadSession.current = false;
                setRecovering(false);
            }
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setSessionEnded(false);

            setSession(next ?? null);
            setStatus(next?.user ? SIGNED_IN : GUEST);
            if (next?.user) hadSession.current = true;
            loadProfile(next?.user?.id);
        });

        return () => { live = false; sub?.subscription?.unsubscribe(); };
    }, [loadProfile]);

    const value = {
        session,
        user: session?.user ?? null,
        profile,
        status,
        authReady: status !== RESTORING,
        isSignedIn: status === SIGNED_IN,
        // Kept for the screens that only ever asked "is the answer in yet".
        loading: status === RESTORING,

        profileState,
        // The account exists and the profile row does not. Distinct from a
        // failed read, which is `profileState === 'error'` and fixes itself.
        needsUsername: status === SIGNED_IN && profileState === PROFILE_MISSING,

        sessionEnded,
        dismissSessionEnded: () => setSessionEnded(false),
        recovering,
        endRecovery: () => setRecovering(false),

        signIn: (email, password) =>
            supabase.auth.signInWithPassword({ email: email.trim(), password }),

        signUp: (email, password) =>
            supabase.auth.signUp({ email: email.trim(), password }),

        requestPasswordReset: (email) =>
            supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/welcome/reset`,
            }),

        setPassword: (password) => supabase.auth.updateUser({ password }),

        signOut: async () => {
            // So the SIGNED_OUT that follows is read as "they asked" rather
            // than "the session died" — here, and in every other open tab.
            deliberateSignOut.current = true;
            markSignOut();
            const { error } = await supabase.auth.signOut();
            // supabase-js clears local storage even when the network call
            // fails, so the person is signed out here either way. Worth
            // reporting, not worth blocking on.
            if (error) deliberateSignOut.current = false;
            return { error };
        },

        /**
         * profiles has no signup trigger, so the row is ours to create.
         * The id is passed in rather than read from state: straight after
         * signUp resolves, onAuthStateChange hasn't flushed to React yet, and
         * reading session here finds nothing.
         */
        claimUsername: async (username, userId) => {
            const id = userId || session?.user?.id;
            if (!id) return { error: new Error('Not signed in') };
            const { error } = await supabase.from('profiles').insert({ id, username });
            if (!error) await loadProfile(id, { force: true });
            return { error };
        },

        refreshProfile: () => loadProfile(session?.user?.id, { force: true }),
    };

    // Never block the app on the session check: a guest must not wait behind
    // authentication they don't have. Screens that show account-shaped content
    // hold a skeleton while `status` is `restoring`; Discover does not have to.
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
