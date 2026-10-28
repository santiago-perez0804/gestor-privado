// TMDB: películas y series. Títulos y sinopsis en español (es-AR, con es-ES de respaldo).
// Auth: TMDB_READ_TOKEN (v4, recomendado) o TMDB_API_KEY (v3).
import { fetchJson, createLimiter, cached } from "./http.js";
import { mapGenres } from "../../lib/ocio/genres.js";

const BASE = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p/w500";
const limiter = createLimiter(40); // ~25 pedidos/s, bien por debajo del límite de TMDB
const DAY = 86_400_000;

// Géneros de TMDB por id (los de películas y los de series) → nombre en inglés; después se
// traducen a la lista propia con mapGenres.
const TMDB_GENRES = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama",
  10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Science Fiction", 53: "Thriller", 10752: "War", 37: "Western", 10759: "Action & Adventure", 10762: "Kids",
  10765: "Sci-Fi & Fantasy", 10768: "War & Politics",
};

export const tmdbConfigured = () => !!(process.env.TMDB_READ_TOKEN || process.env.TMDB_API_KEY);

async function request(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const headers = {};
  if (process.env.TMDB_READ_TOKEN) headers.Authorization = `Bearer ${process.env.TMDB_READ_TOKEN}`;
  else url.searchParams.set("api_key", process.env.TMDB_API_KEY);
  return await fetchJson(url, { source: "tmdb", limiter, headers, retries: 2 });
}

const yearOf = (date) => (date ? Number(String(date).slice(0, 4)) || null : null);

/** Resultado de búsqueda o detalle de TMDB → forma normalizada. */
export function normalizeTmdb(raw, type, details = null) {
  const isMovie = type === "movie";
  const genreNames = details?.genres?.map((g) => g.name) ?? (raw.genre_ids || []).map((id) => TMDB_GENRES[id]).filter(Boolean);
  const creators = details
    ? isMovie
      ? (details.credits?.crew || []).filter((c) => c.job === "Director").map((c) => c.name)
      : (details.created_by || []).map((c) => c.name)
    : [];
  return {
    externalSource: "tmdb",
    externalId: String(raw.id),
    type,
    title: (isMovie ? raw.title : raw.name) || (isMovie ? raw.original_title : raw.original_name),
    originalTitle: isMovie ? raw.original_title : raw.original_name,
    creators,
    year: yearOf(isMovie ? raw.release_date : raw.first_air_date),
    genres: mapGenres(genreNames),
    extra: isMovie ? { runtime: details?.runtime || null } : { seasons: details?.number_of_seasons || null, episodes: details?.number_of_episodes || null },
    cover: raw.poster_path ? IMAGE + raw.poster_path : null,
    overview: details?.overview || raw.overview || null,
  };
}

/** Detalle (director o creadores, duración, temporadas). Cacheado 30 días. */
export async function tmdbDetails(cache, type, id) {
  const kind = type === "movie" ? "movie" : "tv";
  return await cached(cache, `tmdb:details:${kind}:${id}`, 30 * DAY, async () => {
    let d = await request(`/${kind}/${id}`, { language: "es-AR", append_to_response: kind === "movie" ? "credits" : undefined });
    if (!d.overview) {
      const es = await request(`/${kind}/${id}`, { language: "es-ES" }).catch(() => null);
      if (es?.overview) d = { ...d, overview: es.overview };
    }
    return normalizeTmdb(d, type, d);
  });
}

/**
 * Busca películas o series. Los primeros resultados se completan con el detalle
 * (para mostrar director y duración en la lista).
 */
export async function tmdbSearch(cache, type, query, { enrich = 5 } = {}) {
  const kind = type === "movie" ? "movie" : "tv";
  const results = await cached(cache, `tmdb:search:${kind}:${query.toLowerCase()}`, 7 * DAY, async () => {
    const r = await request(`/search/${kind}`, { query, language: "es-AR", include_adult: "false" });
    return (r.results || []).slice(0, 12).map((x) => normalizeTmdb(x, type));
  });
  return Promise.all(results.map(async (r, i) => (i < enrich ? tmdbDetails(cache, type, r.externalId).catch(() => r) : r)));
}
