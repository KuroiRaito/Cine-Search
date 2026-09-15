#!/usr/bin/env node
/**
 * Every way signing in can go wrong, run against the real app.
 *
 *   npm run auth              all of them
 *   npm run auth -- 8 12      just those, by number
 *   npm run auth -- --show    print what each case actually rendered
 *
 * Why this exists: authentication is the one part of this product where the
 * failures matter more than the success, and every one of them is invisible
 * from the happy path. Six of the cases below were live bugs — a signed-in
 * person told they had no account, a username collision with no way out, an
 * invitation-only rejection reported as "check your connection" — and none of
 * them could be found by signing in correctly and looking at the screen.
 *
 * Supabase is intercepted, not called. The payloads are not invented: every
 * one was captured from this project's own Supabase, status code and error
 * code and prose, so what the app is tested against is what it will be given.
 * That also means this runs without credentials, without a network, and
 * without leaving a single test account behind.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REF = (process.env.VITE_SUPABASE_URL || '').split('//')[1]?.split('.')[0] || 'project';
const UID = '11111111-2222-3333-4444-555555555555';

const args = process.argv.slice(2);
const SHOW = args.includes('--show');
const only = args.filter((a) => !a.startsWith('--')).map(Number);

/* ---- a session Supabase would accept, and the pieces to bend it with ---- */

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = {
    id: UID, aud: 'authenticated', role: 'authenticated', email: 'qa@cinesearch.test',
    email_confirmed_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {}, identities: [{ id: UID, provider: 'email' }], is_anonymous: false,
};
const sessionAt = (exp) => ({
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
        sub: UID, aud: 'authenticated', role: 'authenticated', exp, iat: exp - 3600, session_id: 's1',
    })}.sig`,
    refresh_token: 'r1', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: USER,
});
const now = () => Math.floor(Date.now() / 1000);
const live = () => sessionAt(now() + 3600);
const stale = () => sessionAt(now() - 60);

const PROFILE = { id: UID, username: 'qa', region: 'IN', services: [], theme: 'dark' };

/** Captured from this project's Supabase on 2026-09-15. Do not tidy these. */
const REPLIES = {
    invalid_credentials: [400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials', message: 'Invalid login credentials' }],
    // The invitation trigger raises inside auth.users; Supabase can only
    // report that as a bare 500, which supabase-js then classes as retryable.
    not_invited: [500, { code: 'unexpected_failure', error_code: 'unexpected_failure', msg: 'Database error saving new user', message: 'Database error saving new user' }],
    weak_password: [422, { code: 'weak_password', error_code: 'weak_password', msg: 'Password should be at least 8 characters.', message: 'Password should be at least 8 characters.' }],
    user_already_exists: [422, { code: 'user_already_exists', error_code: 'user_already_exists', msg: 'User already registered', message: 'User already registered' }],
    rate_limited: [429, { code: 'over_request_rate_limit', error_code: 'over_request_rate_limit', msg: 'Request rate limit reached', message: 'Request rate limit reached' }],
    refresh_rejected: [400, { code: 'refresh_token_already_used', error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used', message: 'Invalid Refresh Token: Already Used' }],
};

async function install(ctx, o) {
    const json = (route, status, body) =>
        route.fulfill({ status, contentType: 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body) });

    await ctx.route('**/api/tmdb**', (r) => json(r, 200, { results: [] }));
    // Registered before the specific one: Playwright matches the most recently
    // added route first.
    await ctx.route('**/rest/v1/**', (r) => json(r, 200, '[]'));
    await ctx.route('**/rest/v1/rpc/username_available**', (r) =>
        json(r, o.usernameFree === false ? 200 : 404, o.usernameFree === false ? 'false' : { code: 'PGRST202' }));
    await ctx.route('**/rest/v1/profiles**', (r) => {
        if (r.request().method() === 'POST') {
            return o.profileInsert === 'duplicate'
                ? json(r, 409, { code: '23505', message: 'duplicate key value violates unique constraint "profiles_username_key"' })
                : json(r, 201, '[]');
        }
        if (o.profileRead === 'error') return json(r, 500, { message: 'boom' });
        return json(r, 200, o.profile ? o.profile : '');
    });

    await ctx.route('**/auth/v1/**', async (r) => {
        const url = r.request().url();
        if (o.offline) return r.abort('failed');
        if (o.slow) await new Promise((res) => setTimeout(res, o.slow));
        const reply = (k) => json(r, REPLIES[k][0], REPLIES[k][1]);
        if (url.includes('/signup')) return o.signUp ? reply(o.signUp) : json(r, 200, live());
        if (url.includes('grant_type=password')) return o.signIn ? reply(o.signIn) : json(r, 200, live());
        if (url.includes('grant_type=refresh_token')) return o.refresh ? reply(o.refresh) : json(r, 200, live());
        if (url.includes('/logout')) return r.fulfill({ status: 204, body: '' });
        return json(r, 200, {});
    });

    await ctx.addInitScript(([k, v]) => {
        localStorage.setItem('cine_seen_cover', '1');
        if (v) localStorage.setItem(k, v);
    }, [`sb-${REF}-auth-token`, o.stored ? JSON.stringify(o.stored()) : '']);
}

const read = async (page) =>
    (await page.locator('#root').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

const fill = async (page, fields) => {
    for (const [id, value] of Object.entries(fields)) await page.fill(`#auth-${id}`, value);
};

/* ------------------------------ the cases ------------------------------ */

const CASES = [
    /* --- coming back: who does the app think you are, and when --- */
    {
        n: 1, name: 'Signed in, token expired — the app must never call them a guest',
        opts: { stored: stale, slow: 900, profile: PROFILE },
        async run(page, base) {
            const seen = [];
            const nav = page.goto(`${base}/library`, { waitUntil: 'commit' });
            for (let i = 0; i < 6; i++) { seen.push(await read(page)); await page.waitForTimeout(250); }
            await nav.catch(() => {});
            return seen.join(' ⟩ ');
        },
        // The guest pitch must appear at no point, not merely not at the end.
        // At phone width the top bar is hidden, so the signed-in signal is the
        // empty state's wording: "Save a film or series" is what someone with
        // an account and nothing in it is told; "An account keeps your
        // watchlist" is the pitch, and it is the one that used to show here.
        reject: ['Create an account', 'An account keeps your watchlist'],
        expect: ['Save a film or series'],
    },
    {
        n: 2, name: 'Signed in, token still good — straight in, no flicker',
        opts: { stored: live, profile: PROFILE },
        run: async (page, base) => { await page.goto(`${base}/library`); await page.waitForTimeout(600); return read(page); },
        reject: ['Create an account'], expect: ['Save a film or series'],
    },
    {
        n: 3, name: 'Refresh token rejected — say the session ended, do not pretend they never had one',
        opts: { stored: stale, refresh: 'refresh_rejected' },
        run: async (page, base) => { await page.goto(`${base}/library`); await page.waitForTimeout(900); return read(page); },
        expect: ['Your session ended', 'Sign in again'],
    },
    {
        n: 4, name: 'Never signed in — a guest gets the guest screen and no alarm',
        opts: {},
        run: async (page, base) => { await page.goto(`${base}/library`); await page.waitForTimeout(800); return read(page); },
        expect: ['Nothing saved yet', 'Create an account'], reject: ['Your session ended'],
    },
    {
        n: 5, name: 'Profile read fails — a blip is not a missing account',
        opts: { stored: live, profileRead: 'error' },
        run: async (page, base) => { await page.goto(`${base}/library`); await page.waitForTimeout(900); return `${new URL(page.url()).pathname} ${await read(page)}`; },
        reject: ['Pick a username'],
    },

    /* --- signing in --- */
    {
        n: 6, name: 'Both fields empty — named under each field, nothing sent',
        opts: {},
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await page.click('button[type=submit]'); await page.waitForTimeout(400);
            return read(page);
        },
        expect: ['Enter your email address', 'Enter your password'], noAuthCalls: true,
    },
    {
        n: 7, name: '"abc" as an email — caught here, not after a round trip',
        opts: {},
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await fill(page, { email: 'abc', password: 'whatever' });
            await page.click('button[type=submit]'); await page.waitForTimeout(400);
            return read(page);
        },
        expect: ['doesn’t look like an email address'], noAuthCalls: true,
    },
    {
        n: 8, name: 'Wrong password — and the same answer for an email with no account',
        opts: { signIn: 'invalid_credentials' },
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await fill(page, { email: 'qa@cinesearch.test', password: 'nope' });
            await page.click('button[type=submit]'); await page.waitForTimeout(700);
            return read(page);
        },
        expect: ['email and password don’t match'],
    },
    {
        n: 9, name: 'No connection — not "Failed to fetch"',
        opts: { offline: true },
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await fill(page, { email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(1500);
            return read(page);
        },
        expect: ['Can’t reach the server'],
    },
    {
        n: 10, name: 'Too many attempts — a wait, not a mystery',
        opts: { signIn: 'rate_limited' },
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await fill(page, { email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(700);
            return read(page);
        },
        expect: ['Too many attempts'],
    },
    {
        n: 11, name: 'Signing in returns you to where you were stopped',
        opts: { profile: PROFILE },
        async run(page, base) {
            await page.goto(`${base}/title/movie/27205`); await page.waitForTimeout(400);
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(400);
            await page.evaluate(() => window.history.replaceState({ ...window.history.state, usr: { from: '/title/movie/27205' } }, ''));
            await page.reload(); await page.waitForTimeout(600);
            await fill(page, { email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(1200);
            return new URL(page.url()).pathname;
        },
        expect: ['/title/movie/27205'],
    },

    /* --- creating an account --- */
    {
        n: 12, name: 'A six-character password — refused here, because the server wants eight',
        opts: {},
        async run(page, base) {
            await page.goto(`${base}/welcome/signup`); await page.waitForTimeout(500);
            await fill(page, { username: 'newname', email: 'qa@cinesearch.test', password: 'Ab1!cd' });
            await page.click('button[type=submit]'); await page.waitForTimeout(400);
            return read(page);
        },
        expect: ['At least 8 characters', 'doesn’t meet the requirements'], noAuthCalls: true,
    },
    {
        n: 13, name: 'Email not on the invitation list — says so, does not blame the network',
        opts: { signUp: 'not_invited' },
        async run(page, base) {
            await page.goto(`${base}/welcome/signup`); await page.waitForTimeout(500);
            await fill(page, { username: 'newname', email: 'stranger@example.com', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(900);
            return read(page);
        },
        expect: ['by invitation'], reject: ['Can’t reach the server'],
    },
    {
        n: 14, name: 'Email already has an account — sends them to sign in',
        opts: { signUp: 'user_already_exists' },
        async run(page, base) {
            await page.goto(`${base}/welcome/signup`); await page.waitForTimeout(500);
            await fill(page, { username: 'newname', email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(900);
            return read(page);
        },
        expect: ['already has an account'],
    },
    {
        n: 15, name: 'Username taken as the row is written — the account exists, so finish it',
        opts: { profileInsert: 'duplicate' },
        async run(page, base) {
            await page.goto(`${base}/welcome/signup`); await page.waitForTimeout(500);
            await fill(page, { username: 'raman', email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(1400);
            return `${new URL(page.url()).pathname} ${await read(page)}`;
        },
        // The old behaviour: stranded on "Create your account" with an account
        // that already existed, and the only way on was to be told so.
        expect: ['/welcome/username', 'Pick a username', 'That username is taken'],
        reject: ['Create your account'],
    },
    {
        n: 16, name: 'Username taken, and the database can say so first',
        opts: { usernameFree: false },
        async run(page, base) {
            await page.goto(`${base}/welcome/signup`); await page.waitForTimeout(500);
            await fill(page, { username: 'raman', email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(900);
            return read(page);
        },
        expect: ['That username is taken'], noAuthCalls: true,
    },
    {
        n: 17, name: 'An account with no profile is asked for one, wherever it is',
        opts: { stored: live },
        run: async (page, base) => { await page.goto(`${base}/search`); await page.waitForTimeout(900); return new URL(page.url()).pathname; },
        expect: ['/welcome/username'],
    },

    /* --- doors you are already through, and doors that lead nowhere --- */
    {
        n: 18, name: 'Signed in, asked for the sign-in page — sent on',
        opts: { stored: live, profile: PROFILE },
        run: async (page, base) => { await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(1000); return new URL(page.url()).pathname; },
        expect: ['/'], reject: ['/welcome'],
    },
    {
        n: 19, name: 'Signed in, asked for the cover — sent on',
        opts: { stored: live, profile: PROFILE },
        run: async (page, base) => { await page.goto(`${base}/welcome`); await page.waitForTimeout(1000); return new URL(page.url()).pathname; },
        expect: ['/'], reject: ['/welcome'],
    },
    {
        n: 20, name: 'A /welcome URL that means nothing',
        opts: {},
        run: async (page, base) => { await page.goto(`${base}/welcome/pizza`); await page.waitForTimeout(600); return new URL(page.url()).pathname; },
        expect: ['/welcome/signin'],
    },

    /* --- passwords --- */
    {
        n: 21, name: 'Forgotten password — the same answer whether or not the account exists',
        opts: {},
        async run(page, base) {
            await page.goto(`${base}/welcome/forgot`); await page.waitForTimeout(500);
            await fill(page, { email: 'qa@cinesearch.test' });
            await page.click('button[type=submit]'); await page.waitForTimeout(700);
            return read(page);
        },
        expect: ['Check your email', 'If qa@cinesearch.test has an account'],
    },
    {
        n: 22, name: 'A reset link that has expired does not pretend to work',
        opts: {},
        run: async (page, base) => { await page.goto(`${base}/welcome/reset`); await page.waitForTimeout(600); return read(page); },
        expect: ['expired or has already been used'],
    },
    {
        n: 23, name: 'A password you can read back',
        opts: {},
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await fill(page, { password: 'secret' });
            const before = await page.getAttribute('#auth-password', 'type');
            await page.click('.pw-peek');
            return `${before} → ${await page.getAttribute('#auth-password', 'type')}`;
        },
        expect: ['password → text'],
    },

    /* --- leaving --- */
    {
        n: 24, name: 'Signing out is not an error, and says nothing alarming',
        opts: { stored: live, profile: PROFILE },
        async run(page, base) {
            await page.goto(`${base}/settings`); await page.waitForTimeout(900);
            await page.getByRole('button', { name: 'Sign out' }).first().click();
            await page.waitForTimeout(200);
            await page.getByRole('button', { name: 'Sign out' }).last().click();
            await page.waitForTimeout(900);
            return `${new URL(page.url()).pathname} ${await read(page)}`;
        },
        expect: ['Sign in'], reject: ['Your session ended'],
    },
    {
        n: 25, name: 'Signing out in one tab signs out the other',
        opts: { stored: live, profile: PROFILE },
        async run(page, base) {
            const second = await page.context().newPage();
            await second.goto(`${base}/library`); await second.waitForTimeout(800);
            const before = await read(second);

            await page.goto(`${base}/settings`); await page.waitForTimeout(800);
            await page.getByRole('button', { name: 'Sign out' }).first().click();
            await page.waitForTimeout(200);
            await page.getByRole('button', { name: 'Sign out' }).last().click();

            // The other tab is not reloaded: it has to hear about this itself.
            await second.waitForTimeout(1200);
            const after = await read(second);
            await second.close();
            return `before[${before.slice(0, 40)}] after[${after.slice(0, 60)}]`;
        },
        // Before: the signed-in empty state. After: the guest pitch, in a tab
        // nobody touched. Leaving one person's library on screen after another
        // signs out is not a cosmetic bug.
        expect: ['before[Library Nothing saved yet Save a film', 'An account keeps your watchlist'],
        reject: ['Your session ended'],
    },
];

/* ------------------------------- runner -------------------------------- */

const server = await createServer({ root: ROOT, server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = `http://localhost:${server.config.server.port ?? server.httpServer.address().port}`;
const browser = await chromium.launch();

let failed = 0;
const chosen = CASES.filter((c) => !only.length || only.includes(c.n));

for (const c of chosen) {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
    await install(ctx, c.opts);
    const page = await ctx.newPage();
    const authCalls = [];
    page.on('request', (r) => { if (r.url().includes('/auth/v1/')) authCalls.push(r.url()); });

    let out = '';
    let problem = null;
    try {
        out = await c.run(page, base);
    } catch (err) {
        problem = `threw: ${String(err.message).split('\n')[0]}`;
    }

    if (!problem) {
        const missing = (c.expect || []).filter((e) => !out.includes(e));
        const present = (c.reject || []).filter((e) => out.includes(e));
        if (missing.length) problem = `missing: ${missing.map((x) => `"${x}"`).join(', ')}`;
        else if (present.length) problem = `should not appear: ${present.map((x) => `"${x}"`).join(', ')}`;
        else if (c.noAuthCalls && authCalls.length) problem = `sent ${authCalls.length} request(s) it should have caught first`;
    }

    if (problem) { failed++; console.log(`  FAIL  ${String(c.n).padStart(2)} · ${c.name}\n        ${problem}\n        got: ${out.slice(0, 220)}`); }
    else console.log(`  ok    ${String(c.n).padStart(2)} · ${c.name}`);
    if (SHOW && !problem) console.log(`        ${out.slice(0, 220)}`);

    await ctx.close();
}

await browser.close();
await server.close();

console.log(failed
    ? `\n  ${failed} of ${chosen.length} cases failed.\n`
    : `\n  All ${chosen.length} cases pass.\n`);
process.exit(failed ? 1 : 0);
