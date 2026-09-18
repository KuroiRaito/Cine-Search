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
