// Dark is the product's default. The toggle stamps an explicit choice on the
// root element, which is what the token file's [data-theme] blocks key off.
// With nothing stamped, the OS preference decides.

const KEY = 'cine_theme';

export function storedTheme() {
    try { return localStorage.getItem(KEY); } catch { return null; }
}

export function systemPrefersLight() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
}

/** What the viewer is actually looking at right now. */
export function activeTheme() {
    return storedTheme() || (systemPrefersLight() ? 'light' : 'dark');
}

/**
 * SH9 — the setting, which has three values where the control had two.
 *
 * Dark is the product's default and the OS preference decides while nothing is
 * stamped. That means following the system is what everybody gets until their
 * first tap — and until now there was no way back to it, because the toggle
 * only ever wrote a stamp. On a phone that switches at sunset, that is the
 * difference between an app that behaves like the others and one that does not.
 *
 * Choosing System removes the stamp rather than writing a third value, so the
 * media query is doing the work again rather than a copy of its answer.
 */
export function applyTheme(theme) {
    if (theme === 'system') {
        document.documentElement.removeAttribute('data-theme');
        try { localStorage.removeItem(KEY); } catch { /* private mode */ }
        return;
    }
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* private mode: this session only */ }
}

/** Which of the three is selected — not which colours are on screen. */
export function themeSetting() {
    return storedTheme() || 'system';
}

/** Call once before first paint so a stored choice doesn't flash the other theme. */
export function restoreTheme() {
    const t = storedTheme();
    if (t) document.documentElement.setAttribute('data-theme', t);
}
