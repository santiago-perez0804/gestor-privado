// Libros: Open Library (sin key) + Google Books (key opcional; suele tener mejores datos de
// ediciones en español). Se combinan: misma obra (título + primer autor) = un solo resultado,
// tomando lo mejor de cada fuente.
import { fetchJson, createLimiter, cached } from "./http.js";
import { mapGenres } from "../../lib/ocio/genres.js";

const DAY = 86_400_000;
const olLimiter = createLimiter(350); // Open Library pide moderación
const gbLimiter = createLimiter(100);

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const googleBooksConfigured = () => !!process.env.GOOGLE_BOOKS_API_KEY;

// Sin key, la cuota anónima de Google Books está casi siempre agotada (429): solo se usa con key.
// Si responde 429/403 (cuota del día), se pausa una hora en vez de reintentar en cada búsqueda.
let googlePausedUntil = 0;

function userAgent() {
  const contact = process.env.OPENLIBRARY_CONTACT;
  return `GestorSapo/1.0 (app personal${contact ? `; ${contact}` : ""})`;
}

/** "Un mundo feliz." → "Un mundo feliz" (las ediciones a veces traen el punto final del catálogo). */
const cleanTitle = (t) => String(t || "").trim().replace(/[.;:,]+$/, "");

/**
 * Obra de Open Library. Con `lang=es`, `editions` trae la edición en español que mejor coincide:
 * de ahí salen el título y la portada (y el título de la obra queda como original).
 */
export function normalizeOpenLibrary(doc) {
  const edition = doc.editions?.docs?.[0];
  const spanishTitle = edition?.title && (!edition.language || edition.language.includes("spa")) ? cleanTitle(edition.title) : null;
  const coverId = edition?.cover_i || doc.cover_i;
  return {
    externalSource: "openlibrary",
    externalId: String(doc.key || "").replace("/works/", ""),
    type: "book",
    title: spanishTitle || cleanTitle(doc.title),
    originalTitle: spanishTitle && spanishTitle !== cleanTitle(doc.title) ? cleanTitle(doc.title) : null,
    creators: doc.author_name || [],
    year: doc.first_publish_year || null,
    genres: mapGenres(doc.subject || []),
    extra: { pages: doc.number_of_pages_median || null },
    cover: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
    overview: null,
  };
}

export function normalizeGoogleBook(item) {
  const v = item.volumeInfo || {};
  const thumb = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail;
  return {
    externalSource: "googlebooks",
    externalId: item.id,
    type: "book",
    title: v.subtitle && v.title.length < 25 ? `${v.title}: ${v.subtitle}` : v.title,
    originalTitle: null,
    creators: v.authors || [],
    year: v.publishedDate ? Number(v.publishedDate.slice(0, 4)) || null : null,
    genres: mapGenres(v.categories || []),
    extra: { pages: v.pageCount || null },
    cover: thumb ? thumb.replace(/^http:/, "https:").replace("&edge=curl", "") : null,
    overview: v.description || null,
    language: v.language || null,
  };
}

async function searchOpenLibrary(cache, query) {
  return cached(cache, `ol:search:es:${query.toLowerCase()}`, 7 * DAY, async () => {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "10");
    url.searchParams.set("lang", "es"); // prioriza ediciones en español
    url.searchParams.set("fields", "key,title,author_name,first_publish_year,number_of_pages_median,cover_i,subject,editions,editions.title,editions.language,editions.cover_i");
    // Open Library a veces tarda bastante (2–20 s): timeout amplio y un solo reintento.
    const r = await fetchJson(url, { source: "openlibrary", limiter: olLimiter, headers: { "User-Agent": userAgent() }, timeoutMs: 12_000, retries: 1 });
    return (r.docs || []).map(normalizeOpenLibrary).filter((b) => b.title);
  });
}

async function searchGoogleBooks(cache, query) {
  if (!googleBooksConfigured() || Date.now() < googlePausedUntil) return [];
  return cached(cache, `gb:search:${query.toLowerCase()}`, 7 * DAY, async () => {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", "10");
    url.searchParams.set("printType", "books");
    url.searchParams.set("langRestrict", "es");
    if (process.env.GOOGLE_BOOKS_API_KEY) url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
    const r = await fetchJson(url, { source: "googlebooks", limiter: gbLimiter, timeoutMs: 6000, retries: 0 }).catch((err) => {
      if (err.status === 429 || err.status === 403) googlePausedUntil = Date.now() + 3_600_000;
      throw err;
    });
    return (r.items || []).map(normalizeGoogleBook).filter((b) => b.title);
  });
}

/**
 * Combina resultados de las dos fuentes. Prioridad: el orden de Open Library (mejor ranking de
 * "obras"); de Google Books se toma el título en español, las páginas, la sinopsis y la portada si
 * faltan. Lo que solo está en Google Books se agrega al final.
 */
export function mergeBooks(ol, gb) {
  const key = (b) => `${norm(b.title).split(" ").slice(0, 4).join(" ")}|${norm(b.creators[0]).split(" ").at(-1) || ""}`;
  const gbByKey = new Map(gb.map((b) => [key(b), b]));
  const used = new Set();
  const merged = ol.map((o) => {
    const g = gbByKey.get(key(o));
    if (!g) return o;
    used.add(g.externalId);
    return {
      ...o,
      genres: o.genres.length ? o.genres : g.genres,
      extra: { pages: g.extra.pages || o.extra.pages },
      cover: o.cover || g.cover,
      overview: g.overview,
      alsoIn: { googlebooks: g.externalId },
    };
  });
  return [...merged, ...gb.filter((g) => !used.has(g.externalId))].slice(0, 12);
}

/** Busca en las dos fuentes; si una falla, sigue con la otra. */
export async function bookSearch(cache, query) {
  const [ol, gb] = await Promise.allSettled([searchOpenLibrary(cache, query), searchGoogleBooks(cache, query)]);
  if (ol.status === "rejected" && gb.status === "rejected") throw ol.reason;
  const errors = [ol, gb].filter((r) => r.status === "rejected").map((r) => r.reason.source);
  return { results: mergeBooks(ol.value || [], gb.value || []), errors };
}
