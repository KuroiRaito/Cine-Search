// Local labelling server.  npm run eval:label  ->  http://localhost:5180
// Writes judgements straight back into eval/queries.json (auto-saves per query).

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectMode, tmdbUrl } from './lib/tmdb-http.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const QFILE = join(HERE, 'queries.json');
const CFILE = join(HERE, 'candidates.json');
const PORT = 5180;

const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const send = (res, code, body, type = 'application/json') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

await detectMode();

createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/') {
        return send(res, 200, readFileSync(join(HERE, 'label.html'), 'utf8'), 'text/html; charset=utf-8');
    }

    if (url.pathname === '/api/data') {
        const data = read(QFILE);
        const candidates = existsSync(CFILE) ? read(CFILE) : {};
        // Only surface what actually needs a human: open-set queries, plus any
        // known-item the auto-resolver could not match.
        const needs = data.queries.filter(q =>
            q.answer_type === 'open_set' ||
            (q.answer_type === 'known_item' && q.labelled_by !== 'auto'));
        return send(res, 200, { queries: needs, candidates, total: data.queries.length });
    }

    if (url.pathname === '/api/label' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const { id, expected, notes, answer_type } = JSON.parse(body);
        const data = read(QFILE);
        const q = data.queries.find(x => x.id === id);
        if (!q) return send(res, 404, { error: 'unknown query' });
        q.expected = expected;
        q.notes = notes ?? q.notes;
        if (answer_type) q.answer_type = answer_type;
        q.labelled_by = 'human';
        writeFileSync(QFILE, JSON.stringify(data, null, 2));
        const done = data.queries.filter(x => x.labelled_by).length;
        return send(res, 200, { ok: true, done, total: data.queries.length });
    }

    if (url.pathname === '/api/search') {
        const q = url.searchParams.get('q');
        if (!q) return send(res, 200, { results: [] });
        const r = await fetch(tmdbUrl('/search/multi', { query: q }));
        const j = await r.json();
        const results = (j.results || [])
            .filter(x => x.media_type !== 'person')
            .map(x => ({
                key: `${x.media_type}:${x.id}`, id: x.id, media_type: x.media_type,
                title: x.title || x.name,
                year: (x.release_date || x.first_air_date || '').slice(0, 4) || '—',
                poster: x.poster_path, source: 'manual',
                overview: (x.overview || '').slice(0, 180),
            }));
        return send(res, 200, { results });
    }

    send(res, 404, { error: 'not found' });
}).listen(PORT, () => {
    console.log(`\n  Labelling UI → http://localhost:${PORT}\n`);
    console.log(`  Click the titles that are ACCEPTABLE answers. Everything else counts as wrong.`);
    console.log(`  Saves automatically. Close the tab and come back any time.\n`);
});
