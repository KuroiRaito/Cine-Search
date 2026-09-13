// Smoke test for the serverless function.
//
// `vite build` does not touch api/, so a broken import there ships to
// production unnoticed. This loads the handler exactly as Vercel's Node runtime
// would and exercises it with a stubbed fetch - no network, no API key needed.

import assert from 'node:assert/strict';

const results = [];

// What a browser on our own page sends. The proxy refuses anything else.
const HOST = 'v0-cine-search.vercel.app';
const OURS = { host: HOST, origin: `https://${HOST}` };
const check = async (name, fn) => {
    try { await fn(); results.push(['pass', name]); }
    catch (err) { results.push(['FAIL', `${name} — ${err.message}`]); }
};

await check('api/tmdb.js loads (verifies ./_tmdbCore.mjs import resolves)', async () => {
    const mod = await import('../api/tmdb.js');
    assert.equal(typeof mod.default, 'function', 'default export must be a handler');
});

await check('_tmdbCore exports validatePath and fetchTmdb', async () => {
    const core = await import('../api/_tmdbCore.mjs');
    assert.equal(typeof core.validatePath, 'function');
    assert.equal(typeof core.fetchTmdb, 'function');
    assert.equal(core.validatePath(''), 'Missing path parameter');
    assert.equal(core.validatePath('/search/movie'), null);
    assert.ok(core.validatePath('/search/../../etc'), 'path traversal must be rejected');
});

await check('handler rejects a missing path with 400', async () => {
    const { default: handler } = await import('../api/tmdb.js');
    const res = mockRes();
    await handler({ method: 'GET', headers: OURS, query: {} }, res);
    assert.equal(res.statusCode, 400);
});

await check('handler refuses a path outside the allowlist with 400', async () => {
    const { default: handler } = await import('../api/tmdb.js');
    const res = mockRes();
    await handler({ method: 'GET', headers: OURS, query: { path: '/authentication/guest_session/new' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Path not allowed');
});

await check('handler refuses a foreign origin with 403, and no origin at all', async () => {
    const { default: handler } = await import('../api/tmdb.js');
    let res = mockRes();
    await handler({ method: 'GET', headers: { host: HOST, origin: 'https://someone-else.example' },
        query: { path: '/search/movie', query: 'x' } }, res);
    assert.equal(res.statusCode, 403);
    res = mockRes();
    await handler({ method: 'GET', headers: { host: HOST }, query: { path: '/search/movie', query: 'x' } }, res);
    assert.equal(res.statusCode, 403, 'curl with no headers must not get a free proxy');
});

await check('handler returns TMDB payload with a stubbed fetch', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    const real = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ results: [{ id: 27205, title: 'Inception' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    try {
        const { default: handler } = await import('../api/tmdb.js');
        const res = mockRes();
        await handler({ method: 'GET', headers: OURS, query: { path: '/search/movie', query: 'inception' } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.results[0].title, 'Inception');
    } finally { globalThis.fetch = real; }
});

function mockRes() {
    return {
        statusCode: 0, body: null, headers: {},
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

const failed = results.filter(([s]) => s === 'FAIL');
for (const [status, name] of results) {
    console.log(`  ${status === 'pass' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}`);
}
console.log(`\n  ${results.length - failed.length}/${results.length} passed\n`);
process.exit(failed.length ? 1 : 0);
