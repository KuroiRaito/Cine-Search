import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { validatePath, fetchTmdb } from './api/_tmdbCore.mjs'

/**
 * Serves /api/tmdb in dev using the same code as the production Vercel function,
 * so dev and prod cannot drift. Replaces Vite's built-in `server.proxy`, which
 * has no retry and turned every intermittent TMDB ECONNRESET into a 500
 * (~40% of dev requests).
 */
function tmdbDevProxy(env) {
  // Un-prefixed key preferred: VITE_* vars are inlined into the client bundle
  // and publicly readable. This runs in the dev server, never in the browser.
  const key = env.TMDB_API_KEY || env.VITE_TMDB_API_KEY
  return {
    name: 'tmdb-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tmdb', async (req, res) => {
        const send = (code, body) => {
          res.statusCode = code
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (!key) return send(500, { error: 'TMDB_API_KEY not set in .env' })

        const url = new URL(req.url, 'http://localhost')
        const path = url.searchParams.get('path')
        const pathError = validatePath(path)
        if (pathError) return send(400, { error: pathError })

        url.searchParams.delete('path')
        const params = Object.fromEntries(url.searchParams)

        try {
          const { status, data } = await fetchTmdb(path, params, key)
          send(status, data)
        } catch (err) {
          send(502, { error: 'Failed to fetch from TMDB', detail: err.message })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tmdbDevProxy(env)],
  }
})
