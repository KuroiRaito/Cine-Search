/**
 * What shape of answer a query has earned — FQ3, FQ4 and FQ5 of §08.
 *
 * Three result shapes beyond the plain grid, and every one of them is a claim
 * about what somebody meant:
 *
 *   FQ3  the query names a person      — the row goes first, the grid is their work
 *   FQ4  two people share that name    — neither is promoted; both are rows
 *   FQ5  the top film has a collection — one band above the grid, in release order
 *
 * Everything here is pure and offline. The decisions are the expensive part to
 * get wrong and the cheap part to test, so they live apart from the fetching
 * and `npm run answer` holds them to the numbers below without a network.
 *
 * §08 states FQ3's rule as three conditions: TMDB returns them at rank 1, they
 * pass the plausibility gate, and no title matches the words strongly. The
 * third is not a separate test here, and that is measured rather than
 * overlooked — see `promotedPerson`.
 */

/**
 * The floor the shipped people section uses, unchanged.
 *
 * It decides who is worth a ROW at all when a title already answered: it has to
 * reject Aggy Dune, Nea Dune and a boxer called Vasyl Lomachenko, who TMDB
 * returns for "the matrix". Moving it would change FQ2 and FQ6, which are
 * shipped and were measured against this number.
 */
export const PLAUSIBLE_FLOOR = 1;

/**
 * And the floor for casting DOUBT, which is a different question.
 *
 * A person does not have to be worth showing to make a name ambiguous. Measured
 * on live TMDB, 27 November 2026: "chris williams" returns Chris Williams the
 * DodgeBall actor at 1.00 and Chris Williams who directed Big Hero 6 and Moana
 * at 0.74. At the row floor the director is invisible, the actor is promoted,
 * and the grid fills with DodgeBall — which is exactly the collision FQ4
 * exists to prevent, arriving through the gap between the two numbers.
 *
 * 0.5 is where the evidence divides, not a round number. The real rivals
 * measured across the collisions found start at 0.55 (James Murray ×3 at 0.99,
 * 0.58, 0.55; Mike Mitchell ×3 at 0.94, 0.83, 0.60; Mark Williams ×2 at 2.25,
 * 0.75). The fakes — the three other people TMDB holds under the exact name
 * "Christopher Nolan", and the second "Brad Pitt" — are all at popularity 0
 * with no photograph. The gap is 0 to 0.55 and nothing lives in it.
 *
 * Two floors for two questions, and that is not the "one state spelled two
 * ways" class: that class is one question answered with two values in two
 * files. These are "worth a row" and "casts doubt", both named here, both
 * measured, in one file.
 */
export const RIVAL_FLOOR = 0.5;

/** How many credits an evidence line carries. One is not a comparison; three
 *  does not fit a 320px row beside a face and a chevron. */
export const EVIDENCE_CREDITS = 2;

/**
 * Names compared the way a reader compares them — not the way a database does.
 *
 * "Christopher Nolan" and "christopher  nolan" are the same name; "Michael
 * Jordan" and "Michael B. Jordan" are not, which is why promoting the rank-1
 * Michael B. Jordan over a differently-named Michael Jordan is correct and not
 * a collision. Diacritics fold, because TMDB spells the same person both ways.
 */
export const foldName = (v) => String(v || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Worth a row: a photograph and a pulse of popularity.
 *
 * Both are proxies and neither is sufficient alone — the boxer has a photo and
 * one of the Dunes has a pulse. This is the shipped gate, restated here so the
 * promotion rule and the section rule are visibly the same rule.
 */
export const isPlausiblePerson = (p) => (p?.popularity || 0) >= PLAUSIBLE_FLOOR
    && Boolean(p?.profile_path);

/** Enough of a person to make a name mean two things. */
export const couldBeMeant = (p) => (p?.popularity || 0) >= RIVAL_FLOOR
    && Boolean(p?.profile_path);

/**
 * Everybody in this response who answers to the same name, or [].
 *
 * Returns the whole group in the order TMDB gave, so the caller can draw them
 * all and does not have to decide which came first — there is no "first" in an
 * ambiguous answer, which is the entire point of FQ4.
 */
export function clashingPeople(people) {
    const serious = (people || []).filter(couldBeMeant);
    for (const p of serious) {
        const name = foldName(p.name);
        if (!name) continue;
        const same = serious.filter((x) => foldName(x.name) === name);
        if (same.length >= 2) return same;
    }
    return [];
}

/**
 * FQ3 — the person whose work the grid may become, or null.
 *
 * `lead` is the media type TMDB put at rank 1 across the whole /search/multi
 * response, carried out of `searchMulti` because splitting people from titles
 * destroys it. Absent means a path that never asked — a filtered search falls
 * back to v1, which returns no people and no rank — and absent stays absent
 * rather than becoming a `false` that reads like an answer.
 *
 * ON THE THIRD CONDITION §08 WRITES. "No title matches the words strongly" is
 * not tested separately, because `lead` already is that test and a separate one
 * gets it wrong. Measured on the design's own fifteen person-led queries:
 * "greta gerwig" returns a 2024 documentary titled exactly *Greta Gerwig*, so
 * any rule of the form "no title's name equals the query" refuses to promote
 * her — and §08 lists her among the thirteen that work. TMDB's own ranking
 * already weighs the title against the person and put HER first, where for
 * "dune" it put the film first (the person there is at rank 12). One field,
 * both conditions, and no second opinion to disagree with it.
 */
export function promotedPerson({ lead, people }) {
    if (lead !== 'person') return null;
    const top = (people || [])[0];
    /* `couldBeMeant`, not `isPlausiblePerson`, and this is the one place the
       two differ on purpose.
       The row floor's job is to reject a person TMDB dug up when a title had
       already answered — Aggy Dune, at rank 12 for "dune". Rank 1 is not that
       situation: TMDB ranked this person above every title for these words, and
       the rank is better evidence than the popularity number ever was. Measured
       on the golden set, applying the row floor here costs Rajkumar Hirani
       (0.62) and Nawazuddin Siddiqui (0.92) — two of §08's own thirteen, both
       Indian cinema, which is the category this module exists to serve. In the
       browser it was worse than a missed promotion: TMDB returns no titles for
       "nawazuddin siddiqui", so the screen read "Nothing for nawazuddin
       siddiqui" for a search it had answered with the right man at rank 1.
       The section below keeps the row floor untouched, so FQ2 and FQ6 are
       exactly as they shipped. */
    if (!couldBeMeant(top)) return null;
    // FQ4. A claim this strong — the grid below is THIS person's work — is not
    // one to make while the name is still ambiguous.
    const name = foldName(top.name);
    if ((people || []).some((p) => p.id !== top.id && foldName(p.name) === name && couldBeMeant(p))) {
        return null;
    }
    return top;
}

/**
 * What tells two people of one name apart. Never a job title.
 *
 * The title module tested three signals for naming a person and two failed, so
 * its §05 forbids labelling anybody by role: the credits are the evidence.
 * This case is the proof rather than an application of it — all three James
 * Murrays TMDB returns are filed under Acting, so a role label reads "Acted
 * in" three times and identifies nobody, while *6 Underground* against
 * *Impractical Jokers* against *The Crowd* identifies all three instantly.
 *
 * `known_for` rides along on every person row, so this costs no request.
 * No verb: the only job information a search row carries is
 * `known_for_department`, which is TMDB's own taxonomy and files boom operators
 * under Sound beside composers. A line that cannot name the job cannot name it
 * wrongly.
 *
 * Named for its SOURCE rather than its job, because the person module has an
 * `evidenceLine` of its own and the two are not interchangeable: that one reads
 * real credit records and can say "Directed Barbie, Lady Bird", this one has
 * only TMDB's `known_for` and may not claim a verb. One name for two of these
 * would be the next instance of a class this repo has already paid for.
 */
export const knownForLine = (person, n = EVIDENCE_CREDITS) => (person?.known_for || [])
    .map((k) => k?.title || k?.name)
    .filter(Boolean)
    .slice(0, n)
    .join(', ') || null;

/**
 * The film a collection may be read from — the top FILM, never a series.
 *
 * §08: the franchise comes from the top film's own `belongs_to_collection`, not
 * from /search/collection, which led with *The Making of The Lord of the Rings
 * Collection* and *Avengers Grimm Collection* on two of the four queries
 * checked. "harry potter" is why this skips series: TMDB's rank 1 for it is the
 * 2026 television show, which belongs to no collection, and the eight films
 * are behind it.
 *
 * Takes the VIEW shape — `mediaType`, what a Tile is given. A raw TMDB item
 * spells it `media_type`, would match nothing, and would report "no film" for a
 * grid full of films: absent quietly becoming a plausible answer, which is the
 * most expensive bug shape in this repo. So it is refused rather than skipped.
 */
export function topFilm(items) {
    for (const it of items || []) {
        if (it && it.mediaType === undefined && it.media_type !== undefined) {
            throw new TypeError('topFilm wants the view shape (mediaType), not TMDB\'s (media_type)');
        }
        if (it?.mediaType === 'movie') return it;
    }
    return null;
}

/**
 * FQ5 — a collection in release order, oldest first.
 *
 * Takes the TMDB/harness shape, because `date` is the field it has to read and
 * the view shape keeps only the year: *The Matrix Reloaded* and *The Matrix
 * Revolutions* are both 2003, and a franchise band sorted by year puts them in
 * whatever order the array happened to arrive in. Convert after ordering, not
 * before.
 *
 * TMDB's /collection/{id} does not return `parts` in order — measured: Harry
 * Potter comes back Philosopher's Stone, Chamber of Secrets, Goblet of Fire,
 * Half-Blood Prince, Prisoner of Azkaban, which is neither release nor story
 * order. Undated films sort last rather than first; an unreleased sequel is not
 * the start of the franchise.
 */
export function releaseOrder(items) {
    for (const it of items || []) {
        if (it && it.date === undefined && it.poster !== undefined) {
            throw new TypeError('releaseOrder wants TMDB\'s shape (date), not the view shape (year)');
        }
    }
    return [...(items || [])].sort((a, b) => String(a?.date || '9999').localeCompare(String(b?.date || '9999')));
}

/**
 * How much of a body of work has been seen.
 *
 * `isSeen` rather than a status comparison of its own, so this fraction and the
 * "6 of 25 seen" on a person row are answering the same question the same way.
 */
export function seenOf(films, isSeenFilm) {
    const list = films || [];
    return { seen: list.filter((f) => isSeenFilm(f)).length, total: list.length };
}

/**
 * Whether a collection has earned a band, and what the band says.
 *
 * A "collection" of one film is not a franchise — TMDB files plenty of them,
 * and a band reporting "1 film · 0 seen" above a grid is furniture. Two is the
 * floor at which "in release order" means anything.
 */
export function collectionBand({ name, films }) {
    const list = films || [];
    if (!name || list.length < 2) return null;
    return { name, films: list };
}
