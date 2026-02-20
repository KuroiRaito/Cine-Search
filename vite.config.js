import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
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
            url.searchParams.append('api_key', env.VITE_TMDB_API_KEY);
            return `${targetPath}${url.search}`;
          }
        }
      }
    }
  }
})
