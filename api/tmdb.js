const CACHE = new Map();
const TTL = 60 * 1000;

export default async function handler(request, response) {
  const { path, ...queryParams } = request.query;

  if (!path) {
    return response.status(400).json({ error: 'Missing path parameter' });
  }

  const cacheKey = path + '?' + new URLSearchParams(queryParams).toString();
  const cached = CACHE.get(cacheKey);

  if (cached && Date.now() - cached.time < TTL) {
    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return response.status(200).json(cached.data);
  }

  const tmdbKey = process.env.VITE_TMDB_API_KEY;
  if (!tmdbKey) {
    return response.status(500).json({ error: 'TMDB API key not configured on server' });
  }

  try {
    const params = new URLSearchParams({
      api_key: tmdbKey,
      ...queryParams
    });

    const tmdbUrl = `https://api.themoviedb.org/3${path}?${params.toString()}`;

    const res = await fetch(tmdbUrl);
    const data = await res.json();

    if (res.ok) {
      CACHE.set(cacheKey, { time: Date.now(), data });
      response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    }

    return response.status(res.status).json(data);
  } catch (error) {
    console.error('Error proxying to TMDB:', error);
    return response.status(500).json({ error: 'Failed to fetch from TMDB' });
  }
}
