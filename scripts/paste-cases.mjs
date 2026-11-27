#!/usr/bin/env node
/**
 * What the box does with what you give it: a year, a link, or a finished series.
 *
 *   npm run paste
 *
 * FQ17, FQ18 and L21. Three features that share a shape — each one reads
 * something a person pasted or ticked and decides what it *is* before deciding
 * what to do about it. Every bug this repo has named under "absent must never
 * become plausible" lives in exactly that decision, so it is the part worth
 * holding still.
 *
 * Node rather than a browser, because the deciding is pure. splitYear and
 * destinationOf take a string and return a shape; finished.js takes a key and a
 * store. The page renders what they return, and the rest of the gate stack
 * already proves the page renders.
 */
import { splitYear, rungs } from '../src/modules/search/normalise.js';
import { destinationOf } from '../src/modules/search/destination.js';

/* finished.js reads localStorage at import time of its functions, not of the
   module, so a stub installed here is the store it sees. */
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
const { finishKey, alreadyAsked, rememberAsked } = await import('../src/modules/title/finished.js');

let failed = 0;
const is = (label, got, want) => {
    const ok = got === want;
    if (!ok) failed += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
    if (!ok) console.log(`          want ${JSON.stringify(want)}\n           got ${JSON.stringify(got)}`);
};
const shape = (o) => (o === null ? 'null' : JSON.stringify(o));

/* ---- FQ17  a title pasted with its year ------------------------------- */

console.log('\n  FQ17 · FQ18 · L21   a year, a link, a finished series\n');

is('FQ17 a parenthesised year splits off the name',
    shape(splitYear('Inception (2010)')), '{"query":"Inception","year":2010}');
is('FQ17 and a bare trailing year does too',
    shape(splitYear('Inception 2010')), '{"query":"Inception","year":2010}');
is('FQ17 a bracketed one as well',
    shape(splitYear('Inception [2010]')), '{"query":"Inception","year":2010}');

/* The case the code comment calls out by name. A four-digit number is only a
   year if a film could have come out in it — and a title is not a year even
   when it looks like one. */
is('FQ17 Blade Runner 2049 is a title, not a film from 2049',
    shape(splitYear('Blade Runner 2049')), '{"query":"Blade Runner 2049","year":null}');
is('FQ17 and nothing was released before Roundhay Garden Scene',
    shape(splitYear('Something 1600')), '{"query":"Something 1600","year":null}');
is('FQ17 a year with no name is not a split',
    shape(splitYear('2010')), '{"query":"2010","year":null}');

/* The ladder has to carry the year, not just strip it. This is the whole of
   what was broken: rung 1b computed the year and then searched without it. */
const ladder = rungs('Inception (2010)');
const oneB = ladder.find((a) => a.rung === '1b');
is('FQ17 rung 1b exists for a pasted year', Boolean(oneB), true);
is('FQ17 and carries the year, not only the name',
    `${oneB.query}|${oneB.year}`, 'inception|2010');
/* The box shows this one, so it keeps the casing that was typed — answering
   `Inception (2010)` with `inception` corrects somebody's own paste. */
is('FQ17 and the name it shows back keeps the typed casing',
    oneB.shown, 'Inception');
is('FQ17 even once an intent word has been removed from the middle',
    rungs('Inception movie 2010').find((a) => a.rung === '1b').shown, 'Inception');
/* And the case where the casing cannot be recovered at all: stripIntent takes
   a word out of the middle, so the folded name is no longer a substring of
   what was typed. The fallback has to be the folded name — slicing from an
   indexOf of -1 would hand the box the last character of the query. */
is('FQ17 a name the original no longer contains falls back, it does not slice from -1',
    rungs('The movie Shawshank 1994').find((a) => a.rung === '1b').shown,
    'the shawshank');
is('FQ17 rung 0 is still the words as typed',
    ladder[0].query, 'Inception (2010)');

/* ---- FQ18  a pasted URL ----------------------------------------------- */

is('FQ18 a TMDB film URL needs no lookup at all',
    shape(destinationOf('https://www.themoviedb.org/movie/27205-inception')),
    '{"kind":"tmdb","mediaType":"movie","id":27205}');
is('FQ18 a TMDB series URL knows it is a series',
    shape(destinationOf('https://www.themoviedb.org/tv/1396')),
    '{"kind":"tmdb","mediaType":"tv","id":1396}');
is('FQ18 a paste that lost its scheme still resolves',
    shape(destinationOf('themoviedb.org/movie/27205')),
    '{"kind":"tmdb","mediaType":"movie","id":27205}');

is('FQ18 an IMDb URL keeps the id as a string',
    shape(destinationOf('https://www.imdb.com/title/tt0133093/')),
    '{"kind":"imdb","imdbId":"tt0133093"}');
is('FQ18 and the leading zeros survive, because Number() would eat them',
    destinationOf('https://m.imdb.com/title/tt0133093/').imdbId, 'tt0133093');

/* Absent stays absent. A caller reading .id off "this was a search" is the
   class this module exists to make impossible. */
is('FQ18 an ordinary query is not a destination',
    destinationOf('inception'), null);
is('FQ18 nor is a URL to something that is not a title',
    destinationOf('https://www.themoviedb.org/person/6193'), null);
is('FQ18 nor an IMDb name page',
    destinationOf('https://www.imdb.com/name/nm0000138/'), null);
is('FQ18 nor somebody else’s site that happens to say movie',
    destinationOf('https://example.com/movie/27205'), null);
is('FQ18 nor an empty box',
    destinationOf('   '), null);
is('FQ18 nor undefined',
    destinationOf(undefined), null);

/* ---- L21  asked once, then never again -------------------------------- */

const bear = finishKey('tv', 136315);
const sev = finishKey('tv', 95396);
is('L21 nobody has been asked yet', alreadyAsked(bear), false);
rememberAsked(bear);
is('L21 and once asked, stays asked', alreadyAsked(bear), true);
is('L21 finishing one series says nothing about another', alreadyAsked(sev), false);
is('L21 the key separates the two media types',
    finishKey('movie', 136315) === finishKey('tv', 136315), false);

/* A corrupt store must read as "nobody has been asked". Asking once more is a
   small cost; throwing on a page that was only trying to be helpful is not. */
store.set('cine_finish_asked', '{not json');
is('L21 a corrupt store asks again rather than crashing', alreadyAsked(bear), false);
/* Asked of a key nothing could ever have written, because a guard that returns
   the wrong non-empty set still answers false for the one key under test. */
is('L21 and the corrupt read yields nothing at all, not something else',
    alreadyAsked('x'), false);
store.set('cine_finish_asked', '"a string, not a list"');
is('L21 a valid-but-wrong shape does the same', alreadyAsked(bear), false);
is('L21 and yields nothing at all there too', alreadyAsked('x'), false);

console.log(failed ? `\n  ${failed} failed.\n` : '\n  All cases pass.\n');
process.exit(failed ? 1 : 0);
