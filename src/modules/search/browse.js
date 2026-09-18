/**
 * Browse — the filter engine, and the half of the product that was never built.
 *
 * TMDB has two engines that share nothing. `/search/multi` answers "what is it
 * called"; `/discover` answers "what kind of thing". L1: a query and a facet
 * never travel in the same request, because there is no endpoint that takes
 * both — so Browse is `/search` with facets and no query, and everything about
 * it lives in the URL (FB11). That is what makes it a state of Search rather
 * than a tab: one route, one back-stack, one thing to share.
 *
 * This file is the translation between three things: the URL somebody can
 * bookmark, the facets the panel edits, and the request TMDB understands.
 * Nothing here draws.
 */

/* Sorts, and the one that is deliberately absent.
 *
 * No direction toggle: ascending popularity is a joke and ascending rating is a
 * punishment. Where a direction is meaningful, the sort names it.
 *
 * And no "highest rated". That is the Rating band plus Most voted, and offering
 * it as a sort is how you get four films rated 10.0 from a single vote. L4. */
export const SORTS = [
    { key: 'popular', label: 'Most popular', tmdb: 'popularity.desc' },
    { key: 'voted', label: 'Most voted', tmdb: 'vote_count.desc' },
    { key: 'newest', label: 'Newest', tmdb: 'primary_release_date.desc' },
];
export const DEFAULT_SORT = 'popular';

/* Series date the same field under a different name, which is the kind of
   detail that silently returns nothing. */
const SORT_FOR_TV = { 'primary_release_date.desc': 'first_air_date.desc' };

/** The eight genres that exist on both sides, with the same ids. §05, L5. */
export const SHARED_GENRE_IDS = [16, 35, 80, 99, 18, 10751, 9648, 37];

export const KINDS = [
    { key: 'all', label: 'All' },
    { key: 'movie', label: 'Films' },
    { key: 'tv', label: 'Series' },
];

/* Two rungs, not a slider: a slider implies a precision nobody has about a
   runtime. Likewise two rating rungs — the difference between 7.4 and 7.6 is
   not a decision anybody makes. */
export const LENGTHS = [{ value: 90, label: 'Under 90 min' }, { value: 120, label: 'Under 2 hours' }];
export const RATINGS = [{ value: 7, label: '7+' }, { value: 8, label: '8+' }];
export const DECADES = [2020, 2010, 2000, 1990, 1980, 1970];

/**
 * Which genres a browse may offer right now.
 *
 * With the medium set to All it is the eight shared ones and nothing else —
 * every one of them means the same thing on both sides. Choosing Films or
 * Series unlocks that medium's full list.
 *
 * L7: a facet appears only when it can change the answer. A genre the current
 * medium does not have is a promise the screen breaks when you touch it.
 */
export function genresFor(kind, { movie = [], tv = [] } = {}) {
    if (kind === 'movie') return movie;
    if (kind === 'tv') return tv;
    return movie.filter((g) => SHARED_GENRE_IDS.includes(g.id));
}

/** The facets a browse carries, with nothing set. */
export const EMPTY = {
    kind: 'all', genre: null, language: null, decade: null,
    length: null, rating: null, provider: null, unseen: false, sort: DEFAULT_SORT,
};

const asNumber = (v) => (v === null || v === '' || v === undefined ? null : Number(v));

/**
 * Read a browse out of the URL. FB11 — everything is in there, the way the
 * query already is, which is what makes a browse shareable and bookmarkable.
 */
export function fromParams(params) {
    const get = (k) => params.get(k);
    const kind = KINDS.some((x) => x.key === get('kind')) ? get('kind') : 'all';
    return {
        kind,
        genre: asNumber(get('genre')),
        language: get('lang') || null,
        decade: asNumber(get('decade')),
        length: asNumber(get('len')),
        rating: asNumber(get('rated')),
        provider: asNumber(get('on')),
        unseen: get('unseen') === '1',
        sort: SORTS.some((s) => s.key === get('sort')) ? get('sort') : DEFAULT_SORT,
    };
}

/** And back again. Only what is set, so a bare browse has a bare URL. */
export function toParams(f, base = {}) {
    const out = new URLSearchParams(base);
    const set = (k, v, skip) => {
        if (v === null || v === undefined || v === '' || v === skip) out.delete(k);
        else out.set(k, String(v));
    };
    set('kind', f.kind, 'all');
    set('genre', f.genre);
    set('lang', f.language);
    set('decade', f.decade);
    set('len', f.length);
    set('rated', f.rating);
    set('on', f.provider);
    set('unseen', f.unseen ? '1' : null);
    set('sort', f.sort, DEFAULT_SORT);
    return out;
}

/** Is anything actually constraining the list? A browse with nothing set is
 *  just "everything, most popular first", which is a legitimate screen. */
export const activeCount = (f) => [
    f.kind !== 'all', f.genre, f.language, f.decade, f.length, f.rating, f.provider, f.unseen,
].filter(Boolean).length;

/**
 * The request.
 *
 * A rating is a band, never a sort, and it is ordered by how many people voted
 * — `vote_average.gte=8` with `sort_by=vote_count.desc`. Nothing is excluded
 * and the films nobody has seen sit in the tail where they belong, instead of
 * being deleted from a catalogue by a floor somebody chose on the reader's
 * behalf. A fixed vote floor is an anglophone bias with a number on it: the one
 * that makes English sensible leaves Telugu, Tamil and Malayalam with nothing.
 */
export function toQuery(f, mediaType) {
    const sort = SORTS.find((s) => s.key === f.sort) || SORTS[0];
    let sortBy = sort.tmdb;
    if (mediaType === 'tv' && SORT_FOR_TV[sortBy]) sortBy = SORT_FOR_TV[sortBy];
    // A band asked for evidence orders itself by evidence, whatever the sort
    // control says — otherwise "rated 8+, newest" is four films from one vote.
    if (f.rating && f.sort === DEFAULT_SORT) sortBy = 'vote_count.desc';

    const params = { sort_by: sortBy, include_adult: false };
    if (f.genre) params.with_genres = String(f.genre);
    if (f.language) params.with_original_language = Array.isArray(f.language) ? f.language.join('|') : f.language;
    if (f.rating) params['vote_average.gte'] = String(f.rating);
    if (f.length) params['with_runtime.lte'] = String(f.length);
    if (f.provider) {
        params.with_watch_providers = String(f.provider);
        params.watch_region = f.region || 'US';
    }
    if (f.decade) {
        const [from, to] = [`${f.decade}-01-01`, `${f.decade + 9}-12-31`];
        if (mediaType === 'tv') {
            params['first_air_date.gte'] = from;
            params['first_air_date.lte'] = to;
        } else {
            params['primary_release_date.gte'] = from;
            params['primary_release_date.lte'] = to;
        }
    }
    return params;
}

/**
 * FB4 — the count reads 20,000+, never 20,001.
 *
 * That figure is a ceiling, not a total: TMDB returns it identically for the
 * 1990s, for Drama, for English and for no filter at all. Printing it as an
 * exact number is the screen claiming to have counted something it did not.
 */
export const CEILING = 20001;
export const readCount = (n) => (n >= CEILING ? '20,000+' : n.toLocaleString('en-GB'));

/**
 * FB5 — TMDB refuses page 501 while cheerfully reporting 1,001 pages.
 *
 * Load more retires there with "that is as deep as TMDB goes — narrow it",
 * which is true and is not an error.
 */
export const MAX_PAGE = 500;
export const canLoadMore = (page, totalPages) => page < Math.min(totalPages, MAX_PAGE);

/**
 * FB6 — switching medium with a medium-only genre selected.
 *
 * The genre is dropped and named in the chip row. Silently mapping Thriller to
 * Action & Adventure would be inventing an answer: they are not the same set,
 * nobody asked for the substitution, and the results would be right for a
 * question the person did not ask.
 *
 * FB3 is the same rule arriving by a different door. `?kind=tv&genre=27` is a
 * browse for Horror series, which is not a thin result — it is not a TMDB
 * genre. The screen says which facet is impossible here rather than returning
 * zero and letting somebody conclude there are no horror series.
 */
export function reconcile(facets, vocab) {
    const allowed = genresFor(facets.kind, vocab);
    if (!facets.genre || !allowed.length) return { facets, dropped: [] };
    if (allowed.some((g) => g.id === facets.genre)) return { facets, dropped: [] };

    const everywhere = [...(vocab.movie || []), ...(vocab.tv || [])];
    const name = everywhere.find((g) => g.id === facets.genre)?.name || 'That genre';
    const where = KINDS.find((k) => k.key === facets.kind)?.label.toLowerCase() || 'here';
    return {
        facets: { ...facets, genre: null },
        dropped: [{ kind: 'genre', label: name, why: `${name} is not a genre ${where} have` }],
    };
}

/**
 * FB2 — empty because the chips exclude each other.
 *
 * Never a bare "no results". Each chip is dropped in turn and the one whose
 * removal yields the fewest results is the culprit: the rest of the query was
 * nearly as narrow without it, so it is the constraint that did the excluding.
 *
 * Tamil + Animation + Netflix returns nothing; without Netflix it returns nine.
 * That is the chip to name.
 *
 * Takes counts rather than fetching them, so the rule can be argued with
 * offline and the caller decides what three or four extra requests are worth.
 */
export function blame(trials) {
    const rescued = (trials || []).filter((t) => t.count > 0);
    if (!rescued.length) return null;
    return rescued.reduce((best, t) => (t.count < best.count ? t : best));
}
