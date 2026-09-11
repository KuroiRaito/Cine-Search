# Deployment Guide

Cine Search deploys to Vercel from the `main` branch via the Vercel GitHub integration.

## Build contract

| Setting | Value | Where it comes from |
| --- | --- | --- |
| Framework | Vite | `vercel.json` |
| Build command | `npm run build` | `vercel.json` |
| Output directory | `dist` | `vercel.json` |
| Package manager | **npm** | `package-lock.json` (the only lockfile) |
| Node | `>=20.19.0` | `engines` in `package.json` |

## Environment variables

Set these in the Vercel dashboard (Project → Settings → Environment Variables).

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `TMDB_API_KEY` | Server only | Yes, for content | Used by the `/api/tmdb` serverless proxy in production, and by the Vite dev proxy locally. **Not** `VITE_`-prefixed, so it is never shipped to the browser. |
| `VITE_SUPABASE_URL` | Client | For accounts | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Client | For accounts | Public anon key. Requires RLS — see `SECURITY.md`. |

### Graceful degradation

The app is built so a partial environment still boots:

- **No Supabase vars** → the app still loads and **guest / demo mode works**. Account sign-in is disabled and a console warning is emitted. (`src/lib/supabaseClient.js` returns an inert client rather than throwing at module load, which would white-screen the whole app.)
- **No `TMDB_API_KEY`** → the app loads and guest mode works, but `/api/tmdb` returns `500 TMDB API key not configured on server` and no titles render.

## Deploy steps

1. Push to `main` (or open a PR for a preview deployment).
2. Vercel runs `npm ci` → `npm run build` → serves `dist`.
3. After the first production deploy, add the production URL to Supabase Auth **Site URL** and **Redirect URLs**.

## Verifying demo guest mode

Guest mode needs no backend and is the fastest smoke test of a deployment:

1. Open the deployment URL.
2. Click **🚀 Continue as Guest (Demo Mode)**.
3. The header should read `Logged in as: Guest Explorer`.
4. Reload — the session should persist (stored in `localStorage` under `cine_guest_user`).
5. Wishlist adds/removes persist to `localStorage` under `cine_saved_movies`.

If steps 1–4 pass but no titles appear, the app is fine and `TMDB_API_KEY` is missing or wrong.

> Note: `npm run preview` serves only the static `dist` bundle. `/api/tmdb` is a Vercel serverless function and does **not** run locally under preview, so titles will be empty there. Use `npm run dev` (whose dev-server proxy injects `TMDB_API_KEY` from your local `.env`) for local content testing.

## Troubleshooting

### `ERR_PNPM_OUTDATED_LOCKFILE` — build fails before Vite runs

Cause: more than one lockfile committed. If `pnpm-lock.yaml` exists, Vercel uses pnpm with `--frozen-lockfile`, which hard-fails when the lockfile does not match `package.json`.

This happened once already: dependencies were added in a commit that updated `package-lock.json` but not `pnpm-lock.yaml`.

**Rule: this repo keeps exactly one lockfile, `package-lock.json`.** Do not commit `pnpm-lock.yaml` or `yarn.lock`. Always install with `npm install`.

To reproduce a Vercel-style install locally:

```bash
npm ci
```

### Build succeeds, page is blank

Check the browser console. A throw at module load (for example a misconfigured Supabase client) takes down the whole React tree. Guest mode is deliberately independent of Supabase to keep it testable.

### `crbug/1173575` or missing routes on refresh

The SPA rewrite in `vercel.json` sends all unmatched paths to `/index.html`. Vercel checks the filesystem and serverless functions *before* rewrites, so `/api/tmdb` is unaffected.
