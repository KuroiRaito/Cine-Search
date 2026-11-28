/**
 * The searches somebody actually made, kept so the box is never a blank
 * question.
 *
 * FQ0 — the resting state is "recents, then presets", and explicitly *not*
 * "What are you looking for?", which asks a question the person answered by
 * arriving. FQ11 — the nothing-found screen offers the same two, because the
 * thing someone needs after a dead end is a way back to something that worked.
 *
 * Only searches that found something are kept. A recent that leads nowhere is
 * not a way out, and the screen it would appear on most often is the one for a
 * search that just failed.
 */

const KEY = 'cine_recent_searches';
/* Six, because this renders as one chip row and a row that scrolls to reach
   its eighth entry is a list pretending to be a shortcut. */
const CAP = 6;

const read = () => {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
        /* Anything could be in storage: another tab's older format, a hand
           edit, a half-written value. Trust the shape, not the key. */
        return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.trim()) : [];
    } catch {
        return [];
    }
};

export const recentSearches = () => read().slice(0, CAP);

/**
 * Record a query, newest first.
 *
 * Case-insensitive de-duplication, because "Inception" and "inception" are one
 * search to the person making it — and the spelling kept is the newest one,
 * since that is the one they just chose to type.
 */
export function rememberSearch(query) {
    const q = String(query || '').trim();
    if (!q) return;
    const fold = q.toLowerCase();
    const next = [q, ...read().filter((s) => s.toLowerCase() !== fold)].slice(0, CAP);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
}

export function forgetSearches() {
    try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
