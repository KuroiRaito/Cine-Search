/**
 * One option in a segmented control.
 *
 * Three call sites, three different ideas of what "selected" means:
 *
 *   Editor.jsx      className={`seg ${s.tone}${status === s.key ? ' on' : ''}`}
 *                   aria-pressed={status === s.key}          -- both, agreeing
 *   Settings.jsx    className={`seg${theme === t ? ' on st-done' : ''}`}
 *                   aria-pressed={theme === t}               -- both, agreeing
 *   FilterPanel.jsx className="seg"
 *                   aria-pressed={facets.kind === k.key}     -- ATTRIBUTE ONLY
 *
 * `.seg.on` is the only rule that draws a selected segment, so the third one
 * never looked selected. The Kind filter announced its state correctly to a
 * screen reader and showed nothing at all to everybody else, and it had been
 * doing that for as long as the control has existed. Nobody saw it because
 * seeing it required reading three files at once and knowing which of two
 * spellings the stylesheet listens to.
 *
 * That is the entire case for a component layer, in one control. `selected`
 * is now one prop that writes both spellings, so they cannot disagree, and
 * the bug is not fixable-here-and-broken-there any more -- it is fixed.
 */

import selectionAttr from './selection.js';

export function Segment({
    selected = false,
    tone,
    className = '',
    children,
    ...rest
}) {
    const cls = ['seg', tone, className].filter(Boolean).join(' ');
    /* C4 -- one spelling, and it is the one the role requires. The `.on`
       class is gone: the stylesheet selects on the attribute now, so there
       is no second place for the state to be written and no way for the two
       to disagree. */
    return (
        <button
            type={rest.type || 'button'}
            {...rest}
            className={cls}
            {...{ [selectionAttr(rest.role)]: selected }}
        >
            {children}
        </button>
    );
}

export default Segment;
