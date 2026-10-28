import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./helpers/pgdb.js";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchJson, createLimiter, backoffDelay, createCache, cached, CatalogError } from "../src/services/catalog/http.js";
import { normalizeTmdb } from "../src/services/catalog/tmdb.js";
import { normalizeOpenLibrary, normalizeGoogleBook, mergeBooks } from "../src/services/catalog/books.js";
import { normalizeRawg } from "../src/services/catalog/rawg.js";
import { sniffImage, downloadCover, isAllowedCoverUrl } from "../src/services/catalog/covers.js";
import { ocioSchema } from "../src/db/schema/ocio.js";

/** fetch falso que devuelve las respuestas en orden. */
function fakeFetch(responses) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (h) => r.headers?.[h.toLowerCase()] ?? null },
      json: async () => r.body,
      arrayBuffer: async () => r.bytes,
    };
  };
  return { impl, calls };
}
const noWait = () => 0;

test("reintenta ante 429 y 5xx, y no reintenta un 404", async () => {
  const f = fakeFetch([{ status: 429, headers: { "retry-after": "1" } }, { status: 503 }, { status: 200, body: { ok: 1 } }]);
  assert.deepEqual(await fetchJson("https://x", { source: "t", fetchImpl: f.impl, backoff: noWait }), { ok: 1 });
  assert.equal(f.calls.length, 3);

  const g = fakeFetch([{ status: 404 }, { status: 200, body: {} }]);
  await assert.rejects(fetchJson("https://x", { source: "t", fetchImpl: g.impl, backoff: noWait }), (e) => e instanceof CatalogError && e.status === 404);
  assert.equal(g.calls.length, 1);

  const h = fakeFetch([new Error("ECONNRESET"), new Error("x"), new Error("x"), new Error("x")]);
  await assert.rejects(fetchJson("https://x", { source: "t", fetchImpl: h.impl, backoff: noWait }), (e) => e.status === 0);
  assert.equal(h.calls.length, 4, "1 intento + 3 reintentos");
});

test("espera: respeta Retry-After y si no, crece exponencialmente", () => {
  assert.equal(backoffDelay(0, "2"), 2000);
  assert.equal(backoffDelay(0, "999"), 10_000, "con tope");
  const d0 = backoffDelay(0);
  const d2 = backoffDelay(2);
  assert.ok(d0 >= 500 && d0 < 700);
  assert.ok(d2 >= 2000 && d2 < 2200);
});

test("el limitador hace un pedido por vez con espacio mínimo entre pedidos", async () => {
  const limit = createLimiter(30);
  const starts = [];
  await Promise.all([1, 2, 3].map(() => limit(async () => starts.push(Date.now()))));
  assert.equal(starts.length, 3);
  assert.ok(starts[1] - starts[0] >= 25 && starts[2] - starts[1] >= 25);
});

test("caché: sirve lo guardado y, sin red, lo vencido", async () => {
  const db = await testDb();
  const cache = createCache(db);
  let calls = 0;
  const load = async () => (++calls, { v: calls });
  assert.deepEqual(await cached(cache, "k", 60_000, load), { v: 1 });
  assert.deepEqual(await cached(cache, "k", 60_000, load), { v: 1 }, "no vuelve a pedir");
  // Vencido + la red falla → devuelve lo viejo en vez de romper.
  assert.deepEqual(await cached(cache, "k", -1, async () => Promise.reject(new CatalogError("t", 0))), { v: 1 });
  await assert.rejects(cached(cache, "otra", 60_000, async () => Promise.reject(new CatalogError("t", 0))));
});

test("TMDB: película con director y duración; serie con creadores y temporadas", () => {
  const movie = normalizeTmdb(
    { id: 438631, title: "Dune", original_title: "Dune", release_date: "2021-09-15", poster_path: "/d5.jpg", genres: [{ name: "Ciencia ficción" }, { name: "Aventura" }], runtime: 155, credits: { crew: [{ job: "Director", name: "Denis Villeneuve" }, { job: "Writer", name: "X" }] } },
    "movie",
    { genres: [{ name: "Ciencia ficción" }, { name: "Aventura" }], runtime: 155, credits: { crew: [{ job: "Director", name: "Denis Villeneuve" }] } }
  );
  assert.equal(movie.externalId, "438631");
  assert.deepEqual(movie.creators, ["Denis Villeneuve"]);
  assert.equal(movie.year, 2021);
  assert.deepEqual(movie.genres, ["ciencia_ficcion", "aventura"]);
  assert.equal(movie.extra.runtime, 155);
  assert.equal(movie.cover, "https://image.tmdb.org/t/p/w500/d5.jpg");

  const series = normalizeTmdb({ id: 95396, name: "Ruptura", original_name: "Severance", first_air_date: "2022-02-17", genre_ids: [18, 9648, 10765] }, "series");
  assert.equal(series.title, "Ruptura");
  assert.equal(series.originalTitle, "Severance");
  // TMDB agrupa "Sci-Fi & Fantasy" en un solo género de series: se traduce a los dos propios.
  assert.deepEqual(series.genres, ["drama", "misterio", "ciencia_ficcion", "fantasia"]);
});

test("libros: Open Library + Google Books se combinan en un resultado", () => {
  const ol = [
    normalizeOpenLibrary({ key: "/works/OL1168007W", title: "Nineteen Eighty-Four", author_name: ["George Orwell"], first_publish_year: 1949, cover_i: 153541, subject: ["Dystopias", "Totalitarianism", "Fiction"] }),
    normalizeOpenLibrary({ key: "/works/OL64468W", title: "Brave New World", author_name: ["Aldous Huxley"], first_publish_year: 1932 }),
  ];
  const gb = [
    normalizeGoogleBook({ id: "kotPYEqx7kMC", volumeInfo: { title: "Nineteen Eighty-Four", authors: ["George Orwell"], publishedDate: "2013", pageCount: 328, imageLinks: { thumbnail: "http://books.google.com/x&edge=curl" } } }),
    normalizeGoogleBook({ id: "solo-gb", volumeInfo: { title: "Un mundo feliz", authors: ["Aldous Huxley"], publishedDate: "2014-01-01", pageCount: 256 } }),
  ];
  const merged = mergeBooks(ol, gb);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].externalSource, "openlibrary");
  assert.equal(merged[0].externalId, "OL1168007W");
  assert.equal(merged[0].extra.pages, 328, "las páginas vienen de Google Books");
  assert.equal(merged[0].cover, "https://covers.openlibrary.org/b/id/153541-L.jpg");
  assert.deepEqual(merged[0].alsoIn, { googlebooks: "kotPYEqx7kMC" });
  assert.deepEqual(merged[0].genres, ["distopia"]);
  assert.equal(merged[2].externalSource, "googlebooks", "lo que solo está en Google Books va al final");
  assert.equal(gb[0].cover, "https://books.google.com/x");
});

test("RAWG: juego con estudio, plataformas y géneros propios", () => {
  const g = normalizeRawg(
    { id: 28154, name: "Disco Elysium", released: "2019-10-15", background_image: "https://media.rawg.io/x.jpg", genres: [{ name: "RPG" }, { name: "Adventure" }], platforms: [{ platform: { name: "PC" } }, { platform: { name: "Nintendo Switch" } }] },
    { developers: [{ name: "ZA/UM" }], description_raw: "..." }
  );
  assert.deepEqual(g.creators, ["ZA/UM"]);
  assert.deepEqual(g.genres, ["rpg", "aventura"]);
  assert.deepEqual(g.extra.platforms, ["PC", "Nintendo Switch"]);
  assert.equal(g.year, 2019);
});

test("portadas: valida que sea una imagen y la guarda en disco", async () => {
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2])), "jpg");
  assert.equal(sniffImage(Buffer.from("<html>no</html>")), null);
  const dir = mkdtempSync(join(tmpdir(), "covers-"));
  try {
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
    const ok = fakeFetch([{ status: 200, bytes: jpg }]);
    const name = await downloadCover("https://image.tmdb.org/t/p/w500/c.jpg", 42, dir, { fetchImpl: ok.impl });
    assert.match(name, /^42-[0-9a-f]{10}\.jpg$/);
    assert.deepEqual(readdirSync(dir), [name]);
    const html = fakeFetch([{ status: 200, bytes: Buffer.from("<!doctype html>") }]);
    assert.equal(await downloadCover("https://image.tmdb.org/t/p/w500/c.jpg", 43, dir, { fetchImpl: html.impl }), null, "un HTML no se guarda");
    const pixel = fakeFetch([{ status: 200, bytes: Buffer.from("GIF89a" + "x".repeat(30)) }]);
    assert.equal(await downloadCover("https://covers.openlibrary.org/b/id/1-L.jpg", 44, dir, { fetchImpl: pixel.impl }), null, "el GIF de 1x1 de 'sin portada' no sirve");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("portadas: solo de los catálogos y por HTTPS (nada de la red local), también tras redirecciones", async () => {
  for (const ok of ["https://image.tmdb.org/t/p/w500/a.jpg", "https://covers.openlibrary.org/b/id/1-L.jpg", "https://ia800.us.archive.org/x.jpg", "https://books.google.com/books/content?id=1", "https://media.rawg.io/media/g.jpg"]) assert.ok(isAllowedCoverUrl(ok), ok);
  for (const bad of ["http://image.tmdb.org/a.jpg", "https://localhost/a.jpg", "https://192.168.0.1/a.jpg", "https://169.254.169.254/latest", "https://image.tmdb.org.evil.com/a.jpg", "https://evilarchive.org/a.jpg", "https://user:pw@image.tmdb.org/a.jpg", "https://image.tmdb.org:8080/a.jpg", "file:///C:/x.jpg", "nada"]) assert.equal(isAllowedCoverUrl(bad), false, bad);
  const dir = mkdtempSync(join(tmpdir(), "covers-"));
  try {
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
    const local = fakeFetch([]);
    assert.equal(await downloadCover("https://127.0.0.1/admin", 1, dir, { fetchImpl: local.impl }), null);
    assert.equal(local.calls.length, 0, "ni siquiera hace el pedido");
    const viaArchive = fakeFetch([{ status: 302, headers: { location: "https://ia600.us.archive.org/c.jpg" } }, { status: 200, bytes: jpg }]);
    assert.match(await downloadCover("https://covers.openlibrary.org/b/id/1-L.jpg", 2, dir, { fetchImpl: viaArchive.impl }), /^2-/, "sigue la redirección de Open Library");
    const sneaky = fakeFetch([{ status: 302, headers: { location: "http://192.168.0.1/router" } }, { status: 200, bytes: jpg }]);
    assert.equal(await downloadCover("https://image.tmdb.org/t/p/w500/a.jpg", 3, dir, { fetchImpl: sneaky.impl }), null);
    assert.equal(sneaky.calls.length, 1, "no sigue una redirección a la red local");
    const huge = fakeFetch([{ status: 200, headers: { "content-length": String(50 * 1024 * 1024) }, bytes: jpg }]);
    assert.equal(await downloadCover("https://image.tmdb.org/t/p/w500/a.jpg", 4, dir, { fetchImpl: huge.impl }), null, "muy pesada");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Open Library: usa el título y la portada de la edición en español", () => {
  const b = normalizeOpenLibrary({
    key: "/works/OL64365W",
    title: "Brave New World",
    author_name: ["Aldous Huxley"],
    first_publish_year: 1932,
    cover_i: 1,
    editions: { docs: [{ title: "Un mundo feliz.", language: ["spa"], cover_i: 15170720 }] },
  });
  assert.equal(b.title, "Un mundo feliz");
  assert.equal(b.originalTitle, "Brave New World");
  assert.equal(b.cover, "https://covers.openlibrary.org/b/id/15170720-L.jpg");
});
