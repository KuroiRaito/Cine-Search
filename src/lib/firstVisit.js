// The cover page is shown once, on a first visit, and never again.
// A cover page that reappears every visit is a wall, and the product's first
// principle forbids walls.

const KEY = 'cine_seen_cover';

export function hasSeenCover() {
    try { return localStorage.getItem(KEY) === '1'; }
    catch { return true; }   // private mode: never trap someone behind the cover
}

export function markSeen() {
    try { localStorage.setItem(KEY, '1'); } catch { /* nothing to do */ }
}
