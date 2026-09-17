import { fold } from './find.js';

/**
 * Six ways to order a shelf, and the right one depends on the shelf.
 *
 * "Recently updated" is right for Watching and pointless on Watched, where
 * nobody is asking what they touched last — they are asking what was good. A
 * sort that is correct on one shelf and useless on the next should not be one
 * global setting. docs/library-module.html §03.
 */
export const SORTS = [
    { key: 'updated', label: 'Recently updated', note: 'recently updated', answers: 'what was I doing' },
    { key: 'added', label: 'Recently added', note: 'recently added', answers: 'what did I just save' },
    { key: 'title', label: 'Title A–Z', note: 'title', answers: 'where is the one I am thinking of' },
    { key: 'rating', label: 'Your rating', note: 'your rating', answers: 'what did I love' },
    { key: 'year', label: 'Release year', note: 'release year', answers: 'what era is this shelf' },
    { key: 'progress', label: 'Progress', note: 'progress', answers: 'what is nearly finished' },
];

export const sortMeta = (key) => SORTS.find((s) => s.key === key) || SORTS[0];

/**
 * What the group header says it is doing: "142 · by your rating".
 *
 * A separate phrase rather than the lowercased label, because lowercasing
 * "Title A–Z" gives "by title a–z", which reads as a typo.
 */
export const sortNote = (key) => `· by ${sortMeta(key).note}`;

/**
 * The default changes with the shelf, and that is the point.
 *
 * Everything not named here falls to "recently updated", which is the answer to
 * "what was I doing" — the right question for a shelf you are in the middle of.
 */
const DEFAULTS = {
    want_to_watch: 'added',
    watched: 'rating',
};
export const defaultSortFor = (shelf) => DEFAULTS[shelf] || 'updated';

/**
 * An option is offered when it can actually order this shelf.
 *
 * Not a per-shelf list, because a list has to be maintained and will drift from
 * what the rows contain. "Your rating" on a shelf where nothing is rated would
 * be a control that does nothing; "Progress" on Watched would sort a column of
 * hundred-percents. Ask the rows instead.
 */
export function availableSorts(rows) {
    const has = (fn) => (rows || []).some(fn);
    return SORTS.filter((s) => {
        if (s.key === 'rating') return has((r) => r.rating != null);
        if (s.key === 'progress') return has((r) => r.mediaType === 'tv' && r.total > 0 && r.seen < r.total);
        if (s.key === 'year') return has((r) => r.year);
        return true;
    });
}

/* Nulls sort last in every order: a row with nothing to say about the thing
   being sorted on has not earned the top of the list. */
const lastIfNull = (v) => (v == null || v === '' ? null : v);

const BY = {
    updated: (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
    added: (a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')),
    title: (a, b) => fold(a.title).localeCompare(fold(b.title)),
    rating: (a, b) => cmpDesc(lastIfNull(a.rating), lastIfNull(b.rating)),
    year: (a, b) => cmpDesc(lastIfNull(a.year), lastIfNull(b.year)),
    progress: (a, b) => cmpDesc(fraction(a), fraction(b)),
};

function cmpDesc(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return b > a ? 1 : b < a ? -1 : 0;
}

const fraction = (r) => (r.mediaType === 'tv' && r.total ? r.seen / r.total : null);

/**
 * Sorted, with a stable tie-break on title.
 *
 * Without one, two films rated 8 swap places whenever the list is rebuilt —
 * which on this screen happens every time a tick lands, so a row would appear
 * to move because somebody marked an unrelated episode watched.
 */
export function applySort(rows, key) {
    const cmp = BY[key] || BY.updated;
    return [...(rows || [])].sort((a, b) => cmp(a, b) || fold(a.title).localeCompare(fold(b.title)));
}
