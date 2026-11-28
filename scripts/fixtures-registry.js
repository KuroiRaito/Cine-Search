/**
 * Every geometric relationship this repo claims is a constant, and every
 * negative margin that is deliberately not one.
 *
 * This is the design work, the way `scripts/gallery-specimens.js` is. It is a
 * separate file from the pass that renders it for one reason: `npm run verify`
 * reads it too, in check 26, and verify must not need a browser. Two files
 * would disagree the first time somebody edited one of them; one file read by
 * both cannot.
 *
 * `npm run fixtures` renders each relationship under every fixture in `vary`
 * and fails when the value moves. `verify` check 26 fails when a negative
 * margin exists that is neither listed here nor waived below — so the gate is
 * in two halves and both are needed:
 *
 *   check 26   you cannot WRITE a new overlap without declaring it
 *   fixtures   a declared overlap cannot SLIDE without failing
 *
 * Adding a relationship: `of` is the box that was pulled, `against` is the box
 * it was pulled over or away from, and the value measured is always
 * bottom(against) - top(of), so positive is overlap and negative is clearance.
 * `stress` names the box the fixtures are meant to resize; if it does not
 * actually change size, the pass reports VACUOUS and fails, because a fixture
 * axis that moves nothing proves nothing.
 *
 * `axis` is 'y' unless stated. On 'x' the same arithmetic runs sideways —
 * right(against) - left(of) — because a stack of overlapping avatars is the
 * same claim as an avatar over a banner, turned ninety degrees.
 *
 * `vary` carries two different kinds of fixture and both matter, because the
 * two bugs that prompted this were one of each:
 *
 *   content   what is IN the box      B11, the bio that moved the overlap
 *   count     how MANY of it there are  B7, the density read off one card
 */
import { BIO_MAX, NAME_MAX, colourClass } from '../src/modules/profile/identity.js';

/* ---------------- content ----------------

   Real, per CLAUDE.md §5, and the long cases are the product's own enforced
   ceilings rather than strings invented to break things. BIO_MAX and NAME_MAX
   come from identity.js, so if a limit moves these move with it. The product
   WILL hold a bio of exactly BIO_MAX — that is what the counter in the edit
   sheet counts down to. */

/* Not a stand-in for the empty case, it IS the empty case: Identity.jsx
   renders `.pbio.ph` with this exact string when the bio is null, so an
   account that has written nothing still has a line of text here. */
const BIO_EMPTY = 'Say something about what you watch.';

const SENTENCE = 'Watching my way through everything Villeneuve has shot. ';
const LONG_BIO = SENTENCE.repeat(Math.ceil(BIO_MAX / SENTENCE.length)).slice(0, BIO_MAX);

export const BIOS = [
    ['empty (the placeholder)', BIO_EMPTY],
    ['one line', 'Sci-fi, slow burns, and anything shot by Roger Deakins.'],
    [`at BIO_MAX (${BIO_MAX})`, LONG_BIO],
    ['devanagari', 'विज्ञान कथा और फ़ैंटेसी देखना पसंद है। '.repeat(4)],
];

const LONG_NAME = 'Snapshot'.padEnd(NAME_MAX, ' Marchetti-Oyelaran').slice(0, NAME_MAX);

/* Lifted from scripts/gallery-specimens.js, which took them from the
   product's own recorded TMDB responses. The h1 is line-clamped to two lines,
   so a title is a real content axis: a six-line title clamps to two and the
   lift must not notice. */
const TITLES = [
    ['short', 'Dune'],
    ['longest real', 'The Lord of the Rings: The Fellowship of the Ring'],
    ['70 characters', 'Empirical Study on the Influence of Sound on the Persistence of Vision'],
    ['hangul', '복수는 나의 것'],
];

/* ---------------- markup ----------------

   Written here rather than taken from the product, because nothing can render
   real JSX with a layout engine in CI. So this measures the CSS relationship,
   NOT the product's DOM: if Identity.jsx stopped nesting .pav inside .pav-row,
   every relationship below would still pass while the product broke. Check 26
   narrows that hole — it fails when a class named here stops appearing in the
   JSX at all — and does not close it. Nesting is unguarded. Hence `from`. */

const BANNER = colourClass('dusk');

/* src/modules/profile/Identity.jsx — .pid wraps .pbanner and .pav-row as
   siblings; .pav-row holds the avatar, the text and the edit button. */
const pid = (bio, name = 'Snapshot') => `
<div class="pid">
  <div class="pbanner ${BANNER}">
    <div class="bscrim" aria-hidden="true"></div>
    <button type="button" class="bedit">Edit</button>
    <div class="pname">${name}</div>
  </div>
  <div class="pav-row">
    <span class="pav ${BANNER}" aria-hidden="true">S</span>
    <div class="pid-text">
      <div class="phandle">@snap · January 2026</div>
      <p class="pbio">${bio}</p>
    </div>
    <button type="button" class="pbtn">Edit</button>
  </div>
</div>`;

/* src/modules/title/Title.jsx — .hero, then .tgrid pulled up over it by
   --head-lift. `noart` because this page has no network: the gradient is the
   state TS9 draws when there is no artwork, and it is the same box. */
const titleHead = (t) => `
<div class="hero noart"><div class="hero-nav"></div></div>
<div class="tgrid">
  <div class="tposter"></div>
  <div class="thead">
    <h1>${t}</h1>
    <div class="metaline"><span class="cert">15</span>2024 · 166 min</div>
  </div>
  <div class="tbody"><p class="tagline">Beyond fear, destiny awaits.</p></div>
</div>`;

/* src/modules/title/Title.jsx — `t.cast.slice(0, 3)`, so the real counts are
   1, 2 and 3 and there is no fourth face to measure. Two is the floor here:
   an overlap between siblings needs a sibling, which is itself the point —
   the relationship does not exist at n=1 and a fixture set that only drew one
   would have reported it holding. */
const CAST = ['CN', 'TC', 'RD'];
const faces = (n) => `
<div class="pcard"><span class="faces">${
    CAST.slice(0, n).map((i) => `<span class="face">${i}</span>`).join('')
}</span></div>`;

/* ---------------- the claims ---------------- */

export const RELATIONSHIPS = [
    {
        id: 'profile · avatar over banner · expanded',
        says: 'docs/profile-module.html §02 anatomy — "96px, overlaps by 48"',
        from: 'src/modules/profile/Identity.jsx',
        width: 1280, expect: 48,
        of: '.pav', against: '.pbanner', stress: '.pid-text',
        vary: BIOS, markup: (bio) => pid(bio),
    },
    {
        id: 'profile · avatar over banner · compact',
        says: 'docs/profile-module.html §02 anatomy — "64px, overlaps by 32"',
        from: 'src/modules/profile/Identity.jsx',
        width: 390, expect: 32,
        of: '.pav', against: '.pbanner', stress: '.pid-text',
        vary: BIOS, markup: (bio) => pid(bio),
    },
    {
        /* The name is inside the banner and the avatar is not, so nothing
           relates them except two numbers written in two places — the shape of
           CLAUDE.md §7's "one state spelled two ways in two places". It is why
           both bands collided the first time the expanded band was built. */
        id: 'profile · name clear of avatar · expanded',
        says: 'profile.css — both bands keep the name 8px above the avatar',
        from: 'src/modules/profile/Identity.jsx',
        width: 1280, expect: -8,
        of: '.pav', against: '.pname', stress: '.pid-text',
        vary: BIOS, markup: (bio) => pid(bio),
    },
    {
        id: 'profile · name clear of avatar · compact',
        says: 'profile.css — both bands keep the name 8px above the avatar',
        from: 'src/modules/profile/Identity.jsx',
        width: 390, expect: -8,
        of: '.pav', against: '.pname', stress: '.pid-text',
        vary: BIOS, markup: (bio) => pid(bio),
    },
    {
        /* A second axis on the same relationship. The bio cannot move .pname;
           the display name can. A fixture set that stresses one box answers
           one question, and the clearance is a claim about both. */
        id: 'profile · name clear of avatar · longest name',
        says: 'profile.css — the clearance holds at NAME_MAX',
        from: 'src/modules/profile/Identity.jsx',
        /* At 1280 a 40-character name does not wrap, so .pname is 44px tall
           either way and the pass reported VACUOUS -- correctly, and about the
           fixture rather than the code. The phone is where NAME_MAX costs a
           second line, so the phone is where this question is real. */
        width: 390, expect: -8,
        of: '.pav', against: '.pname', stress: '.pname',
        vary: [['short name', 'Jo'], [`at NAME_MAX (${NAME_MAX})`, LONG_NAME]],
        markup: (name) => pid(BIO_EMPTY, name),
    },
    /* Three widths because --head-lift is not one number: .tgrid steps it
       64 -> 72 -> 80 across the 600 and 1120 breakpoints, and the first run of
       this pass reported WRONG at 1280 against a registry that said 64. The
       pass was right and the registry was wrong, which is the cheapest way for
       a gate to prove it is reading the real stylesheet. */
    {
        id: 'title · head lifted over hero · compact',
        says: 'title.css — --head-lift: 64px below 600',
        from: 'src/modules/title/Title.jsx',
        width: 390, expect: 64,
        of: '.tgrid', against: '.hero', stress: '.thead',
        vary: TITLES, markup: (t) => titleHead(t),
    },
    {
        id: 'title · head lifted over hero · medium',
        says: 'title.css — --head-lift: 72px from 600',
        from: 'src/modules/title/Title.jsx',
        width: 900, expect: 72,
        of: '.tgrid', against: '.hero', stress: '.thead',
        vary: TITLES, markup: (t) => titleHead(t),
    },
    {
        id: 'title · head lifted over hero · wide',
        says: 'title.css — --head-lift: 80px from 1120',
        from: 'src/modules/title/Title.jsx',
        width: 1280, expect: 80,
        of: '.tgrid', against: '.hero', stress: '.thead',
        vary: TITLES, markup: (t) => titleHead(t),
    },
    {
        /* The count axis rather than the content axis, and it is here because
           of B7: a density number read off a shelf holding one film, where
           PREVIEW = 8 meant the ninth tile it described could not exist. An
           overlap between siblings is the cheapest honest test of that shape —
           it is undefined at n=1, so a fixture set that only drew one card
           would report NO SUCH BOX rather than a number. */
        id: 'title · stacked cast faces · each over the last',
        says: 'title.css — .face margin-right: calc(var(--space-8) * -1)',
        from: 'src/modules/title/Title.jsx',
        width: 1280, expect: 8, axis: 'x',
        of: '.face:nth-child(2)', against: '.face:nth-child(1)', stress: '.faces',
        vary: [['2 of 3 cast', 2], ['3 of 3 cast — the cap', 3]],
        markup: (n) => faces(n),
    },
];

/* ---------------- deliberately not relationships ----------------

   A negative margin that is not pulling one box across another's edge. Check
   26 requires every negative margin to be here or above, so "nothing to
   measure" has to be written down rather than left out — CLAUDE.md §5.
   A waiver is a claim, and a wrong one is visible here rather than nowhere. */

export const WAIVERS = [
    ['.bleed', 'src/app/shell.css',
        'escapes the gutter to run edge to edge, and shell.css says so in as'
        + ' many words: full-bleed is opt-in. Horizontal, against the page box,'
        + ' and nothing is laid out across the edge it crosses.'],
    ['.vh', 'src/shared/ui/ui.css',
        'the -1px of the visually-hidden clip idiom. Not a position: the box is'
        + ' one pixel, clipped, and read rather than drawn.'],
    ['.lfind-x', 'src/modules/library/library.css',
        'pulls the clear button back by its own padding so the glyph, rather'
        + ' than the 44px hit area, lines up with the field edge. Optical, and'
        + ' it crosses nothing — the hit area is meant to overhang.'],
    ['.title-head', 'src/modules/title/title.css',
        'the loading skeleton standing in for .tgrid, which IS measured above,'
        + ' with the same declaration and the same --head-lift: 64px. It has no'
        + ' content axis of its own — a skeleton is fixed boxes — so the pass'
        + ' would report VACUOUS, which would be true and useless. NOTE the'
        + ' value is written twice, once here and once on .tgrid, and nothing'
        + ' ties them: that is CLAUDE.md §7\'s "one state spelled two ways in'
        + ' two places", and the comment above this rule records that the'
        + ' skeleton and the real head have already disagreed once.'],
];
