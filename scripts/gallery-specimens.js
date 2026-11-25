/**
 * Every control, and the states and content cases it must survive.
 *
 * This file is the design work. `docs/CONTROLS.md` C1 lists the states a
 * control owes and C2 the cases it must survive; this is those lists applied,
 * control by control, so that each one can be looked at rather than reasoned
 * about.
 *
 * `html` may contain `{icon:name}`, which is rendered by the REAL `Icon`
 * component through vite-node -- not a hand-copied SVG. An icon that is
 * dropped from the role map disappears from the gallery too, rather than
 * living on here as a picture of something the product no longer has.
 *
 * A state listed here is forced by `[data-force~="..."]`, which the generator
 * derives from the product's own `:hover` / `:focus-visible` / `:active` /
 * `:disabled` rules. If a control has no rule for a state, its cell renders
 * identical to rest -- which is the point: the gap is visible, not inferred.
 */

/** Everything a control can be asked to be. */
export const ALL_STATES = ['rest', 'hover', 'focus-visible', 'active', 'disabled', 'selected'];

const LONG = 'Science Fiction &amp; Fantasy';

export const SPECIMENS = [
    /* ---------------- buttons ---------------- */
    { group: 'Buttons', name: 'btn', cls: 'btn', html: 'Add to library',
        states: ['rest', 'hover', 'focus-visible', 'active', 'disabled'] },
    { group: 'Buttons', name: 'btn.quiet', cls: 'btn quiet', html: 'Not now',
        states: ['rest', 'hover', 'focus-visible', 'active', 'disabled'] },
    { group: 'Buttons', name: 'btn + icon', cls: 'btn', html: '{icon:add}Add to library',
        states: ['rest', 'hover', 'focus-visible'] },
    { group: 'Buttons', name: 'btn, longest label', cls: 'btn quiet', html: LONG,
        states: ['rest'] },
    { group: 'Buttons', name: 'circ', cls: 'circ', html: '{icon:settings}',
        states: ['rest', 'hover', 'focus-visible', 'disabled'] },
    { group: 'Buttons', name: 'ibtn', cls: 'ibtn', html: '{icon:heart}',
        states: ['rest', 'hover', 'focus-visible', 'selected'] },

    /* ---------------- chips ---------------- */
    { group: 'Chips', name: 'chip', cls: 'chip', html: 'Documentary',
        states: ['rest', 'hover', 'focus-visible', 'selected'] },
    { group: 'Chips', name: 'chip + count', cls: 'chip', html: 'Documentary<em>142</em>',
        states: ['rest', 'hover', 'selected'] },
    /* The one that shipped broken: a chip that carries its own removal. */
    { group: 'Chips', name: 'chip.on + cross', cls: 'chip on', html: 'Action{icon:close}',
        states: ['rest', 'hover', 'focus-visible'] },
    { group: 'Chips', name: 'chip, longest label', cls: 'chip on', html: `${LONG}{icon:close}`,
        states: ['rest'] },
    { group: 'Chips', name: 'sw', cls: 'sw', html: 'Episodes<em>62</em>',
        states: ['rest', 'hover', 'focus-visible', 'selected'] },
    { group: 'Chips', name: 'seg', cls: 'seg', html: 'Films',
        states: ['rest', 'hover', 'focus-visible', 'selected'] },

    /* ---------------- fields ---------------- */
    { group: 'Fields', name: 'inp', cls: 'inp', tag: 'input', attrs: { value: 'Christopher Nolan' },
        states: ['rest', 'hover', 'focus-visible', 'disabled'] },
    { group: 'Fields', name: 'inp, empty', cls: 'inp', tag: 'input', attrs: { placeholder: 'Your name' },
        states: ['rest', 'focus-visible'] },
    { group: 'Fields', name: 'searchbox', cls: 'searchbox', tag: 'input',
        attrs: { placeholder: 'Films, series, people' },
        states: ['rest', 'hover', 'focus-visible'] },
    { group: 'Fields', name: 'searchbox, invalid', cls: 'searchbox', tag: 'input',
        attrs: { 'aria-invalid': 'true', value: '!!' }, states: ['rest'] },

    /* ---------------- rating and marks ---------------- */
    { group: 'Rating', name: 'stp', cls: 'stp', html: '{icon:add}',
        states: ['rest', 'hover', 'focus-visible', 'disabled'] },
    /* Not interactive, but it is where the star sat on top of the number on
       every poster in the product, so it is drawn here from now on. */
    { group: 'Rating', name: 'score-badge', cls: 'score-badge', tag: 'span',
        html: '{icon:star} 7.4', states: ['rest'] },
    { group: 'Rating', name: 'score-badge, 10.0', cls: 'score-badge', tag: 'span',
        html: '{icon:star} 10.0', states: ['rest'] },

    /* ---------------- feedback ---------------- */
    { group: 'Feedback', name: 'toast', cls: 'toast', tag: 'div', surface: true,
        html: 'Added to your library', states: ['rest'] },
    { group: 'Feedback', name: 'empty', cls: 'empty', tag: 'div', surface: true,
        html: '<p>Nothing here yet</p>', states: ['rest'] },
    { group: 'Feedback', name: 'errbox', cls: 'errbox', tag: 'div', surface: true,
        html: 'That did not load. Try again.', states: ['rest'] },
];
