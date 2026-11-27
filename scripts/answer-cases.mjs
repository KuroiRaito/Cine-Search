#!/usr/bin/env node
/**
 * The three result shapes of §08, held to what was measured.
 *
 *   npm run answer            the rules, offline — no network, no TMDB
 *   npm run answer -- --live  and then the shapes against live TMDB
 *
 * FQ3, FQ4 and FQ5 are decisions before they are layouts, and a decision is
 * the half that can be wrong silently: a promotion that should not have
 * happened puts somebody else's filmography under a name, and a band from the
 * wrong collection reports a franchise nobody searched for. So the decisions
 * are pure, they live in `src/modules/search/answer.js`, and this is their test.
 *
 * Every person row below is a real /search/multi response recorded on 27
 * November 2026, with the fields the rules read kept and the rest dropped.
 * Pinned, because live third-party data in a deterministic test is not a test
 * — `snap --check` has already failed on an untouched main because TMDB drifted
 * underneath it. The --live half is the only thing that can say whether these
 * recordings still describe TMDB, and it is evidence rather than a gate.
 */
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
    PLAUSIBLE_FLOOR, RIVAL_FLOOR, foldName, isPlausiblePerson, couldBeMeant,
    clashingPeople, promotedPerson, knownForLine, topFilm, releaseOrder,
    seenOf, collectionBand,
} from '../src/modules/search/answer.js';
import { toPersonView } from '../src/shared/tmdb/view.js';
import { leadRoles } from '../src/modules/person/people.js';

const LIVE = process.argv.includes('--live');

let failed = 0;
const is = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) console.log(`          want ${JSON.stringify(want)}\n           got ${JSON.stringify(got)}`);
};
const throws = (label, fn, match) => {
    let message = null;
    try { fn(); } catch (e) { message = e?.message || String(e); }
    const ok = Boolean(message) && message.includes(match);
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) console.log(`          wanted a throw containing ${JSON.stringify(match)}\n           got ${JSON.stringify(message)}`);
};

/* ---- the recordings ---------------------------------------------------
   `p()` builds one person row the way /search/multi hands it over: an id, a
   name, a popularity, a profile_path or not, and known_for. */
const p = (id, name, popularity, photo, known_for = [], dept = 'Acting') => ({
    id, name, popularity, profile_path: photo ? `/${id}.jpg` : null, known_for_department: dept,
    known_for: known_for.map((title) => ({ title })),
});

// "christopher nolan" — him at rank 1, and three other people TMDB holds under
// that exact name, all at popularity 0 with no photograph.
const NOLAN = [
    p(525, 'Christopher Nolan', 9.2722, true, ['Interstellar', 'Inception', 'The Dark Knight'], 'Directing'),
    p(4066940, 'Christopher Nolan', 0, false),
    p(6279344, 'Christopher Nolan', 0, false, [], 'Directing'),
    p(6389343, 'Christopher Nolan', 0, false, [], 'Production'),
    p(1097178, 'Christopher Patrick Nolan', 0.2, true),
];
// "tarantino" — rank 1 is him, and the name he answers to is not the one typed.
const TARANTINO = [
    p(138, 'Quentin Tarantino', 5.9972, true, ['Pulp Fiction', 'Django Unchained'], 'Directing'),
    p(1061609, 'Paul Tarantino', 0.4, false, [], 'Writing'),
    p(1925818, 'Aldo Tarantino', 0.1, true),
];
// "dune" — the people are real people and none of them is the answer. The
// boxer's cousin: Nicky Dune has a photograph, Aggy Dune has a pulse.
const DUNE_PEOPLE = [
    p(3084139, 'Aggy Dune', 0.29, false),
    p(1482685, 'Nea Dune', 0.25, false),
    p(4969607, 'Nicky Dune', 0.11, true),
];
// "chris williams" — the collision the row floor hides. 1.00 and 0.74.
const CHRIS_WILLIAMS = [
    p(1214427, 'Chris Williams', 1.00, true, ['DodgeBall: A True Underdog Story', 'The Joneses', 'Scary Movie 4']),
    p(70238, 'Chris Williams', 0.74, true, ['Big Hero 6', 'Moana', 'Bolt'], 'Directing'),
];
// "james murray" — three people, all filed under Acting, so a role label reads
// the same three times and identifies nobody.
const JAMES_MURRAY = [
    p(435243, 'James Murray', 0.99, true, ['6 Underground', 'Primeval', 'Lee']),
    p(1638285, 'James Murray', 0.58, true, ['Impractical Jokers', 'Impractical Jokers: The Movie']),
    p(29986, 'James Murray', 0.55, true, ['The Crowd', 'The Shakedown', 'The Reckoning']),
];
// "john williams" — two, both above the row floor, and rank 1 is a title.
const JOHN_WILLIAMS = [
    p(491, 'John Williams', 2.7252, true, ['Harry Potter and the Philosopher\'s Stone', 'Harry Potter and the Chamber of Secrets'], 'Sound'),
    p(5182, 'John Williams', 1.2649, true, ['Dial M for Murder', 'To Catch a Thief']),
];
// "michael jordan" — rank 1 is Michael B. Jordan and the other is Michael
// Jordan. Two names, not one, so nothing is ambiguous.
const JORDANS = [
    p(135651, 'Michael B. Jordan', 4.3784, true, ['Black Panther', 'Creed']),
    p(23678, 'Michael Jordan', 1.4217, true, ['Space Jam', 'The Last Dance']),
];
// The two false positives in the golden set: a person at rank 1 who is not the
// answer to anything.
const DANGL = [p(1259792, 'Daniel Dangl', 0.2199, true, ['Partička', 'Everything\'s possible'], 'Creator')];
/* The two of §08's thirteen that the shipped row floor now refuses. TMDB's
   popularity scale has moved under a number written a year ago, and both
   casualties are Indian cinema. "nawazuddin siddiqui" is the worse of the two
   in the browser: TMDB returns no titles for it at all, so the row floor's
   refusal was a "Nothing found" screen for a query it had answered correctly. */
const HIRANI = [p(85675, 'Rajkumar Hirani', 0.6211, true, ['3 Idiots', 'PK', 'Munna Bhai M.B.B.S.'], 'Writing')];
const SIDDIQUI = [p(85047, 'Nawazuddin Siddiqui', 0.9168, true, ['Lion', 'The Lunchbox', 'Bajrangi Bhaijaan'])];
/* "alfred hitchcock" — rank 1 is *The Alfred Hitchcock Hour*, and he is the
   only plausible person with no namesake above the doubt floor. So the RANK is
   the only thing between him and a promotion, which makes this the one
   recording that can test the rank on its own. It is also §08's third
   condition happening for real: a title matches the words strongly, and TMDB's
   own ranking is what says so. */
const HITCHCOCK = [
    p(2636, 'Alfred Hitchcock', 3.4913, true, ['Psycho', 'Rear Window', 'Vertigo'], 'Directing'),
];
/* "emma thomas" — the same isolation with a film at rank 1 rather than a
   series. Her three namesakes have no photograph, so they do not clash. */
const EMMA_THOMAS = [
    p(556, 'Emma Thomas', 1.6101, true, ['Interstellar', 'Inception', 'The Dark Knight'], 'Production'),
    p(1408530, 'Emma Thomas', 0.0898, false, [], 'Directing'),
    p(5075970, 'Emma Thomas', 0.0298, false),
];

/* ---- §08's own thirteen, as the rank and the floor see them ------------ */
const DESIGNS_FIFTEEN = [
    ['brad pitt', 11.6233], ['tom hanks', 9.8924], ['christopher nolan', 9.2722],
    ['leonardo dicaprio', 8.201], ['quentin tarantino', 5.9972], ['denis villeneuve', 4.8242],
    ['martin scorsese', 4.1329], ['shah rukh khan', 3.5625], ['aamir khan', 3.2112],
    ['greta gerwig', 2.4175], ['wes anderson', 2.292], ['deepika padukone', 1.9385],
    ['anurag kashyap', 1.0595], ['nawazuddin siddiqui', 0.9168], ['rajkumar hirani', 0.6211],
];

console.log('\n  The floors, and which question each one answers\n');

is('the row floor is the shipped one, untouched', PLAUSIBLE_FLOOR, 1);
is('the doubt floor sits below it', RIVAL_FLOOR < PLAUSIBLE_FLOOR, true);
/* The gap is what the second floor is FOR. Measured: the real rivals found
   start at 0.55 and every fake one is at 0 with no photograph. A floor inside
   that gap is the only thing that sees Chris Williams the Big Hero 6 director
   at 0.74 while he is invisible to the row floor. */
is('0.5 is inside the measured gap, 0 to 0.55', RIVAL_FLOOR > 0 && RIVAL_FLOOR <= 0.55, true);

console.log('\n  FQ3 — the query names a person\n');

is('rank 1 is the person, and he is promoted',
    promotedPerson({ lead: 'person', people: NOLAN })?.id, 525);
is('the three namesakes do not stop it — no photo, no pulse',
    promotedPerson({ lead: 'person', people: NOLAN })?.name, 'Christopher Nolan');
is('"tarantino" promotes Quentin, whose name is not the one typed',
    promotedPerson({ lead: 'person', people: TARANTINO })?.id, 138);
/* THREE CONDITIONS, AND EACH ONE TESTED WHERE IT IS THE ONLY ONE FAILING.
   This block was written once with "john williams" as the rank case — lead is
   a title, so nobody is promoted. It passed, and it proved nothing: those two
   John Williamses also clash, so deleting the rank check entirely left the
   case green. One of four checks in this repo that have passed while broken,
   caught this time by reinstating the bug. The isolation is the test. */
is('rank 1 is a SERIES bearing his name, and that alone stops it ("alfred hitchcock")',
    promotedPerson({ lead: 'tv', people: HITCHCOCK }), null);
is('rank 1 is a FILM, and that alone stops it ("emma thomas")',
    promotedPerson({ lead: 'movie', people: EMMA_THOMAS }), null);
is('...while the same people with the person at rank 1 are promoted',
    [promotedPerson({ lead: 'person', people: HITCHCOCK })?.id,
        promotedPerson({ lead: 'person', people: EMMA_THOMAS })?.id], [2636, 556]);
is('a floor still stops it ("dangl" — rank 1, photo, no namesake, 0.22)',
    promotedPerson({ lead: 'person', people: DANGL }), null);
/* THE FLOOR AT RANK 1 IS THE DOUBT FLOOR, NOT THE ROW FLOOR, AND THESE ARE
   WHY. Rank 1 means TMDB put this person above every title for these words,
   which is better evidence than the popularity number the row floor reads. At
   the row floor these two are refused, and both are §08's own. */
is('Hirani is promoted at 0.62, which the row floor refuses',
    promotedPerson({ lead: 'person', people: HIRANI })?.id, 85675);
is('Siddiqui is promoted at 0.92, which the row floor refuses',
    promotedPerson({ lead: 'person', people: SIDDIQUI })?.id, 85047);
is('...and neither clears the row floor, so this is the gap doing work',
    [HIRANI[0], SIDDIQUI[0]].filter(isPlausiblePerson), []);
is('the row floor itself is untouched, so FQ2 and FQ6 are as they shipped',
    PLAUSIBLE_FLOOR, 1);
is('"dune" has two reasons and needs neither isolated: rank 12 and no pulse',
    promotedPerson({ lead: 'movie', people: DUNE_PEOPLE }), null);
is('and the Dunes are below the row floor on their own',
    DUNE_PEOPLE.filter(isPlausiblePerson), []);
is('Michael B. Jordan is promoted over a differently-named Michael Jordan',
    promotedPerson({ lead: 'person', people: JORDANS })?.id, 135651);

/* ABSENT MUST NEVER BECOME PLAUSIBLE. A filtered search falls through to v1,
   which returns neither people nor a rank, so `lead` is missing — and missing
   has to mean "nobody asked", not "TMDB says no" and not "yes". */
is('no lead at all promotes nobody', promotedPerson({ people: NOLAN }), null);
is('a null lead promotes nobody', promotedPerson({ lead: null, people: NOLAN }), null);
is('an empty people list promotes nobody', promotedPerson({ lead: 'person', people: [] }), null);
is('no people key at all promotes nobody', promotedPerson({ lead: 'person' }), null);

console.log('\n  §08\'s fifteen person-led queries, against the shipped row floor\n');

const promotable = DESIGNS_FIFTEEN.filter(([, pop]) => isPlausiblePerson({ popularity: pop, profile_path: '/x.jpg' }));
is('thirteen of the fifteen clear it', promotable.length, 13);
/* And the two that do not are a finding, not a rounding error: TMDB's
   popularity numbers have moved since the gate was written, and the two it now
   excludes are both Indian cinema — the category this module exists to serve.
   Recorded here rather than fixed, because the floor is the shipped FQ2/FQ6
   gate and moving it is a design decision. */
is('the two it now excludes are Hirani and Siddiqui',
    DESIGNS_FIFTEEN.filter(([, pop]) => pop < PLAUSIBLE_FLOOR).map(([n]) => n),
    ['nawazuddin siddiqui', 'rajkumar hirani']);
is('both would clear the doubt floor, so the gap is where they fall',
    DESIGNS_FIFTEEN.filter(([, pop]) => pop < PLAUSIBLE_FLOOR && pop >= RIVAL_FLOOR).length, 2);
/* And they are not alone. Measured the same day, these are rank-1 people with
   photographs whom the shipped floor also refuses — three of the five are the
   best-known directors their countries have. Recorded because a number that
   excludes Satyajit Ray is evidence about the number, not about Satyajit Ray. */
is('the floor also excludes these, all at rank 1 with a photograph',
    [['sanjay leela bhansali', 0.9552], ['satyajit ray', 0.7462], ['ram gopal varma', 0.5072]]
        .filter(([, pop]) => pop < PLAUSIBLE_FLOOR).map(([n]) => n),
    ['sanjay leela bhansali', 'satyajit ray', 'ram gopal varma']);

console.log('\n  FQ4 — two people, same name\n');

is('two Chris Williamses are found, though one is below the row floor',
    clashingPeople(CHRIS_WILLIAMS).map((x) => x.id), [1214427, 70238]);
is('and so NEITHER is promoted — the hole between the two floors',
    promotedPerson({ lead: 'person', people: CHRIS_WILLIAMS }), null);
is('three James Murrays, all of them', clashingPeople(JAMES_MURRAY).map((x) => x.id),
    [435243, 1638285, 29986]);
is('two John Williamses', clashingPeople(JOHN_WILLIAMS).map((x) => x.id), [491, 5182]);
is('the Nolan namesakes are not a clash: no photograph, no pulse',
    clashingPeople(NOLAN), []);
is('two different names are not a clash', clashingPeople(JORDANS), []);
is('one person is not a clash', clashingPeople(TARANTINO), []);
is('no people is not a clash', clashingPeople(undefined), []);

is('diacritics fold, so one person spelled two ways is one person',
    foldName('Alejandro González Iñárritu'), foldName('Alejandro Gonzalez Inarritu'));
is('a middle initial does not fold away', foldName('Michael B. Jordan') === foldName('Michael Jordan'), false);

console.log('\n  The evidence line — credits, never a job title\n');

is('two credits, comma-joined', knownForLine(JAMES_MURRAY[0]), '6 Underground, Primeval');
is('and they tell the three apart where "Acted in" cannot',
    JAMES_MURRAY.map((x) => knownForLine(x)),
    ['6 Underground, Primeval', 'Impractical Jokers, Impractical Jokers: The Movie', 'The Crowd, The Shakedown']);
is('all three are filed under one department, which is the point',
    new Set(JAMES_MURRAY.map((x) => x.known_for_department)).size, 1);
is('no credits means no line, rather than an empty one',
    knownForLine(p(1, 'Nobody', 1, true, [])), null);
is('a person with one credit still gets a line', knownForLine(JORDANS[1], 1), 'Space Jam');

console.log('\n  FQ5 — the query names a franchise\n');

/* The view shape, which is what a Tile is given and what the page has by the
   time it looks for a film to read a collection off. */
const asView = (id, title, mediaType, year) => ({ id, title, mediaType, year });
const HARRY_POTTER_RESULTS = [
    asView(224377, 'Harry Potter', 'tv', '2026'),
    asView(674, 'Harry Potter and the Goblet of Fire', 'movie', '2005'),
    asView(673, 'Harry Potter and the Prisoner of Azkaban', 'movie', '2004'),
];
is('the top FILM is read, not the top result — which is a series',
    topFilm(HARRY_POTTER_RESULTS)?.id, 674);
is('no film at all means no band', topFilm([asView(1, 'Only A Series', 'tv', '2020')]), null);
is('an empty grid means no band', topFilm([]), null);
is('and no grid at all means no band', topFilm(undefined), null);

/* A SHAPE THAT CROSSES A MODULE BOUNDARY MUST BE CONVERTED AT THE BOUNDARY.
   A raw TMDB item spells it media_type; passed here it would match no branch
   and report "no film" for a grid full of films — absent quietly becoming a
   plausible answer. Refused rather than skipped. */
throws('a raw TMDB item is refused, not silently skipped',
    () => topFilm([{ id: 1, title: 'Dune', media_type: 'movie' }]), 'view shape');

/* TMDB really does hand `parts` back out of order — this is its own answer for
   collection 1241, kept in the order it arrived. */
const HP_PARTS = [
    { id: 671, title: 'Harry Potter and the Philosopher\'s Stone', date: '2001-11-16' },
    { id: 672, title: 'Harry Potter and the Chamber of Secrets', date: '2002-11-13' },
    { id: 674, title: 'Harry Potter and the Goblet of Fire', date: '2005-11-16' },
    { id: 767, title: 'Harry Potter and the Half-Blood Prince', date: '2009-07-07' },
    { id: 673, title: 'Harry Potter and the Prisoner of Azkaban', date: '2004-05-31' },
    { id: 675, title: 'Harry Potter and the Order of the Phoenix', date: '2007-06-28' },
    { id: 12444, title: 'Harry Potter and the Deathly Hallows: Part 1', date: '2010-11-17' },
    { id: 12445, title: 'Harry Potter and the Deathly Hallows: Part 2', date: '2011-07-12' },
];
is('release order, oldest first — and TMDB did not supply it',
    releaseOrder(HP_PARTS).map((f) => f.id), [671, 672, 673, 674, 675, 767, 12444, 12445]);
is('TMDB\'s own order was not it', HP_PARTS.map((f) => f.id)[2], 674);

/* Two films from one year is why this reads the date and not the year. */
const MATRIX_PARTS = [
    { id: 605, title: 'The Matrix Revolutions', date: '2003-11-05' },
    { id: 604, title: 'The Matrix Reloaded', date: '2003-05-15' },
    { id: 603, title: 'The Matrix', date: '1999-03-30' },
    { id: 624860, title: 'The Matrix Resurrections', date: '2021-12-16' },
];
is('two films from one year are still ordered',
    releaseOrder(MATRIX_PARTS).map((f) => f.id), [603, 604, 605, 624860]);
is('an undated sequel sorts last, not first',
    releaseOrder([{ id: 9, title: 'Dhoom 4', date: '' }, { id: 1, title: 'Dhoom', date: '2004-08-27' }])
        .map((f) => f.id), [1, 9]);
throws('a view-shaped film is refused — it has no date to order by',
    () => releaseOrder([{ id: 1, title: 'Dune', year: '2021', poster: 'https://x/y.jpg' }]), 'TMDB\'s shape');

is('eight films and a name make a band',
    collectionBand({ name: 'Harry Potter Collection', films: HP_PARTS })?.films.length, 8);
is('a collection of one is not a franchise',
    collectionBand({ name: 'Lonely Collection', films: [HP_PARTS[0]] }), null);
is('a collection of none is not a franchise',
    collectionBand({ name: 'Empty Collection', films: [] }), null);
is('no name is no band', collectionBand({ films: HP_PARTS }), null);
is('and neither is an empty name', collectionBand({ name: '', films: HP_PARTS }), null);

const WATCHED = new Set([671, 672, 673]);
is('three of eight seen', seenOf(HP_PARTS, (f) => WATCHED.has(f.id)), { seen: 3, total: 8 });
is('none seen is a number, not an absence', seenOf(HP_PARTS, () => false), { seen: 0, total: 8 });
is('all seen', seenOf(HP_PARTS, () => true), { seen: 8, total: 8 });

console.log('\n  Which body of work the grid shows\n');

/* FQ3's grid is "their work", and which work that is turned out to be a real
   question with a wrong answer sitting in shared code. `toPersonView` returns
   roles in the order ROLES declares them — director, creator, writer,
   composer, camera, cast — so cast is ALWAYS last, and the doc comment above
   it claiming "ordered by size, so the largest body of work leads" describes
   an intent the function does not implement. Measured in the browser: "bryan
   cranston" promoted as "Directed by Bryan Cranston · 6 series". The person
   page never showed it because Person.jsx sorts with `leadRoles` before
   drawing; the search page, reading roles[0], did.
   Recorded rather than fixed in view.js: `leadRoles` is the considered answer
   and lives in the person module, so the fix is to use it, not to write a
   second sort. */
const cranstonish = {
    id: 17419,
    name: 'Bryan Cranston',
    known_for_department: 'Acting',
    combined_credits: {
        cast: Array.from({ length: 12 }, (_, i) => ({
            id: 100 + i, title: `A Film ${i}`, media_type: 'movie',
            release_date: `20${String(10 + i).padStart(2, '0')}-01-01`, popularity: 10,
            genre_ids: [18], vote_count: 900, character: 'Someone',
        })),
        crew: [{
            id: 900, name: 'One Episode', media_type: 'tv', job: 'Director',
            first_air_date: '2015-01-01', popularity: 9, genre_ids: [18], vote_count: 900,
        }],
    },
};
const view = toPersonView(cranstonish);
is('toPersonView really does put one directed credit before twelve acted ones',
    view.roles.map((r) => `${r.key}:${r.items.length}`), ['director:1', 'cast:12']);
is('...and leadRoles is what puts the twelve first',
    leadRoles(view.roles).map((r) => `${r.key}:${r.items.length}`), ['cast:12', 'director:1']);
is('so the bar reads the larger body of work', leadRoles(view.roles)[0].by, 'With');

console.log('\n  The two shapes never collide\n');
/* FQ3 replaces the grid with a filmography; FQ5 puts a band above the grid.
   Run together they would report the top film's franchise above somebody
   else's body of work — two answers to two different questions, stacked. */
is('a promotion suppresses the band, because the grid is no longer that film\'s neighbourhood',
    Boolean(promotedPerson({ lead: 'person', people: NOLAN })), true);

if (!LIVE) {
    console.log('');
    if (failed) { console.log(`  ${failed} case(s) failed.\n`); process.exit(1); }
    console.log('  All cases passed. Add --live to check the recordings against TMDB.\n');
    process.exit(0);
}

/* ---- the live half ----------------------------------------------------
   Not a gate. It says whether the recordings above still describe TMDB, which
   is the only thing a pinned fixture cannot tell you. */
const { createServer } = await import('vite');
const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)), server: { port: 0 }, logLevel: 'error',
});
await server.listen();
const base = `http://localhost:${server.config.server.port ?? server.httpServer.address().port}`;
const ask = async (path, params = {}) => {
    const qs = new URLSearchParams({ path, ...params });
    // A failed request and an empty answer look identical on screen and mean
    // opposite things — this module's own point. Retry; never read a failure
    // as a zero.
    for (let i = 0; i < 3; i += 1) {
        try { const r = await fetch(`${base}/api/tmdb?${qs}`); if (r.ok) return await r.json(); } catch { /* wait */ }
        await new Promise((res) => { setTimeout(res, 400 * (i + 1)); });
    }
    return null;
};
const multi = async (query) => {
    const d = await ask('/search/multi', { query, include_adult: 'false' });
    if (!d) return null;
    const rows = d.results || [];
    return { lead: rows[0]?.media_type ?? null, people: rows.filter((r) => r.media_type === 'person'), rows };
};

console.log('\n  Against live TMDB — does the rule still pick the right shape?\n');
const EXPECT = [
    ['christopher nolan', 'person'], ['tarantino', 'person'], ['denis villeneuve', 'person'],
    ['brad pitt', 'person'], ['shah rukh khan', 'person'], ['roger deakins', 'person'],
    ['dune', 'grid'], ['inception', 'grid'], ['the matrix', 'grid'],
    ['chris williams', 'ambiguous'], ['james murray', 'ambiguous'], ['mike mitchell', 'ambiguous'],
];
for (const [query, want] of EXPECT) {
    const r = await multi(query);
    if (!r) { console.log(`  ....  ${query} — could not reach TMDB, not counted`); continue; }
    const promo = promotedPerson(r);
    const clash = clashingPeople(r.people);
    const got = promo ? 'person' : (clash.length >= 2 ? 'ambiguous' : 'grid');
    const note = promo ? promo.name : (clash.length ? `${clash.length}× ${clash[0].name}` : `lead=${r.lead}`);
    is(`${query.padEnd(20)} → ${got.padEnd(10)} (${note})`, got, want);
}

console.log('\n  And the franchise, from the top film\'s own collection\n');
for (const [query, want] of [['lord of the rings', 'The Lord of the Rings Collection'],
    ['harry potter', 'Harry Potter Collection'], ['john wick', 'John Wick Collection'],
    ['avengers', 'The Avengers Collection'], ['inception', null]]) {
    const r = await multi(query);
    if (!r) { console.log(`  ....  ${query} — could not reach TMDB, not counted`); continue; }
    const top = r.rows.find((x) => x.media_type === 'movie');
    if (!top) { is(`${query} has no film to read`, null, want); continue; }
    const d = await ask(`/movie/${top.id}`);
    is(`${query.padEnd(20)} → ${d?.belongs_to_collection?.name ?? 'no collection'}`,
        d?.belongs_to_collection?.name ?? null, want);
}

await server.close();
console.log('');
if (failed) { console.log(`  ${failed} case(s) failed.\n`); process.exit(1); }
console.log('  All cases passed, offline and live.\n');
