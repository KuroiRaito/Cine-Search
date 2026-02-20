# Security Policy

This document outlines key security guidelines for deploying and managing the Cine Search application.

## 1. Secrets Management
- **Never commit `.env` files**: All sensitive `.env` files must remain strictly in your `.gitignore`.
- Do not hardcode API Keys, Supabase Service Roles, or Database Passwords anywhere within the source code.

## 2. API Keys & Deployment
- Production API keys must be injected via the deployment provider environment variables (e.g. Vercel dashboard Settings -> Environment Variables).
- **Public Keys**: Variables prefixed with `VITE_` (such as `VITE_SUPABASE_ANON_KEY` and `VITE_TMDB_API_KEY`) are exposed to the client. Ensure that these keys only carry enough permission necessary for basic application functionality. 
- **Serverless Rotation**: It is best practice to move the TMDB API calls off the client to a dedicated backend or serverless function to keep `VITE_TMDB_API_KEY` hidden completely.

## 3. Rotating Keys
If you suspect an API key is compromised:
1. Log in to the respective dashboard (Supabase or TMDB).
2. Generate a new API Key/Anon Key.
3. Update your local `.env` file.
4. Update the environment variables in your Vercel Dashboard.
5. Trigger a new deployment on Vercel to invalidate the old bundle.
6. Delete/Deactivate the compromised key from the provider dashboard.

## 4. Supabase RLS (Row Level Security)
- Because `VITE_SUPABASE_ANON_KEY` is public by design, it's critical that your database tables have Row Level Security enabled.
- Every table should restrict `INSERT`, `UPDATE`, and `DELETE` access to the appropriate user entity. Do not allow public, unauthenticated anonymous updates from your client bundle to the Supabase Postgres instance.
