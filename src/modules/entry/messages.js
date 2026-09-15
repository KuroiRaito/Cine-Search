/**
 * Supabase's own wording is for developers. These are for people.
 *
 * Keyed on `error.code` first, because the codes are Supabase's stable contract
 * and the messages are not: matching on prose meant a reworded message silently
 * became "Something went wrong". Every code below was read off a live response
 * from this project, not from documentation.
 */
export function humanError(error) {
    if (!error) return null;

    const code = error.code || '';
    const message = String(error.message || '');
    const m = message.toLowerCase();

    // The invitation gate raises inside a BEFORE INSERT trigger on auth.users,
    // which Supabase can only report as a bare 500 — and supabase-js turns
    // every 500 into an AuthRetryableFetchError, the same class it uses when
    // the network is down. Checked first, because the network branch below
    // would otherwise answer "check your connection" to a person whose
    // connection is fine and whose email simply isn't on the list.
    if (m.includes('database error saving new user') || m.includes('by invitation')) {
        return 'Sign-ups are by invitation. Ask Raman to add your email.';
    }

    // No network at all. supabase-js wraps a failed fetch rather than giving it
    // a status, and "Failed to fetch" is not a sentence anyone should be shown.
    // A retryable error carrying a real status came from a server that
    // answered; only a statusless one means we never reached it.
    if ((error.name === 'AuthRetryableFetchError' && !error.status)
        || m.includes('failed to fetch') || m.includes('networkerror')
        || m.includes('load failed')) {
        return 'Can’t reach the server. Check your connection and try again.';
    }

    switch (code) {
        // The same answer for a wrong password and an unknown email, on
        // purpose: telling them apart tells a stranger which emails have
        // accounts here.
        case 'invalid_credentials':
            return 'That email and password don’t match.';
        case 'user_already_exists':
        case 'email_exists':
            return 'That email already has an account. Sign in instead.';
        case 'weak_password':
            return 'That password doesn’t meet the requirements below.';
        case 'validation_failed':
            return m.includes('email')
                ? 'That doesn’t look like an email address.'
                : 'Check the details you entered.';
        case 'email_not_confirmed':
            return 'Confirm your email first — the link is in your inbox.';
        case 'over_request_rate_limit':
        case 'over_email_send_rate_limit':
            return 'Too many attempts. Wait a minute and try again.';
        case 'same_password':
            return 'That’s the password you already have. Choose a different one.';
        case 'session_expired':
        case 'refresh_token_not_found':
        case 'refresh_token_already_used':
            return 'Your session ended. Sign in again.';
        case 'user_not_found':
            return 'There’s no account for that email.';
        // PostgREST, not auth: the unique index on profiles.username.
        case '23505':
            return 'That username is taken. Try another.';
        default:
            break;
    }

    if (m.includes('duplicate key') || m.includes('profiles_username')) {
        return 'That username is taken. Try another.';
    }

    if (error.status === 429) return 'Too many attempts. Wait a minute and try again.';
    if (error.status >= 500) return 'Something went wrong at our end. Try again in a moment.';

    return message || 'Something went wrong. Try again.';
}

/**
 * Sign-up can succeed and still not sign you in. Two ways, and they are
 * different problems wearing the same response.
 */
export function signUpOutcome({ data, error }) {
    if (error) return { kind: 'error', message: humanError(error) };
    // Supabase's anti-enumeration answer when email confirmation is on: a user
    // object that looks real, with no identities behind it. This project has
    // confirmation off and gets a proper error instead — but the toggle is one
    // click away, and this is what the day after that click looks like.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { kind: 'error', message: 'That email already has an account. Sign in instead.' };
    }
    if (!data?.session) return { kind: 'confirm-email' };
    return { kind: 'signed-in', user: data.user };
}
