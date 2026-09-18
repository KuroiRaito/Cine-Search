import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = `http://localhost:${server.config.server.port ?? server.httpServer.address().port}`;
const REF = (process.env.VITE_SUPABASE_URL || '').split('//')[1]?.split('.')[0] || 'project';
const UID = '11111111-2222-3333-4444-555555555555';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const EXP = 4102444800;
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: 's@x.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {}, identities: [{ id: UID, provider: 'email' }] };
const SESSION = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, aud: 'authenticated', role: 'authenticated', exp: EXP, iat: EXP - 3600, session_id: 'snap' })}.sig`, refresh_token: 'snap', token_type: 'bearer', expires_in: 3600, expires_at: EXP, user: USER };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const reply = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
const LIB = [{ tmdb_id: 155, media_type: 'movie', status: 'watched', rating: 9, is_favourite: true, favourite_order: null, watched_episodes: {}, rewatch_count: 0, recommended_by: null, recommended_at: null, notes: null, added_at: '2026-01-02T00:00:00Z', started_at: null, completed_at: null, updated_at: '2026-01-03T00:00:00Z', catalog_titles: { title: 'The Dark Knight', release_date: '2008-07-16', poster_path: '/s.jpg', number_of_episodes: 0, seasons: null } }];
await ctx.route('**/rest/v1/**', (r) => reply(r, []));
await ctx.route('**/rest/v1/rpc/**', (r) => reply(r, {}));
await ctx.route('**/rest/v1/profiles**', (r) => reply(r, [{ id: UID, username: 'snap', region: 'US', services: [], theme: null }]));
await ctx.route('**/rest/v1/user_library**', (r) => reply(r, LIB));
await ctx.route('**/auth/v1/**', (r) => reply(r, { user: USER, session: SESSION }));
await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('cine_seen_cover', '1'); localStorage.setItem('user_region', 'US'); }, [`sb-${REF}-auth-token`, JSON.stringify(SESSION)]);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
const reqs = []; page.on('request', (r) => { if (r.url().includes('/rest/v1/')) reqs.push(decodeURIComponent(r.url().split('/rest/v1/')[1]).slice(0, 90)); });
for (const path of ['/library', '/you']) {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const r = await page.evaluate(() => ({
        n: document.querySelectorAll('#root *').length,
        text: (document.querySelector('#root')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 150),
    }));
    console.log(`\n${path}  ${r.n} elements\n   "${r.text}"`);
}
console.log('\nsupabase requests:'); reqs.slice(0, 8).forEach((x) => console.log('   ' + x));
console.log(errs.length ? `\nERRORS ${errs.join(' | ')}` : '\nno page errors');
await browser.close(); await server.close();
