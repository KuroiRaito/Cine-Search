import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * How far down a list somebody had got, kept with the history entry. A7, E31,
 * M8.
 *
 * Scroll position was already restored, and on a paginated screen that was
 * half an answer that behaved like none. Somebody three pages into Browse taps
 * a film and comes back: the grid refetches page one, the document is a third
 * of the height it was, and the restore — which waits for the page to be tall
 * enough to hold the position it remembers — never gets its height and gives
 * up at the top. The scroll restore looked broken. It was not: it was being
 * asked to land on a list that had shrunk underneath it.
 *
 * Keyed by the history entry, exactly as the scroll position is, and for the
 * same reasons. Two visits to /search are two entries with two depths, the
 * same path can sit on the stack twice, and a depth from a previous session
 * would point into results that have since moved. Kept in memory with the
 * positions it has to agree with: if one survived a reload and the other did
 * not, the pair would restore a position into a list that is not the one it
 * was measured against, which is the bug this module exists to remove.
 *
 * A replace — which is how every keystroke in the search box reaches the URL —
 * mints a new entry, so a new query starts at page one without anyone having
 * to remember to reset it.
 */
const depths = new Map();

/**
 * `useState` for a page number that survives going back.
 *
 * Returns the same pair useState does, so a screen adopts it by changing one
 * line. That is the point: a paginated screen that uses plain state has a bug
 * nobody will see until they go back, and the only way to stop writing that
 * bug is to make the version that works no harder to reach.
 */
export function useRestoredPage(id = 'page') {
    const { key } = useLocation();
    const slot = `${key}:${id}`;
    const [page, setPage] = useState(() => depths.get(slot) ?? 1);
    useEffect(() => { depths.set(slot, page); }, [slot, page]);
    return [page, setPage];
}

/** Test seam. The Map is module state, and a harness needs it empty. */
export const forgetDepths = () => depths.clear();
export const depthFor = (key, id = 'page') => depths.get(`${key}:${id}`) ?? null;

/**
 * Whether a scroll event is the page moving rather than the person moving.
 *
 * A listener that records scroll positions writes under the entry it is
 * leaving until React runs its effect again, and the DOM swap happens first.
 * So replacing a tall list with a shorter page makes the browser clamp the
 * position to the new maximum, and that clamp arrives as a scroll event
 * against the list that is already gone.
 *
 * The pair that identifies it: the document just got shorter, and the new
 * position is the most the document can now hold. Somebody scrolling to the
 * bottom of a page that did not change its height is not this.
 */
export const isClamp = (y, height, innerHeight, previousHeight) =>
    height < previousHeight && y >= height - innerHeight - 1;

/**
 * How much of a remembered position the document can currently hold.
 *
 * The greatest legal scrollY is `height - innerHeight`, so a position recorded
 * at the bottom of a list is frequently a fraction beyond what the same list
 * can hold when rebuilt — 946.5 against a maximum of 946, on a real page. A
 * restore that waits for the document to be tall enough to hold such a
 * position waits for ever.
 *
 * So it is clamped rather than gated, and a caller that re-reads it each frame
 * follows the document down as the rest of it arrives.
 */
export const reachable = (target, height, innerHeight) =>
    Math.min(target, Math.max(0, height - innerHeight));
