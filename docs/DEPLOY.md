# Vercel Deployment Checklist

Follow these steps to successfully deploy Cine Search to Vercel.

## 1. Prepare Your Repository
- Ensure all your code is committed and pushed to your default branch (e.g., `main` or `master`) on GitHub.
- Double-check that `node_modules`, `.env`, and `dist` are properly ignored in your `.gitignore`.

## 2. Vercel Project Setup
- Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
- Click **Add New...** -> **Project**.
- Import your GitHub repository containing the Cine Search project.
- Vercel will automatically detect the **Vite** framework and configure the build command (`npm run build`) and output directory (`dist`).

## 3. Environment Variables
Before clicking Deploy, configure your environment variables in the Vercel UI.
Add the following keys to match your `.env`:
- `VITE_TMDB_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 4. Deploy
- Click the **Deploy** button.
- Vercel will build and deploy your application. Once finished, you'll receive a live URL.

## 5. Post-Deployment (Supabase)
- Go to your Supabase Dashboard -> **Authentication** -> **URL Configuration**.
- Add your new Vercel production URL to the **Site URL** and **Additional Redirect URLs** to ensure authentication flows work correctly in production.

## Note on API Security
For a true production environment, consider moving the TMDB API calls to a serverless function (like Vercel Functions or Edge Functions) to prevent exposing your `VITE_TMDB_API_KEY` to the client browser.
