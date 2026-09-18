/**
 * Moods are facet bundles, not keywords.
 *
 * Mood is the largest category in the golden set — 20 of 120, and 95% of them
 * return nothing. The tempting answer is TMDB's keyword vocabulary, and it is a
 * trap: `feel good` is a real keyword attached to **no films at all**. A preset
 * built on it would render an empty shelf on the home screen of a product whose
 * whole job is suggesting something to watch.
 *
 * So a preset is a bundle of facets, and a keyword may only join one after its
 * volume has been measured.
 *
 * Every preset is a browse URL. Tapping one lands on /search with its facets in
 * the chip row, where they can be taken apart one at a time — which is the
 * difference between a curated shelf and a starting point. The preset is a
 * guess at the question; the chips are how somebody corrects it.
 *
 * Each definition is printed beside it so it can be argued with, which is the
 * point of writing them down. Counts measured against live TMDB on 18 Sep 2026.
 */

/* Film genre ids. Written out because a preset is a fixed definition rather
   than a vocabulary somebody picks from. */
const COMEDY = 35;
const FAMILY = 10751;
const THRILLER = 53;
const MYSTERY = 9648;
const DRAMA = 18;

/* Measured: Drama rated 7.5+ with this keyword returns 20 films. The design
   allows a keyword to join "only where it has volume", and twenty is a full
   shelf — where `feel good` is zero. Without it the preset returns Interstellar
   and Fight Club, which are not films anybody cries to. */
const TEARJERKER = 156924;

export const PRESETS = [
    {
        key: 'easy',
        label: 'Easy watch',
        definition: 'Comedy or Family · under 110 min · rated 6.5+, most voted',
        answers: 'something light for a sunday',
        facets: { kind: 'movie', genre: [COMEDY, FAMILY], length: 110, rating: 6.5, sort: 'voted' },
    },
    {
        key: 'edge',
        label: 'Edge of the seat',
        definition: 'Thriller or Mystery · rated 7+, most voted',
        answers: 'koi acchi thriller movie',
        /* Sorted by votes, not popularity — the one change from the printed
           definition, and it was measured rather than argued. Popularity is a
           recency-weighted signal, so "Thriller or Mystery, 7+, most popular"
           returned Zip Wire, Ghost in the Cell and Obsession where every other
           preset returned canon. A shelf on the home screen that nobody
           recognises is the same failure as an empty one, in better clothes. */
        facets: { kind: 'movie', genre: [THRILLER, MYSTERY], rating: 7, sort: 'voted' },
    },
    {
        key: 'cry',
        label: 'Have a cry',
        definition: 'Drama · rated 7.5+ · tearjerker',
        answers: 'movie to cry to',
        facets: { kind: 'movie', genre: [DRAMA], keyword: TEARJERKER, rating: 7.5, sort: 'voted' },
    },
    {
        key: 'short',
        label: 'Under two hours',
        definition: 'Under 120 min · rated 7+, most voted',
        answers: 'movies under 2 hours',
        facets: { kind: 'movie', length: 120, rating: 7, sort: 'voted' },
    },
    {
        key: 'home',
        label: 'Closer to home',
        definition: 'Hindi, Tamil, Telugu, Malayalam or Kannada · rated 7+, most voted',
        answers: 'purani hindi filme · tamil thriller padam',
        facets: { kind: 'movie', language: ['hi', 'ta', 'te', 'ml', 'kn'], rating: 7, sort: 'voted' },
    },
    {
        key: 'parents',
        label: 'With the parents',
        definition: 'Certified for families in your country · rated 7+, most voted',
        answers: 'watch with parents · bacchon ke liye movie',
        /* The one preset that needs a region, because a certificate is a
           national thing: U and U/A in India, G and PG in the United States.
           §05 rejected certification as a facet for exactly that reason and
           sent it here, where the mapping is written once and curated.

           Measured: 3,464 films in India, 3,818 in the US, 2,778 in Great
           Britain — which is why the design prefers it to guessing at genres. */
        needsRegion: true,
        facets: { kind: 'movie', rating: 7, sort: 'voted' },
    },
];

/* Certificates that mean "a child can watch this", per country. Curated, and
   short on purpose: a country not listed here has no mapping, and inventing one
   would be telling a parent something about a film that nobody checked. */
export const FAMILY_CERTS = {
    IN: 'U|UA', US: 'G|PG', GB: 'U|PG', CA: 'G|PG', AU: 'G|PG',
    DE: '0|6', FR: 'U|10', JP: 'G|PG12', KR: 'ALL|12', BR: 'L|10',
};

/** The facets a preset lands with, given what we know about the viewer. */
export function facetsFor(preset, region) {
    if (!preset.needsRegion) return preset.facets;
    const cert = region && FAMILY_CERTS[region];
    return cert ? { ...preset.facets, cert, region } : preset.facets;
}

/**
 * Which presets can be offered right now.
 *
 * L7 — a facet appears only when it can change the answer. "With the parents"
 * without a certificate mapping is rated 7+ and nothing else, which is a
 * different shelf wearing the same name, so it waits until there is a region
 * it knows the certificates for.
 */
export const presetsFor = (region) =>
    PRESETS.filter((p) => !p.needsRegion || (region && FAMILY_CERTS[region]));
