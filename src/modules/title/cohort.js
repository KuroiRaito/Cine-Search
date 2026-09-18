/**
 * Which of the nine the page is looking at, and what band 2 says about it.
 *
 * §02 of the title design: a variation is a genuinely different page, a cohort
 * is a state that page can be in. A cohort may change the primary action,
 * change what progress means, and omit bands. It may never add one, and never
 * reorder them — which is why this file returns labels and permissions, and
 * never components.
 *
 * The discriminators are TMDB's, sampled live in §01. Nothing here guesses:
 * every branch below turns on a field the API actually returns.
 */

export const RELEASED = 'released';
export const UPCOMING = 'upcoming';
export const NOT_PREMIERED = 'not-premiered';
export const SCHEDULED = 'scheduled';
export const UNSCHEDULED = 'unscheduled';
export const FINISHED = 'finished';

const ENDED = new Set(['Ended', 'Canceled', 'Cancelled']);

/**
 * A film is out or it is not. A series has four states, and the one worth
 * naming is `unscheduled` — returning, in production, and with no next episode.
 * Severance is in it today, and a design that only knows "running" and "ended"
 * has to pretend it is one of those.
 */
export function cohortOf(t) {
    if (t.mediaType !== 'tv') {
        return t.status === 'Released' ? RELEASED : UPCOMING;
    }
    // A miniseries is finished by definition: it is the whole story, declared
    // as such, whatever its status field says on any given day.
    if (t.type === 'Miniseries' || ENDED.has(t.status)) return FINISHED;
    if (!t.airedEpisodes) return NOT_PREMIERED;
    if (t.nextEpisode) return SCHEDULED;
    return UNSCHEDULED;
}

/** Cancelled is not a cohort — it is a fact a finished series may carry, and
 *  an unfinished story is a reason not to start. TV4. */
export const isCancelled = (t) => t.status === 'Canceled' || t.status === 'Cancelled';

/** A miniseries gets the finished page with no season picker. TV5. */
export const isMiniseries = (t) => t.type === 'Miniseries';

/**
 * Bands a cohort omits. §03's order never changes; a cohort's only power over
 * the spine is to leave something out.
 *
 * An upcoming film has no runtime, no score, no providers and usually no
 * synopsis. Half the page is legitimately absent — so it says nothing and
 * draws nothing, rather than drawing four empty boxes that look broken.
 */
const OMITS = {
    [UPCOMING]: new Set(['providers', 'scores', 'overview', 'episodes']),
    [NOT_PREMIERED]: new Set(['providers', 'scores', 'episodes', 'progress']),
};
export const shows = (cohort, band) => !OMITS[cohort]?.has(band);

/** Only these two lead with a date, and for them it is the headline. */
export const leadsWithDate = (cohort) => cohort === UPCOMING || cohort === NOT_PREMIERED;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

/** "18 December 2026". Long, because it is the headline of the page. */
export function longDate(iso) {
    if (!iso) return null;
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return null;
    return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Thursday 24 September" — a near date reads better by its day name. */
export function dayAndDate(iso) {
    if (!iso) return null;
    const dt = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return null;
    const day = dt.toLocaleDateString('en-GB', { weekday: 'long' });
    return `${day} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

/**
 * The years under the title. A film is one year; a series is a run, and the
 * run says whether it is over: "2022–" is still going, "2008–2013" is not.
 */
export function yearsOf(t, cohort) {
    if (t.mediaType !== 'tv') return t.year || null;
    const from = t.year;
    if (!from) return null;
    if (cohort === FINISHED) {
        const to = t.lastAirDate ? String(t.lastAirDate).slice(0, 4) : null;
        return to && to !== from ? `${from}–${to}` : from;
    }
    return `${from}–`;
}

/**
 * Band 2, in words.
 *
 * §03d, learned from drawings that broke it: a primary button is one line. The
 * verb takes the button and the detail goes underneath, on the line that
 * already states progress — stacking a label over a caption pushes the control
 * to 52px and makes it read as two controls in a box.
 *
 * Returns { label, detail, note, standalone }. `standalone` means the button
 * is the whole statement and the detail line would only repeat the page.
 */
export function primaryFor(t, cohort, { saved, statusLabel, seen, aired, next }) {
    const upcoming = cohort === UPCOMING || cohort === NOT_PREMIERED;

    // Nothing has come out. There is exactly one thing a person can say about
    // it, and the date is the page's headline rather than this button's job.
    if (upcoming) {
        return { label: 'Want to watch', standalone: true, statuses: 1 };
    }

    if (t.mediaType !== 'tv') {
        return saved
            ? { label: statusLabel, saved: true, statuses: 3 }
            : { label: 'Want to watch', statuses: 3 };
    }

    const total = aired || 0;
    const caughtUp = total > 0 && seen >= total;

    // "Caught up" stands alone. The line underneath would have said
    // "19 of 19 aired", which is the same sentence twice.
    if (caughtUp && cohort !== FINISHED) {
        return {
            label: 'Caught up',
            standalone: true,
            detail: cohort === SCHEDULED
                ? `${seen} of ${total} aired`
                : `${seen} of ${total} aired · renewed, no date announced`,
            statuses: 6,
        };
    }
    if (caughtUp) {
        return { label: statusLabel || 'Watched', saved: true, statuses: 6 };
    }

    const where = next ? ` · S${next.season} E${next.episode}` : '';
    const label = (seen > 0 ? 'Continue' : 'Start') + where;

    // A percentage is only honest where the denominator cannot move. On a
    // running series it is a number that goes down when an episode airs.
    const pct = cohort === FINISHED && total > 0
        ? ` · ${Math.round((seen / total) * 100)}%`
        : '';
    const scope = cohort === FINISHED ? '' : ' aired';
    const upNext = next?.name ? ` · next up ${next.name}` : '';

    return {
        label,
        detail: `${seen} of ${total}${scope}${pct}${upNext}`,
        statuses: 6,
    };
}

/**
 * The line under the primary that is about the series rather than about you.
 * Only two cohorts have one, and each says the thing the other cannot.
 */
export function seriesNote(t, cohort) {
    if (cohort === SCHEDULED && t.nextEpisode?.airDate) {
        return `Next episode ${dayAndDate(t.nextEpisode.airDate)}`;
    }
    if (cohort === UNSCHEDULED) return 'Renewed — no date announced';
    if (cohort === FINISHED && isCancelled(t)) return 'Cancelled before it ended';
    return null;
}
