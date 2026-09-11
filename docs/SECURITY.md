# Security Guidelines

## 1. Environment Variables
- **Never commit `.env` files.** Your `.env` and `.env.local` must stay in `.gitignore`.
- Inject API Keys entirely outside the repository via deployment environment variables.

## 2. Secrets Rotation 
If an API key is accidentally committed or compromised:
1. Immediately generate a new key from the provider dashboard (Supabase or TMDB).
2. Update the environment variables in your deployment dashboard and local `.env`.
3. Trigger a fresh deployment and purge the old keys entirely.

## 3. Known Incident: Committed TMDB Key

A TMDB API key was hardcoded as a fallback in `api/tmdb.js` and committed to this
repository. The literal was removed, but **it remains in git history** and must be
treated as compromised.

Required action:
1. Revoke/regenerate the TMDB key in the TMDB dashboard.
2. Set the new key as `TMDB_API_KEY` in the Vercel dashboard (server-scoped, no `VITE_` prefix).
3. Redeploy.

The server proxy now has **no fallback** - it returns `500` if `TMDB_API_KEY` is
unset, so a missing key fails loudly instead of silently using a committed secret.

## 4. Storage of Server Keys
- **Client Side**: Only expose variables prefixed with `VITE_`.
- **Backend Side**: The TMDB key is server-scoped as `TMDB_API_KEY` (no `VITE_` prefix), so Vite never inlines it into the browser bundle. All TMDB traffic goes through the `/api/tmdb` proxy - the Vercel serverless function in production, the Vite dev-server proxy locally - and the key is injected there. The client never sees it in any environment.

## 5. Supabase Row Level Security (RLS)
- Because `VITE_SUPABASE_ANON_KEY` is public by design, you **must enable Row Level Security (RLS)** in your Supabase database.
- Restrict malicious client-side changes by enforcing Policies on inserts, deletes, and updates directly tied to the currently authenticated user session.
