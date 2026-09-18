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
import {
    orderTabs, tabLabel, tabCount, seasonTitle, seenIn, episodeName,
} from '../src/modules/title/seasons.js';
import {
    rankOf, orderRoles, leadRoles, neitherWins, hasProgress, evidenceLine, activeYears, allCredits,
} from '../src/modules/person/people.js';

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

/* ---- §03b · seasons, and the four things real series forced -------------- */

console.log('');
const greys = Array.from({ length: 24 }, (_, i) => ({ season_number: i + 1, name: `Season ${i + 1}`, episode_count: 22 }));
const specials = { season_number: 0, name: 'Specials', episode_count: 68 };
const tabs = orderTabs(greys, specials);

is('seasons  specials are last, never first',
    `${tabLabel(tabs[0])} … ${tabLabel(tabs[tabs.length - 1])}`, 'S1 … Specials');
is('seasons  and are never called "Season 0"',
    tabs.filter((t) => tabLabel(t) === 'Season 0').length, 0);
is('seasons  a generic name becomes a pill you can fit 24 of',
    tabLabel({ season_number: 12, name: 'Season 12', episode_count: 22 }), 'S12');
is('seasons  a real name survives — Chernobyl calls its one season this',
    tabLabel({ season_number: 1, name: 'Miniseries', episode_count: 5 }), 'Miniseries');
is('seasons  and so does a named season on a long-running show',
    tabLabel({ season_number: 4, name: 'The Final Season', episode_count: 10 }), 'The Final Season');
is('seasons  no name at all still gets a pill',
    tabLabel({ season_number: 7, name: '', episode_count: 9 }), 'S7');

const watched = { 2: [1, 2, 3, 4], 3: [] };
is('seasons  a pill with no progress carries its count',
    tabCount({ season_number: 1, episode_count: 7 }, watched), '7');
is('seasons  a pill with progress carries its own fraction',
    tabCount({ season_number: 2, episode_count: 13 }, watched), '4/13');
is('seasons  "11 of 62" tells you nothing; "4 of 13" tells you where you are',
    `${seenIn(watched, 2)} of 13`, '4 of 13');

is('seasons  the header has room for the long form',
    seasonTitle({ season_number: 2, name: 'Season 2' }), 'Season 2');
is('seasons  and specials keep their word there too',
    seasonTitle({ season_number: 0, name: 'Specials' }), 'Specials');

is('TV7      TMDB leaves the name blank for unaired runs',
    episodeName({ number: 7, name: '' }), 'Episode 7');
is('TV7      and a named one is left alone',
    episodeName({ number: 7, name: 'Breakage' }), 'Breakage');

/* ---- §05 · the person page, which never labels the person -------------- */

console.log('');
const credit = (title, year, genres = [28]) => ({ id: title.length * 7 + year, mediaType: 'movie', title, year: String(year), genreIds: genres });
const TALK = 10767;

const directed = {
    key: 'director', label: 'Directed', verb: 'directed', filteredOut: 0,
    items: [credit('Barbie', 2023), credit('Lady Bird', 2017), credit('Little Women', 2019)],
};
const acted = {
    key: 'cast', label: 'Acted in', verb: 'acted in', filteredOut: 0,
    items: [
        credit('Frances Ha', 2012), credit('Jackie', 2016), credit('20th Century Women', 2016),
        // The credit that broke every popularity signal the design tested.
        credit('The Tonight Show', 2019, [TALK]),
        credit('Watch What Happens Live', 2018, [TALK]),
    ],
};
const scored = {
    key: 'composer', label: 'Scored', verb: 'scored', filteredOut: 0,
    items: Array.from({ length: 9 }, (_, i) => credit(`Score ${i}`, 2000 + i)),
};

is('TP  a talk-show slot is not a body of work',
    `${acted.items.length} credits, ${rankOf(acted)} count`, '5 credits, 3 count');
is('TP  and it stays in the filmography, where it is a real credit',
    acted.items.length, 5);
is('TP  sections are ordered by what is left',
    orderRoles([acted, scored, directed]).map((r) => r.label).join(' → '),
    'Scored → Acted in → Directed');

is('TP4 when the top two are close, neither wins',
    neitherWins([directed, acted]), true);
is('TP4 and then authored work leads — §06 draws Directed first, twice',
    leadRoles([acted, directed]).map((r) => r.label).join(' → '), 'Directed → Acted in');
is('TP3 but when the numbers do choose, they choose',
    leadRoles([scored, directed]).map((r) => r.label).join(' → '), 'Scored → Directed');
is('TP3 when they are not, one does',
    neitherWins([scored, directed]), false);

is('TP1 a bar on authored work',
    ['director', 'creator', 'writer'].every(hasProgress), true);
is('TP2 no bar on acting — a filmography is not a canon',
    hasProgress('cast'), false);
is('TP3 and none on crew: "6 of 202 scored" is not a claim anybody makes',
    hasProgress('composer'), false);

is('TP  the line under the name is verbs and titles, never a job title',
    evidenceLine([directed, acted]), 'Directed Barbie, Lady Bird · Acted in Frances Ha, Jackie');
is('TP  and a talk show never becomes the evidence',
    evidenceLine([acted], { roleLimit: 1, titleLimit: 5 }).includes('Tonight Show'), false);

is('TP  active years span the work, not the life',
    activeYears([directed, acted]), '2012–23');
is('TP  one credit each way, counted once',
    allCredits([directed, { ...directed, key: 'writer', label: 'Wrote' }]).length, 3);

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
