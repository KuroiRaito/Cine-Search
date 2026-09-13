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

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* private mode: this session only */ }
}

/** Call once before first paint so a stored choice doesn't flash the other theme. */
export function restoreTheme() {
    const t = storedTheme();
    if (t) document.documentElement.setAttribute('data-theme', t);
}
