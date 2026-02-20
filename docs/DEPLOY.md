# Deployment Guide

Cine Search is optimized for automated deployment with Vercel.

## Vercel Deployment Checklist
1. **Commit Code**: Push your code to the `main` branch.
2. **Import**: Import your GitHub repository into the Vercel dashboard.
3. **Environment Setup**: Add the following Environment Variables in the Vercel dashboard:
   - `VITE_TMDB_API_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**: Click Deploy. Vercel will automatically detect the Vite build step (`npm run build`) and output mapping (`dist`).
5. **Post-Deployment**: Copy the production Vercel URL and add it to your Supabase Auth **Site URL** and **Redirect URLs** to maintain auth behavior.
