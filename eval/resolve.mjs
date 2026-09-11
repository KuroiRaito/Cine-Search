// Prepares queries.json for labelling.  npm run eval:resolve
//
// 1. known_item  -> auto-resolve `intended` to TMDB ids.
//    The lookup uses the INTENDED TITLE, never the user's query string. Resolving
//    "intersteller" by running it through search would make the eval circular:
//    the answer key would be whatever the system already returns.
//
// 2. open_set    -> build a candidate pool for human judgement (eval/candidates.json).
//    Pooled from several retrievers, all deliberately WIDER than the baseline path,
//    so the labeller can mark things the current app fails to return. This is the
//    standard IR pooling approach to building judgements.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
import { detectMode, getMode, tmdbUrl } from './lib/tmdb-http.mjs';

let failures = 0;
const api = async (path, params = {}) => {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(tmdbUrl(path, params));
            if (res.ok) return res.json();
            if (res.status === 429) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
            failures++;
            if (failures <= 3) console.error(`\n  ${res.status} on ${path}`);
            return {};
        } catch (e) {
            if (attempt === 2) { failures++; return {}; }
            await new Promise(r => setTimeout(r, 500));
        }
    }
    return {};
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const JUNK_GENRES = new Set([10767, 10763, 10764]); // Talk, News, Reality
const isJunk = (it) => (it.genre_ids || []).some(g => JUNK_GENRES.has(g));

const shape = (it, source = '?') => ({
    source,
    key: `${it.media_type || (it.title ? 'movie' : 'tv')}:${it.id}`,
    id: it.id,
    media_type: it.media_type || (it.title ? 'movie' : 'tv'),
    title: it.title || it.name,
    year: (it.release_date || it.first_air_date || '').slice(0, 4) || '—',
    poster: it.poster_path,
    overview: (it.overview || '').slice(0, 180),
    popularity: it.popularity,
    vote: it.vote_average,
});

// Candidate-generation hints only. These do NOT decide relevance - the human does.
const GENRE_HINTS = {
    comedy: 35, funny: 35, light: 35, laugh: 35, sitcom: 35, eating: 35, background: 35,
    scary: 27, horror: 27, thriller: 53, psychological: 53, twisty: 53, intense: 53,
    sad: 18, cry: 18, drama: 18, emotional: 18, dramatic: 18, tearjerker: 18,
    'feel good': 35, uplifting: 18, inspirational: 18, comfort: 18, warm: 18, cosy: 18, cozy: 18,
    war: 10752, romantic: 10749, romance: 10749, breakup: 10749,
    kids: 10751, family: 10751, parents: 10751, children: 10751, bacchon: 10751, seasonal: 10751,
    action: 28, documentary: 99, nature: 99, animation: 16, adventure: 12, jungle: 12,
    chess: 18, prodigy: 18, 'time loop': 878, 'sci fi': 878, crowd: 28,
};
const LANG_HINTS = {
    hindi: 'hi', bollywood: 'hi', indian: 'hi', tamil: 'ta', padam: 'ta',
    telugu: 'te', south: 'te', malayalam: 'ml', kannada: 'kn',
};

function hintsFor(q) {
    const t = norm(q.query + ' ' + q.intended);
    const genres = [...new Set(Object.entries(GENRE_HINTS).filter(([w]) => t.includes(w)).map(([, g]) => g))];
    const lang = Object.entries(LANG_HINTS).find(([w]) => t.includes(w))?.[1];
    return { genres, lang };
}

async function resolveKnownItem(q) {
    // "The Family Man (2019 Indian series)" -> title, year, tv?
    const m = q.intended.match(/^(.*?)\s*\((\d{4})?([^)]*)\)\s*$/);
    const title = (m ? m[1] : q.intended).trim();
    const year = m?.[2];
    const isTV = /series/i.test(q.intended);

    const hits = [];
    for (const type of isTV ? ['tv', 'movie'] : ['movie', 'tv']) {
        const params = { query: title };
        if (year) params[type === 'movie' ? 'year' : 'first_air_date_year'] = year;
        const r = await api(`/search/${type}`, params);
        hits.push(...(r.results || []).map(x => shape({ ...x, media_type: type })));
    }
    const want = norm(title);
    const exact = hits.filter(h => norm(h.title) === want);
    const pool = exact.length ? exact : hits.filter(h => norm(h.title).includes(want));
    const best = year ? (pool.find(h => h.year === year) || pool[0]) : pool[0];
    return { expected: best ? [best.key] : [], resolved: best || null, alternatives: pool.slice(0, 5) };
}

// Intent words that describe HOW to search, not WHAT to find. They wreck a
// title/person lookup, so strip them before hitting the entity endpoints.
const STOP = /\b(movies?|films?|picture|padam|series|show|shows|all parts|in order|trilogy|saga|by|with|the best|best|top|good|acchi|koi|ki|ka|ke|mein|wali|something|watch|for a|to)\b/gi;
const clean = (s) => s.replace(STOP, ' ').replace(/\s+/g, ' ').trim();

async function poolCandidates(q) {
    const pool = new Map();
    // Provenance matters: a title match is better evidence than a genre browse.
    // Recorded per candidate so the labelling UI can show WHY each one is here.
    const RANK = { title: 0, person: 1, collection: 2, discover: 3 };
    const add = (items = [], source = 'discover') => items.forEach(it => {
        const s = shape(it, source);
        if (!s.title || !s.id || isJunk(it)) return;
        const prev = pool.get(s.key);
        if (!prev || RANK[source] < RANK[prev.source]) pool.set(s.key, s);
    });

    const raw = q.query;
    const cq = clean(raw) || raw;

    // 1. Title lookups, raw AND cleaned.
    const [multiRaw, mv, tv] = await Promise.all([
        api('/search/multi', { query: raw }),
        api('/search/movie', { query: cq }),
        api('/search/tv', { query: cq }),
    ]);
    add((multiRaw.results || []).filter(r => r.media_type !== 'person'), 'title');
    add((mv.results || []).slice(0, 12).map(x => ({ ...x, media_type: 'movie' })), 'title');
    add((tv.results || []).slice(0, 8).map(x => ({ ...x, media_type: 'tv' })), 'title');

    // 2. Person route on the CLEANED query. The baseline app never calls this,
    //    so it surfaces correct answers the current system structurally cannot return.
    const ppl = await api('/search/person', { query: cq });
    for (const p of (ppl.results || []).slice(0, 2)) {
        if ((p.popularity || 0) < 1) continue;
        const credits = await api(`/person/${p.id}/combined_credits`);
        const cast = (credits.cast || []).filter(c => !isJunk(c))
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);
        const directed = (credits.crew || []).filter(c => c.job === 'Director' && !isJunk(c))
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);
        add(p.known_for_department === 'Directing' ? [...directed, ...cast] : [...cast, ...directed], 'person');
    }

    // 2b. Seed from `intended` too. That text is my written statement of what the
    //     user meant - it generates candidates, it never decides relevance. Without
    //     it, descriptive queries ("salman bhai ki movie") pool almost nothing.
    const seed = clean(String(q.intended || '')
        .replace(/^films?\s+(starring|directed by|by)\s+/i, '')
        .replace(/\b(films?|movies?|adaptations?|series)\b/gi, ' '));
    if (seed && seed.toLowerCase() !== cq.toLowerCase()) {
        const [sp, sm] = await Promise.all([
            api('/search/person', { query: seed }),
            api('/search/movie', { query: seed }),
        ]);
        for (const p of (sp.results || []).slice(0, 1)) {
            if ((p.popularity || 0) < 1) continue;
            const cr = await api(`/person/${p.id}/combined_credits`);
            const cast = (cr.cast || []).filter(c => !isJunk(c)).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);
            const dir = (cr.crew || []).filter(c => c.job === 'Director' && !isJunk(c)).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);
            add(p.known_for_department === 'Directing' ? [...dir, ...cast] : [...cast, ...dir], 'person');
        }
        add((sm.results || []).slice(0, 10).map(x => ({ ...x, media_type: 'movie' })), 'title');
    }

    // 3. Collection route for franchise queries.
    const coll = await api('/search/collection', { query: cq });
    for (const c of (coll.results || []).slice(0, 2)) {
        const full = await api(`/collection/${c.id}`);
        add((full.parts || []).map(x => ({ ...x, media_type: 'movie' })), 'collection');
    }

    // 4. Discover — ONLY when we have a real steer. An unsteered discover call
    //    returns the same generic blockbusters for every query and poisons the pool.
    let { genres, lang } = hintsFor(q);
    const dparams = { sort_by: 'vote_count.desc', 'vote_count.gte': 300 };
    let steered = false;
    if (genres.length) { dparams.with_genres = genres.join('|'); steered = true; }
    if (lang) { dparams.with_original_language = lang; steered = true; }

    const yr = raw.match(/\b(19|20)\d{2}\b/);
    if (/\b90s\b/i.test(raw)) { dparams['primary_release_date.gte'] = '1990-01-01'; dparams['primary_release_date.lte'] = '1999-12-31'; steered = true; }
    else if (/this year/i.test(raw)) { dparams.primary_release_year = String(new Date().getFullYear()); steered = true; }
    else if (yr) { dparams.primary_release_year = yr[0]; steered = true; }
    if (/under (2|two) hours/i.test(raw)) { dparams['with_runtime.lte'] = 120; steered = true; }
    const rt = raw.match(/rated above (\d+(?:\.\d+)?)/i);
    if (rt) { dparams['vote_average.gte'] = rt[1]; dparams['vote_count.gte'] = 150; steered = true; }

    if (steered) {
        const d = await api('/discover/movie', dparams);
        add((d.results || []).slice(0, 25).map(x => ({ ...x, media_type: 'movie' })), 'discover');
        if (dparams.with_genres && !lang) {
            const dtv = await api('/discover/tv', { ...dparams, 'vote_count.gte': 100 });
            add((dtv.results || []).slice(0, 10).map(x => ({ ...x, media_type: 'tv' })), 'discover');
        }
    }

    // Last resort for pools that are still too thin to label meaningfully.
    if (pool.size < 12 && (genres.length || lang)) {
        const loose = { sort_by: 'vote_count.desc', 'vote_count.gte': 50 };
        if (genres.length) loose.with_genres = genres.join('|');
        if (lang) loose.with_original_language = lang;
        const l = await api('/discover/movie', loose);
        add((l.results || []).slice(0, 25).map(x => ({ ...x, media_type: 'movie' })), 'discover');
    }

    // Strongest evidence first, then popularity within each tier.
    return [...pool.values()]
        .sort((a, b) => RANK[a.source] - RANK[b.source] || (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 45);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    await detectMode();
    console.log(`\n  tmdb transport: ${getMode()}${getMode() === 'proxy' ? ' (local key invalid - using deployed /api/tmdb)' : ''}`);
    const file = join(HERE, 'queries.json');
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const candidates = {};
    let auto = 0, unresolved = [];

    for (const [i, q] of data.queries.entries()) {
        if (i % 10 === 0 || i === data.queries.length - 1) process.stdout.write(`\r  resolving ${i + 1}/${data.queries.length}…   `);
        if (q.answer_type === 'known_item') {
            const { expected, resolved, alternatives } = await resolveKnownItem(q);
            q.expected = expected;
            q.labelled_by = expected.length ? 'auto' : null;
            if (expected.length) auto++; else unresolved.push(q);
            candidates[q.id] = alternatives;
            q.notes = resolved ? `auto-matched: ${resolved.title} (${resolved.year})` : 'UNRESOLVED - needs manual label';
        } else if (q.answer_type === 'open_set') {
            candidates[q.id] = await poolCandidates(q);
        }
        await sleep(30);
    }
    process.stdout.write('\r'.padEnd(40) + '\r');

    writeFileSync(file, JSON.stringify(data, null, 2));
    writeFileSync(join(HERE, 'candidates.json'), JSON.stringify(candidates, null, 2));

    const open = data.queries.filter(q => q.answer_type === 'open_set');
    console.log(`\n  auto-keyed (known-item): ${auto}/${data.queries.filter(q => q.answer_type === 'known_item').length}`);
    if (unresolved.length) {
        console.log(`  \x1b[33mneeds manual check: ${unresolved.length}\x1b[0m`);
        unresolved.forEach(q => console.log(`    ${q.id}  "${q.query}"  -> ${q.intended}`));
    }
    console.log(`  candidate pools built for ${open.length} open-set queries`);
    console.log(`  avg pool size: ${Math.round(open.reduce((a, q) => a + (candidates[q.id]?.length || 0), 0) / open.length)}`);
    if (failures) console.log(`  \x1b[33m${failures} API failures\x1b[0m`);
    console.log(`\n  next: npm run eval:label\n`);
}
main().catch(e => { console.error(e); process.exit(1); });
