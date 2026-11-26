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

/* ---------------- content cases ----------------

   A control has two kinds of case, and until now this file only carried one.
   `states` is what the control is DOING -- resting, hovered, disabled. These
   are what it is HOLDING, and they are the half that broke in production: the
   close cross dropped below the label on a filter chip, which is a content
   case, not a state.

   Everything below is real. The longest title and the Korean one are lifted
   out of snapshots/tmdb-fixtures.json.gz, the product's own recorded TMDB
   responses. `Action & Adventure` is TMDB's longest genre name and reaches
   the chip row the moment somebody filters a TV search. The Devanagari is
   there because facets.js leads with Hindi, Tamil and Telugu -- the Indian
   languages are why that facet exists at all, so a title in one of them is
   not an edge case in this product, it is Tuesday.

   The rule for adding one: it must be content the product will really hold.
   An invented 200-character string proves a control can be broken; it does
   not prove anything will break it. */

export const SPECIMENS = [
    /* ---------------- buttons ---------------- */
    { group: 'Buttons', name: 'btn', cls: 'btn', html: 'Add to library',
        content: [['longest', 'Mark this season as watched'], ['devanagari', 'लाइब्रेरी में जोड़ें']],
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
        /* Both ends of the content axis, because they fail differently. The
           longest string wraps; the SHORTEST one stops the pill being a pill
           once `min-height` is raised to the touch floor. These are the two
           shortest the product can actually produce -- the region chips are
           ISO country codes (browse.js REGIONS) and Library's tablist ends
           in `All` -- not invented stubs. */
        content: [['longest genre', 'Action &amp; Adventure'], ['devanagari', 'विज्ञान कथा और फ़ैंटेसी'],
            ['region code — shortest', 'IN'], ['shortest tab label', 'All']],
        states: ['rest', 'hover', 'focus-visible', 'selected'] },
    { group: 'Chips', name: 'chip + count', cls: 'chip', html: 'Documentary<em>142</em>',
        content: [['longest + count', 'Action &amp; Adventure<em>1,204</em>']],
        states: ['rest', 'hover', 'selected'] },
    /* The one that shipped broken: a chip that carries its own removal. */
    { group: 'Chips', name: 'chip.applied + cross', cls: 'chip applied', html: 'Action{icon:close}',
        /* This exact cell is the production bug: a genre long enough to wrap,
           with a cross after it. It was 32px tall and became 48. */
        content: [['longest + cross', 'Action &amp; Adventure{icon:close}'], ['devanagari + cross', 'विज्ञान कथा{icon:close}'],
            ['shortest genre + cross', 'War{icon:close}']],
        states: ['rest', 'hover', 'focus-visible'] },
    { group: 'Chips', name: 'chip, longest label', cls: 'chip applied', html: `${LONG}{icon:close}`,
        states: ['rest'] },
    { group: 'Chips', name: 'sw', cls: 'sw', html: 'Episodes<em>62</em>',
        content: [['longest + count', 'Unwatched episodes<em>1,204</em>']],
        states: ['rest', 'hover', 'focus-visible', 'selected'] },
    { group: 'Chips', name: 'seg', cls: 'seg', html: 'Films',
        content: [['longest', 'Films &amp; documentaries']],
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

    /* ---------------- catalogue ----------------
       The things a browse screen is made of. A tile is drawn with `.noart`
       rather than a poster on purpose: it is the case that actually ships
       whenever TMDB has no artwork, and it is the one nobody draws. */
    { group: 'Catalogue', name: 'tile', cls: 'tile', tag: 'a', states: ['rest', 'hover'],
        html: '<div class="art"><div class="noart">Sector 36</div>'
            + '<span class="score-badge">{icon:star} 7.4</span></div>'
            + '<div class="name">Sector 36</div><div class="meta">2024 · 1,204 votes</div>',
        content: [
            ['70-char title', '<div class="art"><div class="noart">Empirical Study on the Influence of Sound on the Persistence of Vision</div></div>'
                + '<div class="name">Empirical Study on the Influence of Sound on the Persistence of Vision</div><div class="meta">1980</div>'],
            ['hangul', '<div class="art"><div class="noart">복수는 나의 것</div></div>'
                + '<div class="name">복수는 나의 것</div><div class="meta">2002</div>'],
        ] },
    { group: 'Catalogue', name: 'tile + quickadd', cls: 'tile', tag: 'a', states: ['rest'],
        html: '<div class="art"><div class="noart">Dune: Part Two</div>'
            + '<button class="quickadd" aria-label="Add">{icon:add}</button>'
            + '<span class="score-badge">{icon:star} 8.2</span></div>'
            + '<div class="name">Dune: Part Two</div><div class="meta">2024</div>' },
    { group: 'Catalogue', name: 'tile, longest title', cls: 'tile', tag: 'a', states: ['rest'],
        html: '<div class="art"><div class="noart">The Lord of the Rings: The Fellowship of the Ring</div></div>'
            + '<div class="name">The Lord of the Rings: The Fellowship of the Ring</div>'
            + '<div class="meta">2001</div>' },
    { group: 'Catalogue', name: 'quickadd, saved', cls: 'quickadd saved st-done', states: ['rest', 'hover'],
        html: '{icon:watched}' },
    { group: 'Catalogue', name: 'prow', cls: 'prow', tag: 'a', surface: true, states: ['rest', 'hover'],
        html: '<span class="pf noimg">CN</span><span class="pb"><b>Christopher Nolan</b>'
            + '<span>Director · 24 titles</span></span><span class="go">{icon:forward}</span>',
        content: [['longest real name', '<span class="pf noimg">MB</span><span class="pb"><b>Martiniano Berrelleza Alvarado</b>'
            + '<span>Writer, Director, Producer · 1 title</span></span><span class="go">{icon:forward}</span>']] },
    { group: 'Catalogue', name: 'prow, no subtitle', cls: 'prow', tag: 'a', surface: true, states: ['rest'],
        html: '<span class="pf noimg">AB</span><span class="pb"><b>A B</b></span>'
            + '<span class="go">{icon:forward}</span>' },
    { group: 'Catalogue', name: 'card', cls: 'card', tag: 'div', surface: true, states: ['rest'],
        html: '<h2 class="about-h">Cine Search</h2><p class="about-p">Films and series in one place.</p>' },

    /* ---------------- the six watch states ----------------
       One hue each, carried by a class so the state looks the same wherever
       it appears. Drawn together because the only way to know six hues are
       distinguishable is to see them beside one another, in both themes. */
    { group: 'Watch states', row: 'the six states', name: 'want', cls: 'ibtn on st-want', states: ['rest'], html: '{icon:want}' },
    { group: 'Watch states', row: 'the six states', name: 'watching', cls: 'ibtn on st-ing', states: ['rest'], html: '{icon:watching}' },
    { group: 'Watch states', row: 'the six states', name: 'on hold', cls: 'ibtn on st-hold', states: ['rest'], html: '{icon:hold}' },
    { group: 'Watch states', row: 'the six states', name: 'watched', cls: 'ibtn on st-done', states: ['rest'], html: '{icon:watched}' },
    { group: 'Watch states', row: 'the six states', name: 'rewatched', cls: 'ibtn on st-re', states: ['rest'], html: '{icon:rewatched}' },
    { group: 'Watch states', row: 'the six states', name: 'dropped', cls: 'ibtn on st-drop', states: ['rest'], html: '{icon:dropped}' },

    /* ---------------- forms ---------------- */
    { group: 'Forms', name: 'field', cls: 'field', tag: 'label', surface: true, states: ['rest'],
        html: '<span class="field-top">Display name</span>'
            + '<input class="searchbox" value="Raman">'
            + '<span class="field-hint">Shown on your profile.</span>' },
    { group: 'Forms', name: 'field, invalid', cls: 'field', tag: 'label', surface: true, states: ['rest'],
        html: '<span class="field-top">Display name</span>'
            + '<input class="searchbox" aria-invalid="true" value="">'
            + '<span class="field-hint bad" role="alert">Pick a name with at least two characters.</span>' },
    { group: 'Forms', name: 'form-error', cls: 'form-error', tag: 'p', surface: true,
        states: ['rest', 'focus-visible'],
        html: 'That email and password do not match.' },
    { group: 'Forms', name: 'setrow', cls: 'setrow', tag: 'div', surface: true, states: ['rest'],
        html: '<span>Username</span><b>raman</b>' },

    /* ---------------- surfaces ---------------- */
    { group: 'Surfaces', name: 'sheet', cls: 'sheet', tag: 'div', surface: true, states: ['rest'],
        html: '<div class="grab"></div><h2 class="sheet-title">Sort watchlist</h2>'
            + '<p class="sheet-body">Remembered for this shelf only.</p>' },
    { group: 'Surfaces', name: 'segs', cls: 'segs', tag: 'div', surface: true, states: ['rest'],
        html: '<button class="seg on">All</button><button class="seg">Films</button>'
            + '<button class="seg">Series</button>' },

    /* ---------------- waiting ----------------
       Skeletons are the only thing a person sees on a cold load, and the
       only part of the product with no content to make it look finished. */
    { group: 'Waiting', name: 'skel', cls: 'skel', tag: 'div', surface: true, states: ['rest'],
        attrs: { style: 'height:16px;width:220px' }, html: '' },
    { group: 'Waiting', name: 'skel-poster', cls: 'skel skel-poster', tag: 'div', states: ['rest'], html: '' },
    { group: 'Waiting', name: 'skel-round', cls: 'skel skel-round', tag: 'div', states: ['rest'],
        attrs: { style: 'height:44px;width:44px' }, html: '' },
    { group: 'Waiting', name: 'skel-lines', cls: 'skel-lines', tag: 'div', surface: true, states: ['rest'],
        html: '<div class="skel"></div><div class="skel"></div><div class="skel"></div>' },

    /* ---------------- messages ---------------- */
    { group: 'Feedback', name: 'hint', cls: 'hint', tag: 'p', surface: true, states: ['rest'],
        html: 'An account keeps your watchlist, ratings and episode progress.' },
    { group: 'Feedback', name: 'whynot', cls: 'whynot', tag: 'p', surface: true, states: ['rest'],
        html: 'Nothing matched every filter. Try dropping one.' },

    /* ---------------- feedback ---------------- */
    // Which button a toast carries is decided by what the action DID, not by
    // the component. An add is its own undo — tap the thing again — so the
    // button is a dismiss. A remove cannot be undone by repeating it, so it
    // owes an Undo. Toast.jsx encodes this as: actionLabel present -> action
    // button, absent -> cross. Both specimens below are the same component.
    { group: 'Feedback', name: 'toast, after an add', cls: 'toast', tag: 'div', surface: true, states: ['rest'],
        html: '<span>Added to your library</span><button aria-label="Dismiss">{icon:close}</button>' },
    { group: 'Feedback', name: 'toast, after a remove', cls: 'toast', tag: 'div', surface: true, states: ['rest'],
        html: '<span>Removed from your library</span><button>Undo</button>',
        content: [['longest', '<span>Empirical Study on the Influence of Sound on the Persistence of Vision · S2 E4 watched</span><button>Undo</button>']] },
    { group: 'Feedback', name: 'empty', cls: 'empty', tag: 'div', surface: true, states: ['rest'],
        html: '<h2>Nothing here yet</h2><p>Titles you add will show up on this shelf.</p>'
            + '<a class="btn" href="#">Find something</a>' },
    { group: 'Feedback', name: 'errbox', cls: 'errbox', tag: 'div', surface: true, states: ['rest'],
        html: '<b>Couldn&apos;t load titles</b><p>The Movie Database didn&apos;t answer. '
            + 'The rest of this page is unaffected.</p><button class="btn quiet">Try again</button>' },

    /* ---------------- composition ----------------

       The third kind of case. `states` is what a control is doing, `content`
       is what it is holding, and this is how many of it there are.

       It is its own kind because the failures are different ones. A control
       does not break at a count; a COLLECTION does -- a grid whose columns
       are `auto-fit` stretches its only tile to the full width of the page,
       a rail whose children can grow turns two posters into two half-screens,
       a chip row that neither wraps nor scrolls hides the eighth filter off
       the edge where nobody will find it.

       The invariant the audit holds them to: an item's size must not depend
       on how many items are beside it. Both of this product's collections
       already get that right -- `.grid` is `auto-fill` rather than `auto-fit`,
       and `.rail > *` is `flex: 0 0 auto` -- which is exactly why it is worth
       pinning. Those are one-word edits away from being wrong, and nothing
       until now would have noticed.

       0 is included because empty is a count, and the empty state is a
       different component (`.empty`) that somebody has to remember to
       render. A collection that draws nothing at 0 is a blank screen. */

    { group: 'Composition', name: 'chips — the filter row', cls: 'chips', tag: 'div',
        surface: true, states: [], html: '',
        collection: {
            counts: [0, 1, 2, 8],
            /* TMDB's real genre names, longest first, because the row has to
               survive the ones it will actually be given. */
            child: (i) => {
                const g = ['Action &amp; Adventure', 'Science Fiction', 'Documentary',
                    'War &amp; Politics', 'Sci-Fi &amp; Fantasy', 'Drama', 'Comedy', 'Horror'];
                return `<button class="chip applied">${g[i % g.length]}<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
            },
        } },

    { group: 'Composition', name: 'grid — search results', cls: 'grid', tag: 'div',
        surface: true, states: [], html: '',
        collection: {
            counts: [1, 2, 7],
            child: (i) => `<a class="tile"><div class="art"><div class="noart">Title ${i + 1}</div>`
                + `<span class="score-badge"><svg class="icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg> 7.${i}</span>`
                + `</div><div class="name">Title ${i + 1}</div><div class="meta">20${10 + i}</div></a>`,
        } },

    { group: 'Composition', name: 'rail — a shelf', cls: 'rail', tag: 'div',
        surface: true, states: [], html: '',
        collection: {
            counts: [1, 2, 8],
            child: (i) => `<a class="tile"><div class="art"><div class="noart">Title ${i + 1}</div></div>`
                + `<div class="name">Title ${i + 1}</div></a>`,
        } },
];
