// Búsqueda en catálogos externos con una interfaz común:
//   catalogSearch(type, query) → { results: CatalogResult[], configured, errors }
//   catalogDetails(type, source, id) → CatalogResult
// CatalogResult = { externalSource, externalId, type, title, originalTitle, creators[], year,
//                   genres[] (ids propios), extra {pages|runtime|seasons|platforms}, cover, overview }
import { createCache } from "./http.js";
import { tmdbSearch, tmdbDetails, tmdbConfigured } from "./tmdb.js";
import { bookSearch, googleBooksConfigured } from "./books.js";
import { gameSearch, rawgDetails, rawgConfigured } from "./rawg.js";

/** Qué fuentes están disponibles (las que necesitan key, solo si está en el .env). */
export function catalogStatus() {
  return { movie: tmdbConfigured(), series: tmdbConfigured(), book: true, game: rawgConfigured(), googleBooks: googleBooksConfigured() };
}

const MISSING_KEY = { movie: "TMDB_READ_TOKEN", series: "TMDB_READ_TOKEN", game: "RAWG_API_KEY" };

export function createCatalog(db) {
  const cache = createCache(db);

  async function catalogSearch(type, query) {
    if (!(type in catalogStatus()) || type === "googleBooks") throw Object.assign(new Error("invalid_type"), { status: 400 });
    const q = String(query || "").trim();
    if (q.length < 2) return { results: [], configured: true, errors: [] };
    if (!catalogStatus()[type]) return { results: [], configured: false, missingKey: MISSING_KEY[type], errors: [] };
    if (type === "movie" || type === "series") return { results: await tmdbSearch(cache, type, q), configured: true, errors: [] };
    if (type === "game") return { results: await gameSearch(cache, q), configured: true, errors: [] };
    if (type === "book") {
      const { results, errors } = await bookSearch(cache, q);
      return { results, configured: true, errors };
    }
    throw Object.assign(new Error("invalid_type"), { status: 400 });
  }

  async function catalogDetails(type, source, id) {
    if (source === "tmdb") return tmdbDetails(cache, type, id);
    if (source === "rawg") return rawgDetails(cache, id);
    return null; // libros: la búsqueda ya trae todo
  }

  return { catalogSearch, catalogDetails };
}
