/**
 * A pasted URL is a destination, not a search. FQ18.
 *
 * Somebody who pastes a TMDB or IMDb link has already found the title. Running
 * it through the search index asks the wrong question and answers it with
 * nothing: the index holds names, and `https://www.themoviedb.org/movie/27205`
 * is not a name. The link already carries the answer — in TMDB's case the whole
 * answer, media type and id both, with no request needed at all.
 *
 * Returns null for anything that is not a link to one title. Not a partial
 * object, not a `{ kind: 'unknown' }` — a caller that reads `.id` off a shape
 * meaning "this was a search" is the absent-becomes-plausible class, and this
 * module's whole job is to be sure.
 */

/* Both accept a bare host, because a paste from a browser's address bar often
   loses the scheme, and both accept the slug TMDB appends to its ids
   (`/movie/27205-inception`) by simply not caring what follows the digits. */
const TMDB = /^(?:https?:\/\/)?(?:www\.)?themoviedb\.org\/(movie|tv)\/(\d+)(?:[/?#-]|$)/i;
const IMDB = /^(?:https?:\/\/)?(?:www\.|m\.)?imdb\.com\/title\/(tt\d{6,})(?:[/?#]|$)/i;

export function destinationOf(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;

    const t = s.match(TMDB);
    /* TMDB's own URL is the only case that needs no network: the media type
       and the id are both in the path, and they are the two things the title
       route takes. */
    if (t) return { kind: 'tmdb', mediaType: t[1].toLowerCase(), id: Number(t[2]) };

    const i = s.match(IMDB);
    /* IMDb's id is not TMDB's, so this one costs a lookup. The id is carried
       as typed — it is a string with meaningful leading zeros, and Number()
       would turn tt0133093 into something that matches nothing. */
    if (i) return { kind: 'imdb', imdbId: i[1] };

    return null;
}
