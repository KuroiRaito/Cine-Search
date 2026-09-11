import { validatePath, fetchTmdb } from './_tmdbCore.mjs';

const CACHE = new Map();
const TTL = 60 * 1000;

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(400).json({ error: 'Method not allowed' });
  }

  // eslint-disable-next-line no-unused-vars
  const { path, api_key, ...queryParams } = request.query;

  const pathError = validatePath(path);
  if (pathError) {
    return response.status(400).json({ error: pathError });
  }

  const cacheKey = path + '?' + new URLSearchParams(queryParams).toString();
  const cached = CACHE.get(cacheKey);

  if (cached && Date.now() - cached.time < TTL) {
    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return response.status(200).json(cached.data);
  }

  // Server-side only. Never hardcode a fallback here: this file is committed to git.
  const tmdbKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!tmdbKey) {
    return response.status(500).json({ error: 'TMDB API key not configured on server' });
  }

  try {
    const { status, data } = await fetchTmdb(path, queryParams, tmdbKey);

    if (status >= 200 && status < 300) {
      CACHE.set(cacheKey, { time: Date.now(), data });
      response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    }

    return response.status(status).json(data);
  } catch (error) {
    console.error('Error proxying to TMDB:', error);
    return response.status(500).json({ error: 'Failed to fetch from TMDB' });
  }
}
