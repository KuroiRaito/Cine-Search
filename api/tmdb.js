export default async function handler(req, res) {
  const { path, ...queryParams } = req.query;

  if (!path) {
    return res.status(400).json({ error: "Missing 'path' query parameter" });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "TMDB_API_KEY is not configured" });
  }

  const params = new URLSearchParams(queryParams);
  params.set("api_key", apiKey);

  const url = `https://api.themoviedb.org/3/${path}?${params.toString()}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch from TMDB" });
  }
}
