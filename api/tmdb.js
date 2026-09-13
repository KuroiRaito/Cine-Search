import { validatePath, fetchTmdb, isSameOrigin } from './_tmdbCore.mjs';

const CACHE = new Map();
const TTL = 60 * 1000;
const MAX_ENTRIES = 500;

// The cache previously grew without bound - entries were only TTL-checked on
// read, never evicted - so a long-lived container leaked until OOM. Flagged as
// High risk in docs/Architecture audit.md. Map preserves insertion order, so
// deleting the first key evicts the oldest.
function setCached(key, data) {
  if (CACHE.has(key)) CACHE.delete(key);
  CACHE.set(key, { time: Date.now(), data });
  while (CACHE.size > MAX_ENTRIES) {
    CACHE.delete(CACHE.keys().next().value);
  }
}

function getCached(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.time >= TTL) { CACHE.delete(key); return null; }
  return hit.data;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(400).json({ error: 'Method not allowed' });
  }

  // Only our own pages may use this. The dev middleware in vite.config.js
  // skips this check because everything there is localhost.
  if (!isSameOrigin(request.headers)) {
    return response.status(403).json({ error: 'Forbidden' });
  }

  // eslint-disable-next-line no-unused-vars
  const { path, api_key, ...queryParams } = request.query;

  const pathError = validatePath(path);
  if (pathError) {
    return response.status(400).json({ error: pathError });
  }

  const cacheKey = path + '?' + new URLSearchParams(queryParams).toString();
  const cached = getCached(cacheKey);

  if (cached) {
    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return response.status(200).json(cached);
  }

  // Server-side only. Never hardcode a fallback here: this file is committed to git.
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) {
    return response.status(500).json({ error: 'TMDB API key not configured on server' });
  }

  try {
    const { status, data } = await fetchTmdb(path, queryParams, tmdbKey);

    if (status >= 200 && status < 300) {
      setCached(cacheKey, data);
      response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    }

    return response.status(status).json(data);
  } catch (error) {
    console.error('Error proxying to TMDB:', error);
    return response.status(500).json({ error: 'Failed to fetch from TMDB' });
  }
}
