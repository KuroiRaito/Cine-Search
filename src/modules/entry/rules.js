// The rules the server actually enforces, written down where the form can see
// them.
//
// Every one of these was a wall you walked into: the form allowed a six
// character password and Supabase demanded eight, so the only way to learn the
// rule was to fail. A rule you can read before you type is not the same
// feature as a rule you are told about afterwards.

/**
 * Supabase's password policy for this project, character class by character
 * class. If the dashboard policy changes, this changes with it — a form that
 * promises less than the server demands is the bug we just fixed.
 */
export const PASSWORD_RULES = [
    { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
    { id: 'lower', label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
    { id: 'upper', label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
    { id: 'digit', label: 'A number', test: (v) => /[0-9]/.test(v) },
    // The exact set Supabase lists back at you when it refuses.
    { id: 'symbol', label: 'A symbol', test: (v) => /[!@#$%^&*()_+\-=[\]{};':"|<>?,./`~]/.test(v) },
];

export const passwordFailures = (v) => PASSWORD_RULES.filter((r) => !r.test(v || ''));

// Deliberately permissive. The only address this can reject is one that could
// not possibly be delivered to; anything cleverer starts refusing real
// addresses, and the server is the real check.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function emailProblem(value) {
    const v = (value || '').trim();
    if (!v) return 'Enter your email address.';
    if (!EMAIL.test(v)) return 'That doesn’t look like an email address.';
    return null;
}

/**
 * Names only what is missing.
 *
 * The five requirements are already on screen and ticking green as you type,
 * so repeating the whole rule underneath them is the form reading its own
 * notes back. Length is called out by itself because it is the one people hit
 * without noticing — every other requirement is a character you either typed
 * or did not. Foundations §13, U7 and U8.
 */
export function passwordProblem(value, { checkStrength = false } = {}) {
    if (!value) return 'Enter your password.';
    if (!checkStrength) return null;
    const missing = passwordFailures(value);
    if (!missing.length) return null;
    if (missing.length === 1 && missing[0].id === 'length') return 'At least 8 characters';
    return 'That password doesn’t meet the requirements below.';
}

// A username is a name, not a sentence. Letters, digits and the three
// separators people actually use — which is every existing account, checked.
const USERNAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,23}$/;

export function usernameProblem(value) {
    const v = (value || '').trim();
    if (!v) return 'Pick a username.';
    if (v.length < 3) return 'Usernames are at least 3 characters.';
    if (v.length > 24) return 'Usernames are at most 24 characters.';
    if (!USERNAME.test(v)) {
        return 'Letters, numbers, full stops, hyphens and underscores — starting with a letter or number.';
    }
    return null;
}
