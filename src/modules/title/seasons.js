/**
 * What a season is called, and where it sits.
 *
 * §03b, all four rules found by looking at real series rather than by
 * imagining them:
 *
 *   Grey's Anatomy has 24 seasons          the row scrolls, and the selected
 *                                          tab is scrolled into view on arrival
 *   Season 0 holds 68 episodes on Grey's   specials get a tab, and it is last;
 *                                          excluded from the denominator
 *   Chernobyl's one season is "Miniseries" tabs use season.name, never a
 *                                          composed "Season N"
 *   Seasons exist with no poster or date   the tab is a name and a count
 */

const GENERIC = /^season\s+\d+$/i;

/** Specials last, never first: leading with an unticked 68 would put them in
 *  front of somebody's real progress. */
export function orderTabs(seasons, specials) {
    return [...(seasons || []), ...(specials ? [specials] : [])];
}

/**
 * The pill. Short, because two dozen of them share one scrolling row — but
 * never short at the cost of being wrong: a season TMDB gives a real name
 * keeps it, which is the whole point of the rule.
 */
export function tabLabel(s) {
    const n = s.season_number ?? s.n;
    if (n === 0) return 'Specials';
    const name = (s.name || '').trim();
    return !name || GENERIC.test(name) ? `S${n}` : name;
}

/** The band header, which has room for the long form. */
export function seasonTitle(s) {
    const n = s.season_number ?? s.seasonNumber ?? s.n;
    if (n === 0) return 'Specials';
    const name = (s.name || '').trim();
    return name || `Season ${n}`;
}

/** How many of a season are ticked. The map is keyed by string. */
export const seenIn = (watched, n) => (watched?.[String(n)] ?? []).length;

/**
 * TV7 — TMDB leaves the name blank for unaired runs, and a row that is just a
 * number with a full stop after it reads as a rendering fault.
 */
export const episodeName = (e) => (e.name || '').trim() || `Episode ${e.number}`;

/**
 * The count a pill carries. A fraction once there is progress in that season,
 * because "11 of 62" across five seasons tells you almost nothing and
 * "S2 · 4 of 13" tells you where you are.
 */
export function tabCount(s, watched) {
    const n = s.season_number ?? s.n;
    const total = s.episode_count ?? s.c ?? 0;
    const seen = seenIn(watched, n);
    return seen > 0 ? `${seen}/${total}` : String(total);
}
