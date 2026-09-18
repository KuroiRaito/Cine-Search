/**
 * What a person is, worked out from what they made.
 *
 * §05's rule, and the whole basis of this page: name the work, never the
 * person. No job title anywhere — not a badge, not a subtitle.
 *
 * Three signals exist for "what is this person" and the design tested all
 * three. Two are broken:
 *
 *   known_for_department   Gerwig -> Acting, despite Director x 6 including
 *                          Barbie and Lady Bird. Right often, badly wrong
 *                          sometimes, which is the worst kind.
 *   TMDB's own known_for   Gerwig -> Frances Ha, No Strings Attached, Jackie.
 *                          All acting. Popularity-shaped, and it lags a
 *                          career turning.
 *   credit counts          works, once talk shows are out of the signal.
 *
 * So the page shows the evidence and lets the reader do what the data cannot.
 * "Directed Barbie" teaches somebody who has never heard of Greta Gerwig more
 * than the word "Director" does — and it is the one formulation that cannot be
 * wrong, because it is not a claim, it is a list.
 */

/**
 * Talk, News, Reality. Removed from the ranking signal, never from the
 * filmography, where they are real credits somebody earned.
 *
 * Without this every single person comes out an actor, because their most
 * popular credit is The Tonight Show, The Late Show or Watch What Happens
 * Live. A one-off guest slot on a two-thousand-episode series outranks a
 * career. With it: Villeneuve to Directing, Murphy to Acting, both correct.
 */
export const NOT_A_BODY_OF_WORK = new Set([10767, 10763, 10764]);

const counts = (item) => !(item.genreIds || []).some((g) => NOT_A_BODY_OF_WORK.has(g));

/** How much of a body of work a role really is. */
export const rankOf = (role) => role.items.filter(counts).length;

/** Heaviest first. The order of the sections, and of the chips. */
export const orderRoles = (roles) =>
    [...roles].sort((a, b) => rankOf(b) - rankOf(a) || a.label.localeCompare(b.label));

/**
 * When the top two are close, neither wins — and that is a result, not a
 * fallback. Gerwig comes out 64 acting against 58 directing with talk shows
 * excluded. A page that picked one would be asserting something the data
 * explicitly refuses to, so both sections show at equal weight, in that order,
 * and the word "primarily" appears nowhere.
 */
export const BOTH_WIN_WITHIN = 0.25;
export function neitherWins(roles) {
    const [a, b] = orderRoles(roles);
    if (!a || !b) return false;
    const top = rankOf(a);
    return top > 0 && (top - rankOf(b)) / top <= BOTH_WIN_WITHIN;
}

/**
 * The order the page actually uses.
 *
 * Rank decides it, except when the top two are close enough that rank is not
 * deciding anything. §05 reads two ways there and its drawing settles it: the
 * prose has Gerwig at 64 acting against 58 directing, and §06 draws Directed
 * first anyway — in the evidence line and in the stacked sections, twice, which
 * is not a slip.
 *
 * It is also the right way round. The whole argument of §05 is that calling
 * Greta Gerwig an actor is the error to avoid; leading with acting when the
 * numbers refuse to choose reproduces that error in a quieter voice. So inside
 * the band where neither wins, authored work leads — and outside it, rank does,
 * because then the numbers are saying something.
 */
export function leadRoles(roles) {
    const ordered = orderRoles(roles);
    if (!neitherWins(roles)) return ordered;
    const authored = ordered.filter((r) => hasProgress(r.key));
    return authored.length && authored.length < ordered.length
        ? [...authored, ...ordered.filter((r) => !hasProgress(r.key))]
        : ordered;
}

/**
 * A progress bar appears only on authored work.
 *
 * "6 of 26 directed" is a canon somebody works through. "6 of 202 scored" is
 * not the same claim, and an actor's filmography is not a canon — a bar there
 * would be inventing an ambition nobody has.
 */
const AUTHORED = new Set(['director', 'creator', 'writer']);
export const hasProgress = (key) => AUTHORED.has(key);

/**
 * The line under the name: verbs and titles, not a job.
 *
 *   Directed Barbie, Lady Bird · Acted in Frances Ha, Jackie
 *
 * Two roles at most and two titles each, because it is a line and not a
 * filmography — the filmography is directly below it.
 */
export function evidenceLine(roles, { roleLimit = 2, titleLimit = 2 } = {}) {
    /* A title names its role once. Denis Villeneuve directed and wrote the same
       two films, and the first version of this line read "Directed Dune: Part
       Two, Dune · Written Dune: Part Two, Dune" — which is the page repeating
       itself, and makes the second clause look like a mistake. */
    const used = new Set();
    return leadRoles(roles)
        .slice(0, roleLimit)
        .map((r) => {
            const titles = [];
            for (const i of r.items) {
                if (titles.length >= titleLimit) break;
                const key = `${i.mediaType}-${i.id}`;
                if (!counts(i) || used.has(key)) continue;
                used.add(key);
                titles.push(i.title);
            }
            if (!titles.length) return null;
            return `${past(r)} ${titles.join(', ')}`;
        })
        .filter(Boolean)
        .join(' · ');
}

/* The role's label is already the past tense — "Directed", "Wrote", "Acted in"
   — because §05 does not allow the noun form anywhere on this page. */
const past = (r) => r.label;

/**
 * "1998–24". The span of the work rather than of the life: a person page is
 * about what they made, and a birth year is the kind of fact this page has
 * decided not to lead with.
 */
export function activeYears(roles) {
    const years = roles
        .flatMap((r) => r.items.map((i) => Number(i.year)))
        .filter((y) => Number.isFinite(y) && y > 1870);
    if (!years.length) return null;
    const from = Math.min(...years);
    const to = Math.max(...years);
    return from === to ? String(from) : `${from}–${String(to).slice(2)}`;
}

/** Every credit once, however many roles it appears under. */
export function allCredits(roles) {
    const seen = new Set();
    const out = [];
    for (const r of leadRoles(roles)) {
        for (const i of r.items) {
            const key = `${i.mediaType}-${i.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(i);
        }
    }
    return out;
}
