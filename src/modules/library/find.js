/**
 * Find, not search.
 *
 * Search goes to the catalogue and answers "does this exist". Find stays home
 * and answers "where did I put it" — a filter over rows already in memory, no
 * request, matching as you type. Confusing the two is why some apps make you
 * leave your own library to get back into it.
 *
 * docs/library-module.html §03.
 */

/**
 * Strip accents and case so a title can be matched by what it sounds like
 * rather than by how it is spelled.
 *
 * `ame` has to find `Amélie`. A find that misses because of an accent is worse
 * than no find at all: the title is right there, the person typed it correctly,
 * and the app says it does not exist.
 */
export const fold = (value) => String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const wordsOf = (value) => fold(value).split(/[^\p{Letter}\p{Number}]+/u).filter(Boolean);

/**
 * Word-prefix, every term word, in any order.
 *
 * `poor` finds Poor Things. `part two` finds Dune: Part Two without caring that
 * "Dune" sits between them. Deliberately not a substring match — `art` should
 * not return every title containing the letters a-r-t, which is the kind of
 * result that makes somebody stop trusting the box.
 */
function hits(value, term) {
    const needles = wordsOf(term);
    if (!needles.length) return true;
    const hay = wordsOf(value);
    return needles.every((n) => hay.some((word) => word.startsWith(n)));
}

/** Whether a term names the person who recommended a row. L27. */
export const nameMatches = (name, term) => Boolean(name) && hits(name, term);

/**
 * Title, or the person who recommended it. L27.
 *
 * This used to be title only, and the reason given was that notes, people and
 * genre are searches and belong to Search. That still holds for notes and
 * genre — they ask the catalogue a question. A recommender does not: the name
 * was typed by this person, into this library, about this row. It is a label
 * they put on their own shelf, so finding by it is still "where did I put it".
 *
 * Takes the row rather than the title. The previous signature was
 * `matches(title, term)`, and a caller that passed a row to it would have read
 * `undefined`, folded to `''`, and matched every row in the library — absent
 * becoming plausible, which is the most expensive bug shape in this repo. The
 * rename is what prevents it: the old name no longer exists, so an un-updated
 * caller fails to build rather than silently returning everything.
 */
export function rowMatches(row, term) {
    if (typeof row === 'string') throw new TypeError('rowMatches takes a row, not a title');
    return hits(row?.title, term) || nameMatches(row?.recommendedBy, term);
}

/**
 * "9 recommended by Priya · 3 watched" — L27's payoff.
 *
 * The count is the point of the feature: the question somebody has is not what
 * did she recommend but am I behind on what she recommended.
 *
 * Returns null when the term names nobody, and also when it names more than
 * one person — a "Priya" who is two different people would otherwise be given
 * one confident count that is wrong for both. Absent stays absent rather than
 * defaulting into an answer-shaped number.
 */
export function recommenderSummary(rows, term) {
    if (!isFinding(term)) return null;
    const hit = (rows || []).filter((r) => nameMatches(r.recommendedBy, term));
    if (!hit.length) return null;
    const names = [...new Set(hit.map((r) => r.recommendedBy))];
    if (names.length !== 1) return null;
    return {
        name: names[0],
        total: hit.length,
        watched: hit.filter((r) => r.status === 'watched').length,
    };
}

/** Whether the person is actually finding, rather than having touched the box. */
export const isFinding = (term) => wordsOf(term).length > 0;
