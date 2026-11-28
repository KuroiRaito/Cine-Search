#!/usr/bin/env node
/**
 * Recommended by: the four states, and the one each of them answers.
 *
 *   npm run library
 *
 * §04 of the library design, L26–L29. The feature is four behaviours that look
 * like one, and three of them are invisible until somebody has typed a name
 * into the editor — which makes them exactly the kind of thing nobody stages by
 * hand before a release. L29 in particular ("the last name cleared") would take
 * a sign-in, two writes and a delete to reproduce in a browser.
 *
 * Node rather than a browser, because all of it is pure: find decides what
 * matches, sort decides what is offered and in what order, and the screen
 * renders what they return. Splitting them this way is what makes it possible
 * to check a library whose last recommender has just been removed without a
 * session, a network, or a single click.
 */
import { rowMatches, nameMatches, recommenderSummary, isFinding } from '../src/modules/library/find.js';
import { availableSorts, applySort, SORTS } from '../src/modules/library/sort.js';

let failed = 0;
const is = (label, got, want) => {
    const ok = got === want;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) console.log(`          want ${JSON.stringify(want)}\n           got ${JSON.stringify(got)}`);
};

/* Rows in the shape shapeRow returns, which is the shape the screen filters and
   sorts. Titles are real: TMDB has all five, and three of them appear in the
   design document's own L26 and L27 frames. */
const row = (title, o = {}) => ({
    key: `movie-${title}`, id: title, mediaType: 'movie', title,
    status: 'want_to_watch', rating: null, year: 2023, seen: 0, total: 0,
    recommendedBy: null, updatedAt: '2026-01-01', addedAt: '2026-01-01', ...o,
});

const library = [
    row('Past Lives', { recommendedBy: 'Priya', status: 'watched' }),
    row('Aftersun', { recommendedBy: 'Priya' }),
    row('Portrait of a Lady on Fire', { recommendedBy: 'Priya', status: 'watched', rating: 9 }),
    row('The Zone of Interest'),
    row('Anatomy of a Fall'),
];

/* ---- L27  find matches a name ----------------------------------------- */

console.log('\n  L26–L29  recommended by\n');

is('L27 a name finds the rows it is on',
    library.filter((r) => rowMatches(r, 'priya')).map((r) => r.title).join(', '),
    'Past Lives, Aftersun, Portrait of a Lady on Fire');

is('L27 a title still finds itself',
    library.filter((r) => rowMatches(r, 'zone')).map((r) => r.title).join(', '),
    'The Zone of Interest');

is('L27 and a name that is nobody finds nothing',
    library.filter((r) => rowMatches(r, 'sandeep')).length, 0);

/* The count is the payoff: not what did she recommend, but am I behind. */
const priya = recommenderSummary(library, 'priya');
is('L27 the count is of her rows, not of this shelf', priya.total, 3);
is('L27 and says how many are watched', priya.watched, 2);
is('L27 the name is spelled as it was typed, not as it was searched', priya.name, 'Priya');

/* Absent stays absent. Two people whose names both begin "Priya" would
   otherwise be given one confident number that is wrong for both. */
const twoPriyas = [...library, row('Tár', { recommendedBy: 'Priyanka' })];
is('L27 an ambiguous name is given no count at all',
    recommenderSummary(twoPriyas, 'priya'), null);
is('L27 but the fuller name resolves it',
    recommenderSummary(twoPriyas, 'priyanka').total, 1);
is('L27 a term matching no name is given no count',
    recommenderSummary(library, 'zone'), null);
is('L27 an empty box is not a find',
    isFinding('   '), false);

/* The accent-folding that titles already had has to reach names too: somebody
   who typed "Chloé" must be findable by "chloe". */
is('L27 a name is folded like a title',
    nameMatches('Chloé', 'chloe'), true);

/* ---- L26  a row that has one ------------------------------------------ */

is('L26 a row with a name carries it',
    library[0].recommendedBy, 'Priya');
is('L26 a row without one carries nothing, not an empty string',
    library[3].recommendedBy, null);

/* ---- L28 / L29  the From section -------------------------------------- */

const offered = (rows) => availableSorts(rows).map((s) => s.key).join(' ');

is('L28 the From section appears once a name exists',
    offered(library).includes('recommender'), true);

/* L29 is L28 asked backwards, and is the case that would never be staged by
   hand: the last name is cleared and the section has to go, not grey out. */
const noNames = library.map((r) => ({ ...r, recommendedBy: null }));
is('L29 and disappears with the last name',
    offered(noNames).includes('recommender'), false);
is('L29 leaving the sheet exactly as it was before anyone typed a name',
    offered(noNames), offered(library.map((r) => ({ ...r, recommendedBy: null }))));

is('L28 the option is named for the word the row uses',
    SORTS.find((s) => s.key === 'recommender').label, 'From');

/* Names read A–Z, and a row nobody recommended sits below every row somebody
   did — "nulls last" in a sort that is otherwise ascending. */
is('L28 sorts by name, A–Z, with the unrecommended last',
    applySort(twoPriyas, 'recommender').map((r) => r.recommendedBy ?? '—').join(' '),
    'Priya Priya Priya Priyanka — —');

/* ---- and the thing the whole feature is for --------------------------- */

console.log(`\n  What the find bar answers:\n    "${priya.total} recommended by ${priya.name} · ${priya.watched} watched"`);
is('  which is the question somebody actually has',
    `${priya.total - priya.watched} of ${priya.name}'s are still unwatched`,
    "1 of Priya's are still unwatched");

console.log(failed ? `\n  ${failed} failed.\n` : '\n  All cases pass.\n');
process.exit(failed ? 1 : 0);
