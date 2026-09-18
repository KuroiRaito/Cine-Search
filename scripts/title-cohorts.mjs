#!/usr/bin/env node
/**
 * The nine cohorts, and the one thing each of them says.
 *
 *   npm run cohorts
 *
 * §03 of the title design: "Band 2 is the entire cohort system. Five cohorts,
 * five different buttons, one position." This is the table that holds it to
 * that — every case names the state, the button, and the line underneath.
 *
 * Node rather than a browser, because all of it is pure: cohortOf reads TMDB's
 * fields and primaryFor turns the answer into words. The page renders what they
 * return, and `npm run snap` already proves the page renders. Splitting them
 * this way is what makes it possible to check a returning-but-unscheduled
 * series with nineteen of nineteen episodes ticked without a session, a
 * library, or a network.
 */
import {
    cohortOf, primaryFor, seriesNote, yearsOf, shows, leadsWithDate, longDate,
    RELEASED, UPCOMING, NOT_PREMIERED, SCHEDULED, UNSCHEDULED, FINISHED,
} from '../src/modules/title/cohort.js';

const film = (o) => ({ mediaType: 'movie', status: 'Released', year: '2024', ...o });
const series = (o) => ({
    mediaType: 'tv', status: 'Returning Series', type: 'Scripted',
    year: '2022', inProduction: true, airedEpisodes: 0, episodeCount: 0, ...o,
});

let failed = 0;
const is = (label, got, want) => {
    const ok = got === want;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) console.log(`          want ${JSON.stringify(want)}\n           got ${JSON.stringify(got)}`);
};

/** The button, and the line under it, for a title in a given state. */
function band2(t, { saved = false, statusLabel = null, seen = 0, next = null } = {}) {
    const cohort = cohortOf(t);
    const p = primaryFor(t, cohort, { saved, statusLabel, seen, aired: t.airedEpisodes, next });
    return { cohort, ...p, note: seriesNote(t, cohort) };
}

console.log('\n  Cohorts — which one, and what band 2 says\n');

/* ---- TM · the movie page ---------------------------------------------- */

const dune2 = film({ title: 'Dune: Part Two', releaseDate: '2024-02-27' });
is('TM1  released, untracked  → invites',
    band2(dune2).label, 'Want to watch');
is('TM1  released, watched    → reports',
    band2(dune2, { saved: true, statusLabel: 'Watched' }).label, 'Watched');
is('TM1  released             → three statuses',
    band2(dune2).statuses, 3);

const dune3 = film({ title: 'Dune: Part Three', status: 'Post Production', releaseDate: '2026-12-18' });
is('TM2  upcoming             → cohort',
    band2(dune3).cohort, UPCOMING);
is('TM2  upcoming             → one status, and the button stands alone',
    `${band2(dune3).label} · ${band2(dune3).statuses} · ${band2(dune3).standalone}`,
    'Want to watch · 1 · true');
is('TM2  upcoming             → the date is the headline',
    leadsWithDate(cohortOf(dune3)) && longDate(dune3.releaseDate), '18 December 2026');
is('TM2  upcoming             → no providers, no scores, no synopsis',
    ['providers', 'scores', 'overview'].filter((b) => shows(UPCOMING, b)).length, 0);
is('TM1  released             → and the released cohort omits nothing',
    ['providers', 'scores', 'overview'].every((b) => shows(RELEASED, b)), true);

/* ---- TV · the series page --------------------------------------------- */

const potter = series({
    title: 'Harry Potter', status: 'In Production', year: '2026',
    seasonCount: 1, episodeCount: 0, airedEpisodes: 0, releaseDate: '2026-12-25',
});
is('TV0  not premiered        → cohort',
    band2(potter).cohort, NOT_PREMIERED);
is('TV0  not premiered        → wants, alone',
    `${band2(potter).label} · ${band2(potter).standalone}`, 'Want to watch · true');
is('TV0  not premiered        → no episode list, no progress, no providers',
    ['episodes', 'progress', 'providers'].filter((b) => shows(NOT_PREMIERED, b)).length, 0);

const bear = series({
    title: 'The Bear', year: '2022', seasonCount: 5, episodeCount: 46, airedEpisodes: 46,
    nextEpisode: { season: 4, number: 9, name: 'Tomorrow', airDate: '2026-09-24' },
});
const bearAt28 = band2(bear, { seen: 28, next: { season: 4, episode: 3, name: 'Worms' } });
is('TV1  scheduled            → cohort',
    bearAt28.cohort, SCHEDULED);
is('TV1  scheduled            → button',
    bearAt28.label, 'Continue · S4 E3');
is('TV1  scheduled            → detail',
    bearAt28.detail, '28 of 46 aired · next up Worms');
is('TV1  scheduled            → and the date is stated plainly',
    bearAt28.note, 'Next episode Thursday 24 September');
is('TV1  scheduled, all seen  → caught up, and it stands alone',
    `${band2(bear, { seen: 46 }).label} · ${band2(bear, { seen: 46 }).standalone}`,
    'Caught up · true');

const severance = series({
    title: 'Severance', year: '2022', seasonCount: 3, episodeCount: 19, airedEpisodes: 19,
    inProduction: true, nextEpisode: null,
});
is('TV2  unscheduled          → cohort',
    band2(severance).cohort, UNSCHEDULED);
is('TV2  unscheduled, 19/19   → caught up, never 100%, never finished',
    band2(severance, { seen: 19 }).label, 'Caught up');
is('TV2  unscheduled, 19/19   → says what is true today',
    band2(severance, { seen: 19 }).detail, '19 of 19 aired · renewed, no date announced');
is('TV2  unscheduled          → renewed, no date announced',
    band2(severance).note, 'Renewed — no date announced');
is('TV2  unscheduled, 10/19   → no percentage: the denominator can still move',
    band2(severance, { seen: 10, next: { season: 3, episode: 1, name: 'Hello' } }).detail,
    '10 of 19 aired · next up Hello');

const bb = series({
    title: 'Breaking Bad', status: 'Ended', year: '2008', lastAirDate: '2013-09-29',
    seasonCount: 5, episodeCount: 62, airedEpisodes: 62, inProduction: false,
});
const bbAt11 = band2(bb, { seen: 11, next: { season: 2, episode: 5, name: 'Breakage' } });
is('TV3  finished             → cohort',
    bbAt11.cohort, FINISHED);
is('TV3  finished             → button',
    bbAt11.label, 'Continue · S2 E5');
is('TV3  finished             → the only cohort where a percentage is honest',
    bbAt11.detail, '11 of 62 · 18% · next up Breakage');
is('TV3  finished, none seen  → start, not continue',
    band2(bb, { seen: 0, next: { season: 1, episode: 1, name: 'Pilot' } }).label, 'Start · S1 E1');

const firefly = series({
    title: 'Firefly', status: 'Canceled', year: '2002', lastAirDate: '2003-12-20',
    seasonCount: 1, episodeCount: 14, airedEpisodes: 14, inProduction: false,
});
is('TV4  cancelled            → still the finished cohort',
    band2(firefly).cohort, FINISHED);
is('TV4  cancelled            → and says cancelled: an unfinished story is a reason not to start',
    band2(firefly).note, 'Cancelled before it ended');

const chernobyl = series({
    title: 'Chernobyl', type: 'Miniseries', status: 'Ended', year: '2019',
    lastAirDate: '2019-06-03', seasonCount: 1, episodeCount: 5, airedEpisodes: 5,
});
is('TV5  miniseries           → finished by definition, whatever status says',
    band2(chernobyl).cohort, FINISHED);

/* ---- the years under the title ---------------------------------------- */

is('years  running            → open-ended',
    yearsOf(severance, UNSCHEDULED), '2022–');
is('years  finished           → closed',
    yearsOf(bb, FINISHED), '2008–2013');
is('years  one-year run       → not "2019–2019"',
    yearsOf(chernobyl, FINISHED), '2019');
is('years  film               → just the year',
    yearsOf(dune2, RELEASED), '2024');

/* ---- and the thing the whole system is for ---------------------------- */

/* The five §06 draws, in its order. Note TM1 is drawn already-watched: an
   untracked released film also says "Want to watch", and that is right rather
   than a collision — it is the same job. What separates it from TM2 is that it
   offers three statuses where TM2 offers one. */
const buttons = [
    band2(dune2, { saved: true, statusLabel: 'Watched' }).label,
    band2(dune3).label,
    bearAt28.label,
    band2(severance, { seen: 19 }).label,
    bbAt11.label,
];
console.log(`\n  Five cohorts, one position:\n    ${buttons.join('  ·  ')}`);
is('  five different jobs, five different buttons',
    new Set(buttons).size, 5);
is('  and the two that share a label differ in what they offer',
    `${band2(dune2).label}=${band2(dune2).statuses} ${band2(dune3).label}=${band2(dune3).statuses}`,
    'Want to watch=3 Want to watch=1');

console.log(failed ? `\n  ${failed} failed.\n` : '\n  All cases pass.\n');
process.exit(failed ? 1 : 0);
