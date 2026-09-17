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
 *
 * Title only. Not notes, not people, not genre: those are searches, and they
 * belong to Search.
 */
export function matches(title, term) {
    const needles = wordsOf(term);
    if (!needles.length) return true;
    const hay = wordsOf(title);
    return needles.every((n) => hay.some((word) => word.startsWith(n)));
}

/** Whether the person is actually finding, rather than having touched the box. */
export const isFinding = (term) => wordsOf(term).length > 0;
