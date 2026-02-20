# Security Guidelines

## 1. Environment Variables
- **Never commit `.env` files.** Your `.env` and `.env.local` must stay in `.gitignore`.
- Inject API Keys entirely outside the repository via deployment environment variables.

## 2. Secrets Rotation 
If an API key is accidentally committed or compromised:
1. Immediately generate a new key from the provider dashboard (Supabase or TMDB).
2. Update the environment variables in your deployment dashboard and local `.env`.
3. Trigger a fresh deployment and purge the old keys entirely.

## 3. Storage of Server Keys
- **Client Side**: Only expose variables prefixed with `VITE_`.
- **Backend Side**: Consider creating a serverless function proxy to securely query TMDB under the hood so that your underlying `VITE_TMDB_API_KEY` isn't leaked to client browsers.

## 4. Supabase Row Level Security (RLS)
- Because `VITE_SUPABASE_ANON_KEY` is public by design, you **must enable Row Level Security (RLS)** in your Supabase database.
- Restrict malicious client-side changes by enforcing Policies on inserts, deletes, and updates directly tied to the currently authenticated user session.
