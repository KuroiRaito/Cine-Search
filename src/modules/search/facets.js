/**
 * Does what is left of a query describe a kind of thing rather than name one?
 *
 * This exists because of a bug the design found in its own ladder. Truncation
 * ran whenever the rungs above it came back empty — including for queries with
 * no title in them at all, so it answered 44 of the 120 golden queries, far
 * more than it should. Truncating `movies from the 90s` to `movies from the 9`
 * is not a correction; it is a different search that happens to return
 * something.
 *
 * The fix is an order, not a new rung: after rung 2, ask whether what remains
 * parses as facets — a genre, a language, a decade, a runtime — and if it does,
 * go to Browse and stop. Truncation is for a name somebody spelled wrong, and
 * only for that.
 *
 * Interpretation is allowed here in a way it is not in rungs 1 and 2, because
 * the outcome is *offered* rather than run: FQ10 shows the browse as a
 * suggestion with three real results under it. Guessing out loud is a different
 * thing from guessing quietly.
 */

/**
 * Language names to ISO codes.
 *
 * The Indian languages are first because they are why this facet exists: eight
 * of the golden set's Hinglish queries name one, and almost no Western tracker
 * offers the filter at all.
 */
export const LANGUAGES = {
    hindi: 'hi', tamil: 'ta', telugu: 'te', malayalam: 'ml', kannada: 'kn',
    marathi: 'mr', bengali: 'bn', punjabi: 'pa', urdu: 'ur',
    english: 'en', korean: 'ko', japanese: 'ja', french: 'fr', spanish: 'es',
    italian: 'it', german: 'de', mandarin: 'zh', chinese: 'zh',
};

/** "south ki action movie" — one word, four languages. The golden set's own
 *  label rule for it reads "South Indian languages + Action". */
export const GROUPS = { south: ['ta', 'te', 'ml', 'kn'] };

/**
 * Words that are a genre without being TMDB's name for it.
 *
 * Kept short and kept honest. Every entry is a word somebody would use for the
 * genre and nothing else — `romantic` is Romance and cannot be anything else.
 * Absent on purpose: `funny`, `scary`, `sad`. They read as a genre and are
 * really a mood, and mood is a preset built from measured facets (§07), not a
 * word match. Guessing that `sad` means Drama is how a search starts answering
 * a question nobody asked.
 */
export const GENRE_WORDS = {
    romantic: 'Romance', romcom: 'Romance',
    'sci fi': 'Science Fiction', 'sci-fi': 'Science Fiction', scifi: 'Science Fiction',
    docu: 'Documentary', documentaries: 'Documentary',
    animated: 'Animation', anime: 'Animation',
    thrillers: 'Thriller', comedies: 'Comedy', dramas: 'Drama',
};

const RATING_WORDS = {
    /* The golden set's label rule for "koi acchi thriller movie" is "Thriller
       rated 7+", so acchi — good — is worth exactly one rung of rating. */
    acchi: 7, achhi: 7, good: 7,
};

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Parse a query into the facets it names.
 *
 * `genres` is TMDB's own list for the medium in play — injected rather than
 * typed, because the film and series vocabularies differ and only eight of
 * their entries are shared (§05, L5).
 *
 * Returns the facets found and the words left over. A caller decides what
 * "enough" means; `isBrowse` below is this module's answer.
 */
export function parseFacets(query, { genres = [] } = {}) {
    let rest = ` ${norm(query)} `;
    const matched = [];
    /* Removes the phrase and reports whether it was there. A facet is optional:
       several of the words below decide their own value from what they matched
       — `purani` is a date range, `under 2 hours` is a number — so they take
       the phrase out here and push their own facet afterwards. Pushing a null
       would put a hole in the list that every `matched.some(...)` below then
       trips over. */
    const take = (phrase, facet) => {
        const needle = ` ${phrase} `;
        if (!rest.includes(needle)) return false;
        rest = rest.replace(needle, ' ');
        if (facet) matched.push(facet);
        return true;
    };

    // Longest phrase first, so "science fiction" is gone before "science".
    const byLength = (a, b) => b[0].length - a[0].length;

    const genreByName = genres.map((g) => [norm(g.name), g]);
    const genreBySynonym = Object.entries(GENRE_WORDS)
        .map(([word, name]) => [word, genres.find((g) => norm(g.name) === norm(name))])
        .filter(([, g]) => g);

    for (const [phrase, g] of [...genreByName, ...genreBySynonym].sort(byLength)) {
        if (matched.some((m) => m.kind === 'genre')) break;   // single-select, FD-7
        take(phrase, { kind: 'genre', label: g.name, value: g.id });
    }

    for (const [name, codes] of Object.entries(GROUPS).sort(byLength)) {
        take(name, { kind: 'language', label: name, value: codes });
    }
    for (const [name, code] of Object.entries(LANGUAGES).sort(byLength)) {
        if (matched.some((m) => m.kind === 'language')) break;
        take(name, { kind: 'language', label: name, value: code });
    }

    // Decades. "the 90s", "1990s", "90s" all mean the same ten years.
    const decade = rest.match(/\b(?:19|20)?(\d)0s\b/);
    if (decade) {
        const digit = Number(decade[1]);
        const from = digit >= 3 ? 1900 + digit * 10 : 2000 + digit * 10;
        rest = rest.replace(decade[0], ' ');
        matched.push({ kind: 'decade', label: `${from}s`, value: [from, from + 9] });
    }
    /* purani — old. The golden set's label rule for "purani hindi filme" is
       "Hindi, released before 2000", so the word carries a date range. */
    if (!matched.some((m) => m.kind === 'decade') && take('purani', null)) {
        matched.push({ kind: 'decade', label: 'before 2000', value: [1900, 1999] });
    }
    if (take('this year', null)) {
        const y = new Date().getFullYear();
        matched.push({ kind: 'decade', label: 'this year', value: [y, y] });
    }

    // Runtime. Two rungs, never a slider — a slider implies a precision nobody
    // has about a runtime.
    for (const [phrase, mins] of [
        ['under 2 hours', 120], ['under two hours', 120], ['under 120 minutes', 120],
        ['under 90 minutes', 90], ['under 90 mins', 90], ['under 90', 90],
    ].sort(byLength)) {
        if (matched.some((m) => m.kind === 'runtime')) break;
        if (take(phrase, null)) matched.push({ kind: 'runtime', label: `under ${mins} min`, value: mins });
    }

    // Rating. A band, never a sort.
    const rated = rest.match(/\brated?\s*(?:above|over|)\s*([0-9](?:\.[0-9])?)\+?\b/)
        || rest.match(/\b([0-9])\+\b/);
    if (rated) {
        rest = rest.replace(rated[0], ' ');
        matched.push({ kind: 'rating', label: `${rated[1]}+`, value: Number(rated[1]) });
    }
    for (const [word, floor] of Object.entries(RATING_WORDS)) {
        if (matched.some((m) => m.kind === 'rating')) break;
        if (take(word, null)) matched.push({ kind: 'rating', label: `${floor}+`, value: floor });
    }

    return { matched, rest: rest.replace(/\s+/g, ' ').trim() };
}

/* Words that carry no facet and no name. What is left after the facets come
   out has to be one of these for the query to have been *only* facets. */
const FILLER = new Set([
    'the', 'a', 'an', 'of', 'for', 'from', 'in', 'on', 'at', 'to', 'and', 'or',
    'some', 'something', 'any', 'me', 'my', 'mein', 'liye', 'wala', 'wali',
]);

/**
 * Is this a browse rather than a misspelt name?
 *
 * A facet has to be there AND has to account for the query. One facet being
 * present is not enough, and the design says why in its own count of what the
 * golden set asks to filter by: "false positives removed by hand — the family
 * man is a title, not a genre".
 *
 * That title is in the set, and it is why this is not a one-line function.
 * `family` is a genre; `the family man` is a film. The difference is what is
 * left over — `the man`, which is a name and not filler — and a query with a
 * name in it goes to truncation, where names belong.
 *
 *   hindi comedy      facets cover it            → Browse
 *   from the 90s      leftover is filler         → Browse
 *   the family man    leftover is "the man"      → truncate
 */
export function isBrowse(query, vocab) {
    const { matched, rest } = parseFacets(query, vocab);
    if (!matched.length) return false;
    return rest.split(/\s+/).filter(Boolean).every((w) => FILLER.has(w));
}

/** The chips a browse arrives with, in the order §06 puts them in the panel. */
const ORDER = ['genre', 'language', 'decade', 'runtime', 'rating'];
export const chipsOf = (matched) =>
    [...matched].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
