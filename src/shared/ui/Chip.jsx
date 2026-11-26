/**
 * The chip — and the reason this whole component layer exists.
 *
 * A filter chip reached production with its close cross on a second line,
 * 32px tall where it should have been 48. The mechanism was `.icon` being
 * `display: block` inside a `.chip` that declared no row, and the fix was one
 * line of CSS. But the reason it SHIPPED is here, not there: `.chip` was a
 * class name applied by hand at eight sites, and the one site that added a
 * cross had no way of knowing it was the first to do so. Nothing owned the
 * markup, so nothing knew the case existed.
 *
 * So the cross is not something a caller assembles any more. `onRemove` is a
 * prop, the icon beside the label is written once, here, and the next chip
 * that needs one cannot write it a different way.
 *
 * ---- the two selected looks, and the third one nobody designed ----
 *
 * Writing this component turned up something no reading of the CSS had. The
 * chip had TWO selected appearances, spelled two different ways in two
 * different layers:
 *
 *   ui.css      .chip[aria-pressed="true"]   solid fill   bg 37,186,223  dark text  + inset hl
 *   search.css  .chip.on                     soft tint    bg 10,37,48    cyan text    no shadow
 *
 * Both are 0,2,0 specificity, so which one wins was decided by which CSS
 * chunk loaded last — `.chip.on` shipped in the lazily-loaded search chunk
 * and therefore won on the search route by accident of bundling.
 *
 * And an element carrying BOTH spellings measured as neither: the tint from
 * `.on`, the inset highlight from `aria-pressed`. A third appearance that is
 * in no specification, reachable the moment one component wrote both. The
 * first draft of this file wrote both.
 *
 * So the two looks are now two named roles, one spelling each, because they
 * were never the same idea:
 *
 *   selected   a filter option that is ON       -> aria-pressed, solid fill
 *   onRemove   an applied filter you take OFF   -> .applied, soft tint
 *
 * A remove button was never "pressed" in the first place; it says what it
 * does. The soft tint moved to ui.css as `.chip.applied`, a declared variant
 * of the shared control, so no module restyles the chip any more (C5.2).
 */
import Icon from './Icon.jsx';

export function Chip({
    as: As = 'button',
    selected = false,
    applied = false,
    count,
    onRemove,
    className = '',
    children,
    ...rest
}) {
    /* `applied` is implied by `onRemove`: a chip that can come off is a chip
       that is on. Spelling it separately as well is allowed but never
       required, so a caller cannot produce a removable chip that looks
       inactive. */
    const isApplied = applied || Boolean(onRemove);
    const cls = ['chip', isApplied && 'applied', className].filter(Boolean).join(' ');
    const props = { ...rest, className: cls };

    if (As === 'button') {
        props.type = rest.type || 'button';
    }
    /* C4 -- one prop, one spelling. `aria-pressed` is the source of truth
       because it is the one a browser and a screen reader can both read, and
       it is what ui.css selects on. The class spelling is gone. An applied
       chip never claims to be pressed: it is a remove button. */
    if (selected && !isApplied) props['aria-pressed'] = 'true';

    return (
        <As {...props}>
            {children}
            {/* A count is part of the label, not a second control: "Documentary 142"
                is one thing to read. <em> is what the stylesheet already dims. */}
            {count !== undefined && count !== null && <em>{count}</em>}
            {/* The case that broke. One place, one size, one icon. */}
            {isApplied && onRemove && <Icon name="close" size={16} />}
        </As>
    );
}

/**
 * A chip whose whole job is to come off again — the applied-filter row.
 *
 * Separate from Chip because the click target means something different: this
 * removes the filter, where a plain chip applies one. Same markup, opposite
 * direction, and a caller that confuses them now has to do it on purpose.
 */
export function RemovableChip({ onRemove, label, ...rest }) {
    return (
        <Chip
            onRemove={onRemove}
            onClick={onRemove}
            /* The cross is an icon with no text, so without this the control
               announced only "Documentary" and gave no clue it removed
               anything. The visible label is unchanged. */
            aria-label={`Remove ${label}`}
            {...rest}
        >
            {label}
        </Chip>
    );
}

export default Chip;
