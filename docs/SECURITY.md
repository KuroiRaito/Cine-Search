# Security

What is protected, how, and what a stranger with the public repository and the
production URL can and cannot do. Checked against the live project on 2026-09-13.

## The model

- **The repository is public** (portfolio). It contains no secrets: `.env` has
  never been committed; a TMDB key that was committed on 2026-09-11 was rotated
  and the old one **tested revoked** (TMDB returns 401 for it).
- **The Supabase URL and anon key ship in the browser bundle by design.** They
  are safe to publish because every table has row-level security and every
  write goes through a function that raises on a missing `auth.uid()`. The
  service-role key is not used anywhere and must never be added to the app.
- **The TMDB key lives only in server environment** (`TMDB_API_KEY` on Vercel
  and in the local `.env`). The browser calls `/api/tmdb`; the key is added
  server-side.

## What a stranger can do

| With | They can | They cannot |
|---|---|---|
| the repo | read every line, run it against their own keys | find a secret |
| the production URL | browse the catalogue as a guest | create an account (§ sign-ups), use the proxy from another site (§ proxy) |
| the anon key | read `catalog_*` tables (public data) | read or write anyone's library; call any writer function |

## Sign-ups are by invitation

Two independent gates, either of which is sufficient:

1. **Database trigger** `auth_allowlist_gate` on `auth.users` — an insert whose
   email is not in `public.auth_allowlist` is refused. Cannot be flipped by
   accident; recorded in `supabase/004_hardening.sql`. To invite someone, add
   their email to the table first.
2. **Dashboard** — Supabase → Auth → Providers → Email → *Enable email signups* off.

Without these, the URL and anon key would let anyone create an account and,
through `catalog_ensure`, insert rows into the shared catalogue. It could not
overwrite good rows; it could add bad ones, and grow the database at will.

## The TMDB proxy

`/api/tmdb` (production: `api/tmdb.js`; development: the Vite middleware in
`vite.config.js`; both share `api/_tmdbCore.mjs`):

- **Path allowlist.** Only the endpoints in `src/lib/tmdb/endpoints.js` are
  forwarded. Everything else under TMDB's `/3/` — accounts, lists, sessions,
  reviews — returns 400. Adding an endpoint means adding it to the list.
- **Same-origin only** (production). A request without an `Origin` or `Referer`
  on our own host returns 403. This is a fence against casual use of the proxy
  from other sites or scripts, not a wall: a token in a public bundle would not
  be a secret, and real rate limiting needs state the app has no reason to
  carry yet. Consequence: the eval harness's proxy fallback no longer works;
  it must run in direct mode with a local key, which is the default.
- **Retry with backoff**, per-attempt timeout, bounded in-memory cache, edge
  `Cache-Control`. See the comments in `_tmdbCore.mjs`.

## Response headers

`vercel.json` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy`
denying camera, microphone and geolocation. No Content-Security-Policy yet:
the app loads images from `image.tmdb.org`, talks to `*.supabase.co`, and a
policy written in a hurry breaks one of them silently.

## Third parties the browser talks to

| Host | Why | Data sent |
|---|---|---|
| `image.tmdb.org` | posters, backdrops, stills | image paths |
| `<project>.supabase.co` | auth, library, taste | the user's own records |
| `ipapi.co` | detecting the where-to-watch region on first visit | the visitor's IP address |

`ipapi.co` is the one that is not ours and not TMDB's. It is called once, the
result is kept in `localStorage`, and the region can be overridden in Settings.
Replacing it with Vercel's `x-vercel-ip-country` header (no third party) is
planned.

## Passwords

Supabase enforces its strong-password policy on sign-up. **Leaked-password
protection** (HaveIBeenPwned check) is a dashboard toggle: Auth → Password →
*Prevent use of leaked passwords*. Enable it before inviting anyone.

## Commit identity

Twelve early commits carry a work-machine author identity. They are left as
they are — rewriting public history is a force-push for no security gain. Every
machine committing here should use the GitHub noreply address:

```bash
git config user.email "102591745+KuroiRaito@users.noreply.github.com"
```

## If a key is exposed

1. Rotate it at the provider (TMDB → Settings → API; Supabase → Settings → API).
2. Update Vercel's environment and the local `.env`.
3. Redeploy. Do not rewrite git history for it — the old key is dead, and the
   rewrite would be the only dangerous part.
