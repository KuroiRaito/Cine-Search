/**
 * How much of a person's page shows at once.
 *
 * Two caps, and one idea shared between them: **read the number off the
 * rendered box, never declare it.**
 *
 * The filmography is a `.grid`, and `.grid` does not have a column count — it
 * has `repeat(auto-fill, minmax(var(--grid-min), 1fr))` and `--grid-min` steps
 * 136 -> 170 -> 180 -> 208px across the bands (tokens.css:189,
 * shell.css:244,255,337). That is roughly 2/3/5/6 columns, so there is no
 * tile count that is two rows at every width. Any JS that recomputed it from
 * the breakpoints would be a second spelling of a value the stylesheet already
 * owns — CLAUDE.md §7, "one state spelled two ways in two places", with the
 * stylesheet as the other spelling and the two free to drift at the next band
 * change. Reading `gridTemplateColumns` back cannot drift, because it *is* the
 * stylesheet's own answer.
 *
 * The same argument applies to the biography's five lines: `--lh-body-sm` is
 * the line height, and the cap is five of whatever that currently is.
 *
 * `null` is the answer when there is no answer, and `null` means **do not
 * cap** — show everything, no button. Nothing is ever hidden behind a control
 * that might not work.
 */
import { useCallback, useState } from 'react';

/** Two rows of filmography before the fold. Raman's call, Nov 2026. */
export const CAP_ROWS = 2;

/** Five lines of biography before the fold. Same call. */
export const BIO_LINES = 5;

/**
 * Sub-pixel slack on the biography's overflow test.
 *
 * `scrollHeight` is an integer and `lineHeight * lines` is not always one, so
 * a paragraph that fits exactly can measure a fraction over its own cap. The
 * slack is what stops a "View more" that reveals nothing.
 */
export const CLAMP_SLACK = 1;

/**
 * How many columns the grid actually laid out, or `null` if it has not.
 *
 * The test is **positive** — every track must be a resolved pixel length —
 * and that is load-bearing, not fastidiousness. An element that is not being
 * laid out reports the *specified* value instead of the used one, and the
 * specified value here is the literal string
 * `repeat(auto-fill, minmax(136px, 1fr))`. Split on whitespace that is three
 * pieces, which reads as three columns and caps a filmography at six tiles
 * for a reason that has nothing to do with the width. A blocklist ("reject
 * anything containing `repeat`") would have let the next unresolved spelling
 * through; only a positive test closes the class.
 *
 * That is CLAUDE.md §7's most expensive shape — "absent must never become
 * plausible" — with a plausible column count where there is no column count
 * at all.
 */
export function columnsOf(gridTemplateColumns) {
    // Line names are legal in a used value and are not tracks: `[full-start]
    // 136px 136px [full-end]` is two columns, not four.
    const tracks = String(gridTemplateColumns ?? '')
        .replace(/\[[^\]]*\]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!tracks.length) return null;
    // There were two more guards here -- `!v` and `v === 'none'`. Both were
    // subsumed by the two lines above: '' splits to nothing, and 'none' is
    // not a pixel length. They read as caution and were worse than nothing,
    // because reinstating either bug changed no behaviour and fired no case,
    // which is a guard that has never been tested pretending to be one that
    // has. Every line left here fails a case of its own when removed.
    if (!tracks.every((t) => /^[\d.]+px$/.test(t))) return null;
    return tracks.length;
}

/** How many tiles are `rows` rows, or `null` when the column count is not one. */
export function capOf(cols, rows = CAP_ROWS) {
    if (!Number.isInteger(cols) || cols < 1) return null;
    if (!Number.isInteger(rows) || rows < 1) return null;
    return cols * rows;
}

/** `"20px"` -> `20`; `"normal"`, `""`, `null` -> `null`. */
export function pxOf(v) {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Does `full` content height overflow `lines` lines, and where is the cap?
 *
 * `max` is the height five lines occupy. It is not applied as a style — the
 * clamp is `.bio.bio-clamp` in person.css, because a clamp is a paint
 * decision and `verify` check 5 is right to refuse `maxHeight` from JSX. It
 * is the threshold the overflow test compares against, which is the only
 * reason the button knows whether it has anything to reveal.
 */
export function clampOf(full, lineHeight, lines = BIO_LINES) {
    if (!Number.isFinite(full) || !Number.isFinite(lineHeight) || lineHeight <= 0) return null;
    if (!Number.isInteger(lines) || lines < 1) return null;
    const max = Math.round(lineHeight * lines);
    return { max, overflows: full - max > CLAMP_SLACK };
}

/**
 * Observe an element and report how many columns it is laying out.
 *
 * A **callback ref**, not `useLayoutEffect` with `[]`, for two reasons that
 * are both bugs in the other shape:
 *
 *   1. `Body` renders no grid at all while `items.length === 0`, so somebody
 *      who filters a person to "Not seen" with everything seen, then
 *      unfilters, gets a grid that a `[]` effect never measures. A callback
 *      ref runs whenever the node changes, which is the actual event.
 *   2. React 19 callback refs may return a cleanup function, which replaces
 *      the `(null)` call — so the observer is disconnected without a
 *      `setState` on an element that is going away.
 *
 * It runs during commit, before paint, so the cap is applied with no flash
 * even though the first render emits every tile.
 */
export function useGridColumns() {
    const [cols, setCols] = useState(null);
    const ref = useCallback((el) => {
        if (!el) return undefined;
        const read = () => setCols(columnsOf(getComputedStyle(el).gridTemplateColumns));
        read();
        if (typeof ResizeObserver === 'undefined') return undefined;
        // `auto-fill`, not `auto-fit`: empty tracks are kept, so the column
        // count does not depend on how many tiles are currently rendered.
        // That is what stops the cap oscillating — capping 26 tiles to 12
        // cannot change the answer that produced the 12. Measured, not
        // assumed: see scripts/person-cases.mjs.
        const observer = new ResizeObserver(read);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return [ref, cols];
}

/**
 * Observe an element and report whether its content overflows `lines` lines.
 *
 * Same shape and the same two reasons. One hazard of its own: this returns a
 * fresh object every read, and the observer is watching the very element the
 * clamp resizes — a new reference each time would re-render forever. So the
 * setter keeps the previous object when nothing about it changed. (`cols`
 * above is a number, so React bails out on equality by itself.)
 *
 * It reads `scrollHeight`, which reports the **full** content height even
 * while `-webkit-line-clamp` is clipping the box — measured in Chromium at
 * 320/768/1440, not assumed. That is what makes one measurement serve both
 * states: if it reported the clipped height instead, `overflows` would read
 * false the moment the text was expanded and the "View less" button would
 * vanish underneath the reader.
 */
export function useLineClamp(lines = BIO_LINES) {
    const [box, setBox] = useState(null);
    const ref = useCallback((el) => {
        if (!el) return undefined;
        const read = () => {
            const next = clampOf(el.scrollHeight, pxOf(getComputedStyle(el).lineHeight), lines);
            setBox((prev) => (
                prev && next && prev.max === next.max && prev.overflows === next.overflows
                    ? prev
                    : next
            ));
        };
        read();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(read);
        observer.observe(el);
        return () => observer.disconnect();
    }, [lines]);
    return [ref, box];
}
