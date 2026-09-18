/**
 * The words a name index cannot hold, removed before asking it.
 *
 * Rungs 1, 1b and 2 of the Find module's rescue ladder — the three silent ones.
 * They take the golden set's zero-result rate from 62% to 42% without changing
 * hit@5 on a single query that already worked, which is what makes them safe to
 * run without telling anybody.
 *
 * TMDB's name engine matches word prefixes with a strict AND across every word.
 * So `christopher nolan movies` returns nothing and `christopher nolan` returns
 * him at rank 1 — the query was never too vague, it was too long. Everything
 * here is removing words, never adding or reinterpreting them, which is why
 * L2 lets these three rungs stay quiet while rungs 3 and 4 must announce
 * themselves.
 */

/**
 * Phrases first, and that ordering is the whole trap.
 *
 * The design calls this a word list and two of its entries are phrases. Built
 * as a token filter — split on spaces, drop anything in the set — `all parts`
 * and `in order` can never match, and the franchise category lands at 20%
 * empty instead of 0%. Measured both ways; it is the single largest thing that
 * can go wrong in this file.
 *
 * The singulars are here and are not in the design's printed list. `movie`
 * appears 18 times in the golden set against `movies` at 11, so a list without
 * it misses the most common intent word there is — the published list cannot be
 * the one the document's own 62% → 44% was measured with.
 */
export const INTENT = [
    'all parts', 'in order',
    'movies', 'movie', 'films', 'film', 'shows', 'show', 'series',
    'trilogy', 'with', 'by', 'best',
    /* The same word in the languages this product is actually for. `picture`,
       `padam` and `filme` are "movie" in Hinglish, Tamil and Hindi, they are in
       the golden set, and they were the only thing standing between three
       Hinglish queries and an answer. Hinglish is the category this module
       exists to serve; leaving its word for "film" out of the list of words
       meaning "film" was an oversight, not a decision. */
    'pictures', 'picture', 'padam', 'filme',
];

/**
 * Hindi particles and honorifics. `salman bhai ki movie` is three words of
 * scaffolding around one name.
 *
 * Deliberately short. Every entry is a word that cannot be part of a title on
 * its own, and the cost of a wrong entry here is a search that quietly drops a
 * word somebody meant.
 */
export const PARTICLES = ['ki', 'ka', 'ke', 'koi', 'bhai', 'ji', 'saab'];

/** Remove whole words and whole phrases, never substrings — `by` must not eat
 *  the `by` in `Bye Bye Birdie`. */
function drop(query, terms) {
    let out = ` ${query.toLowerCase().replace(/\s+/g, ' ').trim()} `;
    // Longest first, so `all parts` is gone before `parts` could be considered.
    for (const term of [...terms].sort((a, b) => b.length - a.length)) {
        let next;
        while ((next = out.replace(` ${term} `, ' ')) !== out) out = next;
    }
    return out.replace(/\s+/g, ' ').trim();
}

/** Rung 1. */
export const stripIntent = (query) => drop(query, INTENT);

/** Rung 2. */
export const stripParticles = (query) => drop(query, PARTICLES);

/* Roundhay Garden Scene, 1888. Nothing was released before it. */
const FIRST_FILM = 1888;

/**
 * Rung 1b — split a trailing year off the name and pass it as `year`.
 *
 * `inception (2010)` and `Inception 2010` both return nothing today, and
 * pasting a title with its year is the most natural paste there is. The year
 * does not disappear: it becomes a chip, visible and removable, because a
 * filter nobody can see is a filter nobody can undo.
 *
 * Only a trailing year, and only one, and only one a film could carry.
 */
export function splitYear(query) {
    const m = query.trim().match(/^(.*\S)\s*[([]?(\d{4})[)\]]?$/);
    if (!m) return { query: query.trim(), year: null };
    const name = m[1].replace(/[([]\s*$/, '').trim();
    const year = Number(m[2]);
    /* A four-digit number is only a year if a film could have come out in it.
       Blade Runner 2049 is a title, and splitting it would ask TMDB for a film
       released in 2049 — nothing, from a query that worked. The ladder happens
       to protect us here, since 1b only runs after the query came back empty,
       but a rule that is right only because it is rarely reached is not a rule. */
    if (!name || year < FIRST_FILM || year > new Date().getFullYear() + 5) {
        return { query: query.trim(), year: null };
    }
    return { query: name, year };
}

/**
 * Rung 4 — search each word alone, pool what comes back, rank by popularity.
 *
 * Truncation cannot reach a misspelling in the middle of a word: `brekaing bad`
 * has no prefix that is a prefix of Breaking Bad. But `bad` on its own does
 * find it, and so does `things` for `stanger things`. Four of the golden set's
 * eighteen typos come back this way.
 *
 * Announced as a QUESTION, never as a claim — "Nothing for forest gump. Did
 * you mean Forrest Gump?" — because two of the four land at rank 2, behind a
 * wrong answer. Rung 3 can say "showing results for" because a prefix match is
 * evidence; this is a guess, and a guess asks.
 */

/** Words worth asking about. One- and two-letter words match everything and
 *  rank nothing, so they only add noise to the pool. */
export const retryWords = (query) =>
    String(query || '').toLowerCase().split(/\s+/).filter((w) => w.length >= 3);

const fold = (v) => String(v || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

/** Levenshtein, on the folded strings. Two rows rather than a full matrix —
 *  this runs against a pool of twenty candidates on every failed search. */
export function editDistance(a, b) {
    const x = fold(a);
    const y = fold(b);
    if (!x.length || !y.length) return Math.max(x.length, y.length);
    let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
    for (let i = 1; i <= x.length; i += 1) {
        const row = [i];
        for (let j = 1; j <= y.length; j += 1) {
            row[j] = Math.min(
                prev[j] + 1,
                row[j - 1] + 1,
                prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
            );
        }
        prev = row;
    }
    return prev[y.length];
}

/**
 * Is this candidate a plausible spelling of what was typed?
 *
 * Rung 4 pools results from single words, so without this it will happily
 * suggest the most popular film containing the word `war` as a correction of
 * `sad war` — the same failure rung 3 had, in a different costume. A
 * misspelling is a few letters wrong: the design's own four are one or two
 * edits each.
 *
 * A fifth of the query's length, and never less than two, which is what those
 * four need and what a sentence cannot reach.
 */
export const isNearMiss = (query, title) =>
    editDistance(query, title) <= Math.max(2, Math.round(fold(query).length * 0.2));

/**
 * Pick the one candidate to offer, from everything the words brought back.
 *
 * One, not five. A list of guesses is a second failure — the screen is already
 * apologising, and five apologies are not better than one.
 */
export function bestGuess(query, candidates) {
    const near = (candidates || []).filter((c) => isNearMiss(query, c.title || c.name));
    if (!near.length) return null;
    return [...near].sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0];
}

/**
 * The three silent rungs, in the order the ladder runs them.
 *
 * Returns the attempts to make, each with what changed, so the caller can stop
 * at the first that answers. Rung 0 is always first and is the happy path for
 * 38% of the golden set; a query that works never touches the rest.
 *
 * Duplicate attempts are dropped — most queries have no intent words, no year
 * and no particles, so for them this is a list of one and no extra request is
 * ever made.
 */
/**
 * Rung 3 — the longest prefix that still matches, and never below six.
 *
 * TMDB matches word prefixes, so truncating a misspelling works: intersteller
 * loses two letters and becomes interstell, which is a prefix of Interstellar.
 * It works until the prefix stops being the word, and six characters is where
 * the evidence stops rather than a round number — `titan` returns 610 results
 * and not one of the first twenty is Titanic, `shol` returns people called
 * Sholto-Douglas, `dang` returns a film called Dang!. Below six a correction
 * quietly becomes a different search, which is the failure this rung exists to
 * prevent.
 *
 * Returns candidates longest first. The caller asks for each in turn and stops
 * at the first that answers, which is what "longest prefix that still matches"
 * means in practice.
 */
export const MIN_PREFIX = 6;

/**
 * Did the truncation actually find the thing, or just find something?
 *
 * This is the half of rung 3 the design names without stating. "Truncate to the
 * longest prefix that still **matches**" — matches the title, not merely
 * returns rows. Without the check, truncation answers anything: `movie where
 * guy loses his memory` becomes `where guy loses his mem`, TMDB hands back a
 * film, and the screen announces a correction nobody made to a title nobody
 * typed. Measured: 40 of the 120 golden queries were "rescued" that way,
 * including every plot-recall query and thirteen of twenty moods.
 *
 * A correction is a prefix of the answer. `interstell` is a prefix of
 * Interstellar and `game of th` is a prefix of Game of Thrones; `where guy
 * loses his mem` is a prefix of nothing. Spaces are ignored on both sides, so a
 * truncation landing mid-word still counts.
 */
export const isCorrectionOf = (prefix, title) => {
    const fold = (v) => String(v || '')
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase().replace(/[^a-z0-9]/g, '');
    const p = fold(prefix);
    return p.length > 0 && fold(title).startsWith(p);
};

/**
 * And never less than half of what was typed.
 *
 * Six characters is the right floor for a word and the wrong one for a
 * sentence. `something to watch while eating` truncated to `someth` returns a
 * film beginning with "Someth" — which satisfies every other rule here and is
 * not a correction of anything. Measured: the flat floor let truncation claim
 * nine of twenty moods and seven of ten plot-recall queries, which is the very
 * failure this rung was re-ordered to prevent.
 *
 * A misspelling is one or two letters wrong. The design's own examples lose two
 * characters (intersteller), four (pulp ficiton) and five (game of thornes) —
 * never most of the query. Half is the generous reading of that.
 */
const floorFor = (q) => Math.max(MIN_PREFIX, Math.ceil(q.length / 2));

export function prefixes(query, floor) {
    const q = String(query || '').trim();
    const stop = floor ?? floorFor(q);
    const out = [];
    for (let n = q.length - 1; n >= stop; n -= 1) {
        const candidate = q.slice(0, n).trim();
        // Trimming a trailing space can repeat a candidate; asking twice for
        // the same string is a request bought and thrown away.
        if (candidate.length >= stop && candidate !== out.at(-1)) out.push(candidate);
    }
    return out;
}

export function rungs(raw) {
    const asTyped = String(raw || '').trim();
    const out = [{ rung: 0, query: asTyped, year: null }];
    const add = (rung, query, year = null) => {
        if (!query) return;
        if (out.some((a) => a.query === query && a.year === year)) return;
        out.push({ rung, query, year });
    };

    const intent = stripIntent(asTyped);
    add(1, intent);

    const { query: named, year } = splitYear(intent);
    if (year) add('1b', named, year);

    add(2, stripParticles(named));
    return out;
}
