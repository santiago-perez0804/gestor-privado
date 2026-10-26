// RAWG: videojuegos (key gratuita: RAWG_API_KEY). El adaptador expone la misma interfaz que los
// demás, así cambiar a IGDB más adelante es reemplazar este archivo.
import { fetchJson, createLimiter, cached } from "./http.js";
import { mapGenres } from "../../lib/ocio/genres.js";

const BASE = "https://api.rawg.io/api";
const DAY = 86_400_000;
const limiter = createLimiter(250);

export const rawgConfigured = () => !!process.env.RAWG_API_KEY;

function request(path, params = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set("key", process.env.RAWG_API_KEY);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  return fetchJson(url, { source: "rawg", limiter, retries: 2 });
}

export function normalizeRawg(raw, details = null) {
  return {
    externalSource: "rawg",
    externalId: String(raw.id),
    type: "game",
    title: raw.name,
    originalTitle: null,
    creators: (details?.developers || []).map((d) => d.name),
    year: raw.released ? Number(raw.released.slice(0, 4)) || null : null,
    genres: mapGenres([...(raw.genres || []).map((g) => g.name), ...(raw.tags || []).filter((t) => t.language === "eng").slice(0, 6).map((t) => t.name)]),
    extra: { platforms: (raw.platforms || raw.parent_platforms || []).map((p) => p.platform?.name).filter(Boolean).slice(0, 5) },
    cover: raw.background_image || null,
    overview: details?.description_raw || null,
  };
}

export function rawgDetails(cache, id) {
  return cached(cache, `rawg:details:${id}`, 30 * DAY, async () => {
    const d = await request(`/games/${id}`);
    return normalizeRawg(d, d);
  });
}

export async function gameSearch(cache, query, { enrich = 4 } = {}) {
  const results = await cached(cache, `rawg:search:${query.toLowerCase()}`, 7 * DAY, async () => {
    const r = await request("/games", { search: query, page_size: 10, search_precise: "true" });
    return (r.results || []).map((x) => normalizeRawg(x));
  });
  return Promise.all(results.map((r, i) => (i < enrich ? rawgDetails(cache, r.externalId).catch(() => r) : r)));
}
