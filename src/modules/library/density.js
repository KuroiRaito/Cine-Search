/**
 * Two densities, and the difference is artwork.
 *
 * Compact is the same list, not a lesser one: it keeps the status as a stripe,
 * the progress as a fraction and the score as a number — everything the
 * comfortable row says except the poster. Somebody scanning two hundred
 * finished films does not need two hundred posters; somebody choosing what to
 * watch tonight does. docs/library-module.html §03.
 */
const KEY = 'cine_library_density';

export const DENSITIES = ['comfortable', 'compact'];

/**
 * Remembered globally, and never changed on somebody's behalf.
 *
 * No "we switched you to compact because your library got big". The one thing
 * a record must be is predictable, so this only ever changes when it is
 * tapped — unlike the sort, which is per shelf and per session.
 */
export function readDensity() {
    try {
        const v = localStorage.getItem(KEY);
        return DENSITIES.includes(v) ? v : 'comfortable';
    } catch {
        return 'comfortable';
    }
}

export function writeDensity(value) {
    try { localStorage.setItem(KEY, value); } catch { /* private mode: this session only */ }
}

/**
 * What the compact row's two right-hand slots carry.
 *
 * One slot, two jobs, decided by whether a next episode exists — and that is
 * the whole behavioural difference between the densities. A series you are
 * part-way through keeps the +, because compact is exactly where somebody is
 * ticking through a backlog. Anything finished has no next episode, so the slot
 * carries the thing you would otherwise open the row to see.
 *
 * Unrated returns an empty trailing slot rather than no slot: the column stays
 * a column.
 */
export function compactSlots(row) {
    // Unfinished is about the count, not about whether a next episode could be
    // named. A series at 0 of 10 whose season data has not arrived is not
    // "finished" — showing its release year there would be answering a
    // question nobody asked.
    const unfinished = row.mediaType === 'tv' && row.total > 0 && row.seen < row.total;
    if (unfinished) {
        return {
            middle: `${row.seen}/${row.total}`,
            // The + needs an episode to name. Without one the slot stays empty
            // rather than offering a button that cannot say what it would do.
            trailing: row.next ? 'bump' : 'empty',
        };
    }
    return {
        middle: row.year || '—',
        trailing: row.rating != null ? 'score' : 'empty',
    };
}
