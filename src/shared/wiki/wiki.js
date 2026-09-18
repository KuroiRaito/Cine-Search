/**
 * Wikipedia, in two public calls and no key.
 *
 * §04 of the title design. TMDB already hands us the key: external_ids returns
 * a wikidata_id for films, series and people, Wikidata resolves it to the
 * article in any language, and Wikipedia's summary endpoint returns the lead.
 *
 *   TMDB      /movie/693134/external_ids  ->  wikidata_id: Q109228991
 *   Wikidata  wbgetentities?ids=Q109228991 -> enwiki: "Dune: Part Two"
 *   Wikipedia /page/summary/Dune:_Part_Two -> description, extract, url
 *
 * external_ids is already in the title and person requests, so the TMDB half
 * costs nothing.
 *
 * ONLY the lead extract, ever. /page/summary/ returns the article's opening
 * paragraph, which is safe by convention. The article body carries a full plot
 * summary with every twist in it, and a film tracker that spoils the film is
 * worse than one with no background at all. If this ever needs extending,
 * extend it by more of the lead and never by another section.
 *
 * An enhancement, never a dependency. A Wikipedia article is absent more often
 * than it is present — for series, two times in three — so every caller must be
 * complete without it. This resolves to null rather than throwing, and nothing
 * anywhere says "no Wikipedia article": a hole where an enhancement would have
 * been is worse than no enhancement.
 */

const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

/* English, because that is the only copy the product is written in. Wikidata
   returns sitelinks for every language it has — 54 for a film, 61 for a person
   — so a localised build is a one-line change here rather than a project. */
const WIKI = 'enwiki';

/* Keyed by wikidata id, and a miss is cached too. Two thirds of series have no
   article, and re-asking on every mount would spend two requests to be told
   the same nothing. */
const cache = new Map();

async function json(url, signal) {
    const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
}

async function lookup(id, signal) {
    const params = new URLSearchParams({
        action: 'wbgetentities',
        ids: id,
        props: 'sitelinks',
        sitefilter: WIKI,
        format: 'json',
        origin: '*',
    });
    const data = await json(`${WIKIDATA}?${params}`, signal);
    const title = data?.entities?.[id]?.sitelinks?.[WIKI]?.title;
    if (!title) return null;

    const page = await json(SUMMARY + encodeURIComponent(title.replace(/ /g, '_')), signal);
    const description = page?.description?.trim() || null;
    const extract = page?.extract?.trim() || null;
    const url = page?.content_urls?.desktop?.page || null;

    // A record with neither of the two things worth having is a miss.
    return description || extract ? { description, extract, url, title } : null;
}

/**
 * Resolve a wikidata id to { description, extract, url, title }, or null.
 *
 * Never rejects. A caller that has to try/catch an enhancement will eventually
 * forget to, and then a Wikipedia outage takes down a film page.
 */
export function wikiSummary(id, { signal } = {}) {
    if (!id) return Promise.resolve(null);
    if (cache.has(id)) return Promise.resolve(cache.get(id));
    return lookup(id, signal)
        .then((r) => {
            cache.set(id, r);
            return r;
        })
        .catch(() => {
            // An aborted request is not an answer, so it is not remembered.
            if (!signal?.aborted) cache.set(id, null);
            return null;
        });
}
