import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

export default defineConfig(({ mode, command }) => {
  // Loaded with an empty prefix so non-VITE_ (server-only) vars are available here.
  // This runs in Node, never in the browser bundle.
  const env = loadEnv(mode, process.cwd(), '');
  const tmdbKey = env.TMDB_API_KEY;
  if (command === 'serve' && !tmdbKey) {
    console.warn('[vite] TMDB_API_KEY is not set in .env - /api/tmdb requests will fail with 401.');
  }
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/tmdb': {
          target: 'https://api.themoviedb.org/3',
          changeOrigin: true,
          rewrite: (path) => {
            const url = new URL(path, 'http://localhost');
            const targetPath = url.searchParams.get('path');
            url.searchParams.delete('path');
            url.searchParams.append('api_key', tmdbKey ?? '');
            return `${targetPath}${url.search}`;
          }
        }
      }
    }
  }
})
