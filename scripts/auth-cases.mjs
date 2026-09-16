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
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REF = (process.env.VITE_SUPABASE_URL || '').split('//')[1]?.split('.')[0] || 'project';
const UID = '11111111-2222-3333-4444-555555555555';

const args = process.argv.slice(2);
const SHOW = args.includes('--show');
// Every case already drives the app into a state that is otherwise only
// reachable by breaking something. Photographing them is nearly free, and it
// is the only way to look at an error state without causing one.
const SHOTS = args.includes('--shots');
const SHOT_DIR = fileURLToPath(new URL('../snapshots/auth', import.meta.url));
// Phone by default, because that is where the layout is tightest and where a
// banner is most likely to push the submit button off the screen. --wide runs
// the same 35 states through the desktop shell, which is a different frame
// entirely: a top bar instead of tabs, and a centred dialog instead of a sheet.
const WIDE = args.includes('--wide');
const asked = Number((args.find((a) => a.startsWith('--w=')) || '').slice(4));
const VIEW = { width: asked || (WIDE ? 1280 : 420), height: asked && asked < 380 ? 568 : 900 };
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

const TILE = [{ id: 693134, title: 'Dune: Part Two', poster_path: '/p.jpg', media_type: 'movie', release_date: '2024-02-27', vote_average: 8.2 }];

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

    await ctx.route('**/api/tmdb**', async (r) => {
        if (o.tmdbSlow) await new Promise((res) => setTimeout(res, o.tmdbSlow));
        return json(r, 200, { results: o.tmdb || [] });
    });
    // Artwork never loads in here, which is itself one of the cases.
    await ctx.route('**image.tmdb.org/**', (r) => r.abort('failed'));
    // Registered before the specific one: Playwright matches the most recently
    // added route first.
    await ctx.route('**/rest/v1/**', (r) => json(r, 200, '[]'));
    // The shape taste_summary() really returns for an account with nothing
    // watched — always an object, never an empty list. Mocking it as `[]` is
    // what the catch-all below would do, and that is not what the database
    // does.
    await ctx.route('**/rest/v1/rpc/taste_summary**', (r) => json(r, 200, o.taste || {
        totals: { titles: 0, episodes: 0, minutes: 0, partial: false },
        genres: [], decades: [], people: [],
    }));
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
        if (url.includes('/signup')) {
            if (o.signUp === 'confirm') return json(r, 200, { user: { ...USER, identities: [{ id: UID, provider: 'email' }] }, session: null });
            return o.signUp ? reply(o.signUp) : json(r, 200, live());
        }
        if (url.includes('/resend')) return json(r, 200, {});
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
        // Names only the missing requirement, not the whole rule again: the
        // five are already on screen ticking green. Foundations U7.
        expect: ['At least 8 characters'], noAuthCalls: true,
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
        expect: ['/welcome/username', 'Pick a username', 'the username didn’t save'],
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
            // Sliced generously and matched on content, not position: at 1280
            // the top bar is in the text too, and a fixed prefix would only be
            // asserting which width this ran at.
            return `before[${before.slice(0, 200)}] after[${after.slice(0, 200)}]`;
        },
        // Before: the signed-in empty state. After: the guest pitch, in a tab
        // nobody touched. Leaving one person's library on screen after another
        // signs out is not a cosmetic bug.
        expect: ['Save a film or series', 'An account keeps your watchlist'],
        reject: ['Your session ended'],
    },

    /* --- the states foundations §12 names, and the behaviour behind them --- */
    {
        n: 26, name: 'I2 · refused sign-in clears the password, rings it, and speaks up',
        opts: { signIn: 'invalid_credentials' },
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await fill(page, { email: 'qa@cinesearch.test', password: 'wrongpassword' });
            await page.click('button[type=submit]'); await page.waitForTimeout(800);
            const pw = await page.inputValue('#auth-password');
            const ring = await page.getAttribute('#auth-password', 'aria-invalid');
            const focused = await page.evaluate(() => document.activeElement?.className || '');
            return `password="${pw}" aria-invalid=${ring} focus=${focused} ${await read(page)}`;
        },
        // Cleared is the security convention people expect; every other typed
        // value survives an error. The banner takes focus because the person
        // who pressed Enter is at the button, below it.
        expect: ['password=""', 'aria-invalid=true', 'focus=form-error'],
        // And it must not then nag about the field it emptied.
        reject: ['Enter your password'],
    },
    {
        n: 27, name: 'I3 · while it is in flight the fields are frozen, not disabled',
        opts: { slow: 1200 },
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await fill(page, { email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(350);
            const ro = await page.getAttribute('#auth-email', 'readonly');
            const dis = await page.getAttribute('#auth-email', 'disabled');
            const label = await page.innerText('button[type=submit]');
            // Disabled would drop the field out of the tab order mid-request
            // and move the keyboard somewhere unrelated.
            return `readonly=${ro !== null} disabled=${dis !== null} button="${label}"`;
        },
        expect: ['readonly=true', 'disabled=false', 'button="One moment…"'],
    },
    {
        n: 28, name: 'I4 · offline relabels the button to what pressing it would do',
        opts: { offline: true },
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await fill(page, { email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(1600);
            const email = await page.inputValue('#auth-email');
            return `button="${await page.innerText('button[type=submit]')}" email="${email}"`;
        },
        // And the typed email survives: making somebody retype it because the
        // network dropped is the app blaming them for its own problem.
        expect: ['button="Try again"', 'email="qa@cinesearch.test"'],
    },
    {
        n: 29, name: 'I5 · a rate limit makes the button honestly unavailable',
        opts: { signIn: 'rate_limited' },
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await fill(page, { email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(800);
            const label = await page.innerText('button[type=submit]');
            const disabled = await page.isDisabled('button[type=submit]');
            return `button="${label}" disabled=${disabled} ${await read(page)}`;
        },
        expect: ['Try again in', 'disabled=true', 'Too many attempts'],
    },
    {
        n: 30, name: 'U4 · a link in an inbox is not a dead end — offer to send it again',
        opts: { signUp: 'confirm' },
        async run(page, base) {
            await page.goto(`${base}/welcome/signup`); await page.waitForTimeout(500);
            await fill(page, { username: 'newname', email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(900);
            const before = await read(page);
            await page.getByRole('button', { name: 'Resend the link' }).click();
            await page.waitForTimeout(600);
            return `${before} ⟩ ${await page.innerText('.auth-done .btn')}`;
        },
        expect: ['Check your email', 'We sent a confirmation link to qa@cinesearch.test', 'Sent again'],
    },
    {
        n: 31, name: 'S6 · the sheet holds focus, and hands it back to what raised it',
        opts: { tmdb: TILE },
        async run(page, base) {
            await page.goto(`${base}/`); await page.waitForTimeout(1200);
            const add = page.getByRole('button', { name: 'Add Dune: Part Two' }).first();
            await add.focus();
            await add.click();
            await page.waitForTimeout(500);
            const inside = await page.evaluate(() => Boolean(document.querySelector('.sheet')?.contains(document.activeElement)));

            // Tab off the last control and it must come back to the first,
            // not escape to the page behind the modal.
            await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
            await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
            const stillInside = await page.evaluate(() => Boolean(document.querySelector('.sheet')?.contains(document.activeElement)));

            await page.keyboard.press('Escape'); await page.waitForTimeout(400);
            const returned = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || '');
            return `entered=${inside} trapped=${stillInside} returnedTo="${returned}"`;
        },
        expect: ['entered=true', 'trapped=true', 'returnedTo="Add Dune: Part Two"'],
    },
    {
        n: 32, name: 'C2 · the cover lays out its mosaic before any artwork arrives',
        // Trending is held for three seconds, so this is genuinely the
        // loading state and not the failed one.
        opts: { tmdbSlow: 3000 },
        async run(page, base) {
            await page.goto(`${base}/welcome`);
            await page.waitForSelector('.cover-cta .btn', { timeout: 10000 });
            const cells = await page.locator('.mosaic-cell').count();
            const cta = await page.locator('.cover-cta .btn').count();
            return `cells=${cells} buttons=${cta}`;
        },
        // Twelve cells and both buttons, immediately. The person may already be
        // reaching for "Create account" when the images land, so nothing below
        // the fold is allowed to move when they do.
        expect: ['cells=12', 'buttons=2'],
    },
    {
        n: 33, name: 'S5 · with a pointer the sheet stops being a sheet',
        opts: { tmdb: TILE },
        async run(page, base) {
            // A width in the medium band, where there is no thumb reaching for
            // a bottom edge and nothing to drag.
            await page.setViewportSize({ width: 900, height: 800 });
            await page.goto(`${base}/`); await page.waitForTimeout(1200);
            await page.getByRole('button', { name: 'Add Dune: Part Two' }).first().click();
            await page.waitForTimeout(500);
            return page.evaluate(() => {
                const sheet = document.querySelector('.sheet');
                const grab = document.querySelector('.grab');
                const r = sheet.getBoundingClientRect();
                const css = getComputedStyle(sheet);
                return `width=${Math.round(r.width)} radius=${css.borderBottomLeftRadius}`
                    + ` offBottom=${Math.round(innerHeight - r.bottom) > 8}`
                    + ` grab=${grab ? getComputedStyle(grab).display : 'absent'}`;
            });
        },
        // 460px whatever the viewport does: a sheet is a fixed surface, so it
        // takes neither the page's gutter nor the container's width.
        expect: ['width=460', 'radius=16px', 'offBottom=true', 'grab=none'],
    },
    {
        n: 34, name: 'I9 · Caps Lock is a caption, not an error — nothing is wrong yet',
        opts: {},
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            const before = await read(page);
            // Playwright's keyboard tracks Alt/Control/Meta/Shift only, so the
            // lock state is synthesised on the native event React reads it
            // from. This proves the wiring, not the browser.
            await page.evaluate(() => {
                const el = document.getElementById('auth-password');
                const ev = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
                Object.defineProperty(ev, 'getModifierState', { value: (k) => k === 'CapsLock' });
                el.dispatchEvent(ev);
            });
            await page.waitForTimeout(300);
            const after = await read(page);
            const tone = await page.evaluate(() =>
                document.querySelector('.field-note') ? 'note' : (document.querySelector('.field-hint.bad') ? 'error' : 'none'));
            return `before[${before.includes('Caps Lock')}] after[${after.includes('Caps Lock')}] as=${tone}`;
        },
        expect: ['before[false]', 'after[true]', 'as=note'],
    },
    {
        n: 35, name: 'I13 · leaving mid-submit, and coming back to a form that works',
        opts: { slow: 2000 },
        async run(page, base) {
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(500);
            await fill(page, { email: 'qa@cinesearch.test', password: 'TestPass1!' });
            await page.click('button[type=submit]'); await page.waitForTimeout(300);
            const during = await page.innerText('button[type=submit]');

            // Away while the request is still out, then back.
            await page.goto(`${base}/`); await page.waitForTimeout(400);
            await page.goto(`${base}/welcome/signin`); await page.waitForTimeout(900);

            const label = await page.innerText('button[type=submit]');
            const disabled = await page.isDisabled('button[type=submit]');
            const email = await page.inputValue('#auth-email');
            return `during="${during}" back="${label}" disabled=${disabled} email="${email}"`;
        },
        // I1, not a form stuck in I3 for a request nobody is waiting on. This
        // is where a ref that was only ever cleared — never re-set on the
        // StrictMode remount — left every submit reading "One moment…".
        expect: ['during="One moment…"', 'back="Sign in"', 'disabled=false', 'email=""'],
    },
    {
        n: 36, name: 'Signed in with nothing watched yet — can still get to sign out',
        opts: { stored: live, profile: PROFILE },
        async run(page, base) {
            await page.goto(`${base}/you`); await page.waitForTimeout(1200);
            const state = await read(page);
            const gear = await page.locator('a[href="/settings"]').count();
            return `gear=${gear} ${state.slice(0, 90)}`;
        },
        // The commonest state a new account is in: signed in, nothing marked
        // watched. The way to settings — and therefore the only way to sign
        // out anywhere in the app — used to be rendered only once this screen
        // had content to show.
        expect: ['gear=1'],
    },
    {
        n: 37, name: 'A brand new account can sign out, by clicking only what it can see',
        opts: { stored: live, profile: PROFILE },
        async run(page, base) {
            // No URLs typed. Everything below is a control that has to be on
            // screen, because this is the walk that was impossible: the gear
            // was drawn only once the taste screen had content, so an account
            // with nothing watched had no route to Settings and therefore no
            // route to signing out anywhere in the product.
            await page.goto(`${base}/you`); await page.waitForTimeout(1200);
            const landed = await read(page);

            await page.getByRole('link', { name: 'Settings' }).click();
            await page.waitForTimeout(800);
            const settings = await read(page);

            await page.getByRole('button', { name: 'Sign out' }).first().click();
            await page.waitForTimeout(300);
            const asked = await read(page);

            await page.getByRole('button', { name: 'Sign out' }).last().click();
            await page.waitForTimeout(1000);
            return `landed[${landed.slice(0, 300)}] settings[${settings.slice(0, 900)}]`
                + ` asked[${asked.includes('library stays exactly as it is')}]`
                + ` end[${new URL(page.url()).pathname}] ${await read(page)}`;
        },
        expect: [
            'Nothing watched yet',      // the state a new account is actually in
            'Account',                  // the account block, now owned by entry
            'qa@cinesearch.test',       // and it says who you are signed in as
            'asked[true]',              // the reassurance before the scary button
            'end[/]',
            'Sign in',                  // signed out, and the top bar says so
        ],
        reject: ['Your session ended'],
    },
    {
        n: 38, name: 'A guest reaching Settings is offered an account, not an empty block',
        opts: {},
        async run(page, base) {
            await page.goto(`${base}/settings`); await page.waitForTimeout(900);
            return read(page);
        },
        expect: ['Account', 'browsing without one', 'Create an account'],
        reject: ['Sign out'],
    },
];

/* ------------------------------- runner -------------------------------- */

const server = await createServer({ root: ROOT, server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = `http://localhost:${server.config.server.port ?? server.httpServer.address().port}`;
const browser = await chromium.launch();
if (SHOTS) mkdirSync(SHOT_DIR, { recursive: true });

let failed = 0;
const chosen = CASES.filter((c) => !only.length || only.includes(c.n));

for (const c of chosen) {
    const ctx = await browser.newContext({ viewport: { ...VIEW } });
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

    if (SHOTS && !page.isClosed()) {
        const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 52);
        const file = `${String(c.n).padStart(2, '0')}-${slug}@${VIEW.width}.png`;
        await page.screenshot({ path: join(SHOT_DIR, file) }).catch(() => {});
    }

    // An invariant, not a case: no state of any screen at any width may make
    // the page scroll sideways. It is the failure 320 exists to catch, and the
    // one a text assertion will never notice.
    if (!problem && !page.isClosed()) {
        const over = await page.evaluate(() => {
            const d = document.documentElement;
            return d.scrollWidth > d.clientWidth ? `${d.scrollWidth} > ${d.clientWidth}` : null;
        }).catch(() => null);
        if (over) problem = `the page scrolls sideways (${over})`;
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
    ? `\n  ${failed} of ${chosen.length} cases failed at ${VIEW.width}px.\n`
    : `\n  All ${chosen.length} cases pass at ${VIEW.width}px.\n`);
if (SHOTS) console.log(`  ${chosen.length} screenshots → snapshots/auth/\n`);
process.exit(failed ? 1 : 0);
