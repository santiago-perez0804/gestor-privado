// Pruebas de integración de la API: levanta el server de verdad (otro puerto, carpeta de datos
// temporal, sin .env) y recorre los flujos por HTTP.
//
//   npm run test:integration                        → base vacía
//   IT_DB=data/fisico.db npm run test:integration   → sobre una COPIA de esa base (no la toca)
//   IT_NETWORK=1 …                                  → incluye la búsqueda en Open Library (internet)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { deflateSync, crc32 } from "node:zlib";

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = `http://localhost:${PORT}`;
const year = new Date().getFullYear();
const pad = (n) => String(n).padStart(2, "0");
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

let dataDir;
let server;
let log = "";

async function api(method, path, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(BASE + path, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

/** PNG RGBA de w×h (para probar la galería con imágenes reales). */
function makePng(w, h, color = () => [80, 170, 90, 255]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(color(x, y), y * (w * 4 + 1) + 1 + x * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "gestor-it-"));
  if (process.env.IT_DB) {
    const src = new DatabaseSync(resolve(SERVER_DIR, process.env.IT_DB), { readOnly: true });
    src.exec(`VACUUM INTO '${join(dataDir, "fisico.db").replaceAll("\\", "/").replaceAll("'", "''")}'`);
    src.close();
    // Que la copia no pueda hablar con cuentas reales (Instagram, Google).
    const copy = new DatabaseSync(join(dataDir, "fisico.db"));
    try {
      copy.exec("UPDATE projects SET accessToken = 'it-disabled' WHERE accessToken IS NOT NULL");
      copy.exec("DELETE FROM google_account");
    } catch {
      // tablas que todavía no existen en esa base
    }
    copy.close();
  }
  server = spawn(process.execPath, ["src/index.js"], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(PORT), ENV_FILE: join(dataDir, "no.env"), AUTH_USER: "", AUTH_PASS: "", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", TMDB_READ_TOKEN: "", TMDB_API_KEY: "", RAWG_API_KEY: "", GOOGLE_BOOKS_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 100; i++) {
    if (log.includes("escuchando")) return;
    if (server.exitCode != null) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`El server no arrancó:\n${log}`);
});

after(() => {
  server?.kill();
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // Windows a veces tarda en soltar el archivo de la base
  }
});

test("todas las pantallas de lectura responden (los 4 módulos)", async () => {
  const paths = [
    "/api/weights", "/api/plans", "/api/exercise-logs", "/api/exercise-logs/records", "/api/body-measurements", "/api/progress-photos",
    "/api/expenses", "/api/recurring-expenses", "/api/budgets", "/api/incomes", "/api/recurring-incomes", "/api/accounts", "/api/account-snapshots", "/api/debts", "/api/savings-goals",
    "/api/projects", "/api/certificates", "/api/settings",
    "/api/ocio/genres", "/api/ocio/counts", "/api/ocio/home", `/api/ocio/home?year=${year - 1}`, "/api/ocio/library", `/api/ocio/goals/${year}`,
    "/api/ocio/stats", "/api/ocio/stats?type=movie", "/api/ocio/stats?type=series", "/api/ocio/stats?type=book", "/api/ocio/stats?type=game", `/api/ocio/wrapped?year=${year}`, `/api/ocio/wrapped?year=${year - 1}`,
    "/api/outings", "/api/outings/summary", "/api/catalog/status", "/api/google/status", "/api/google/log", "/api/ocio/koreader/status", "/api/ocio/artworks", "/api/ocio/easel", "/api/export",
  ];
  const bad = [];
  for (const p of paths) {
    const r = await api("GET", p);
    if (r.status !== 200) bad.push(`${p} → ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  }
  assert.deepEqual(bad, []);
});

test("biblioteca: alta, duplicado, terminar, releer, reseña, subrayado, meta, estadísticas y borrar", async () => {
  const before = (await api("GET", "/api/ocio/stats?type=movie")).data.finished;
  const add = await api("POST", "/api/ocio/library", { work: { type: "movie", title: "Prueba de Integración", originalTitle: "Integration Test", creators: ["Directora X"], year: 2024, genres: ["drama"], metadata: { runtime: 100 } }, entry: { status: "want" } });
  assert.equal(add.status, 201);
  const id = add.data.item.id;
  const workId = add.data.item.workId;

  const dup = await api("GET", `/api/ocio/library/duplicate?type=movie&title=${encodeURIComponent("prueba de integracion")}&year=2024&creators=Directora%20X`);
  assert.equal(dup.data.item?.id, id, "lo encuentra aunque cambien tildes y mayúsculas");
  const again = await api("POST", "/api/ocio/library", { work: { type: "movie", title: "Prueba de Integración", year: 2024, creators: ["Directora X"] }, entry: {} });
  assert.equal(again.data.item.id, id, "el mismo título no crea otra obra");

  const done = await api("PUT", `/api/ocio/library/${id}`, { status: "done", statusDate: today, rating: 4.5 });
  assert.equal(done.status, 200);
  assert.equal(done.data.status, "done");
  assert.equal(done.data.rating, 4.5);
  const s1 = await api("GET", "/api/ocio/stats?type=movie");
  assert.equal(s1.data.finished, before + 1, "las estadísticas se recalculan al cambiar los datos");

  const re = await api("POST", `/api/ocio/library/${id}/reread`, {});
  assert.equal(re.status, 200);
  assert.equal(re.data.status, "in_progress");
  const detail = (await api("GET", `/api/ocio/library/${id}`)).data;
  assert.equal(detail.passes.length, 2);
  const pass = await api("PUT", `/api/ocio/passes/${detail.item.currentPass.id}`, { progress: { unit: "minute", current: 30, total: 100 } });
  assert.equal(pass.status, 200);

  assert.equal((await api("POST", `/api/ocio/library/${id}/reviews`, { text: "  " })).status, 400);
  const review = await api("POST", `/api/ocio/library/${id}/reviews`, { text: "Muy buena", hasSpoilers: false });
  assert.equal(review.status, 201);
  assert.equal((await api("PUT", `/api/ocio/reviews/${review.data.id}`, { text: "Buenísima" })).status, 200);
  assert.equal((await api("DELETE", `/api/ocio/reviews/${review.data.id}`)).status, 204);

  const hl = await api("POST", `/api/ocio/works/${workId}/highlights`, { text: "Una frase" });
  assert.equal(hl.status, 201);
  assert.equal((await api("DELETE", `/api/ocio/highlights/${hl.data.id}`)).status, 204);

  const goal = await api("PUT", `/api/ocio/goals/${year}/movie`, { target: 30 });
  assert.equal(goal.status, 200);
  assert.ok((await api("GET", `/api/ocio/goals/${year}`)).data.some((g) => g.type === "movie" && g.target === 30));

  const wrapped = (await api("GET", `/api/ocio/wrapped?year=${year}`)).data;
  assert.ok(wrapped.totalFinished >= 1);

  assert.equal((await api("POST", "/api/ocio/library", { work: { type: "comic", title: "X" } })).status, 400);
  assert.equal((await api("POST", "/api/ocio/library", {})).data.error, "work_required");
  assert.equal((await api("PUT", `/api/ocio/library/${id}`, { rating: 7 })).data.error, "invalid_rating");
  assert.equal((await api("POST", "/api/ocio/library/999999/reviews", { text: "hola" })).status, 404);
  assert.equal((await api("POST", "/api/ocio/works/999999/highlights", { text: "hola" })).status, 404);
  assert.equal((await api("PUT", `/api/ocio/goals/${year}/comic`, { target: 3 })).status, 400);
  const badJson = await fetch(BASE + "/api/ocio/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{ no es json" });
  assert.equal(badJson.status, 400, "JSON roto: 400");
  assert.equal((await api("DELETE", `/api/ocio/library/${id}`)).status, 204);
  assert.equal((await api("GET", `/api/ocio/library/${id}`)).status, 404);
  assert.equal((await api("GET", "/api/ocio/stats?type=movie")).data.finished, before);
});

test("salidas: carga rápida, alta, vínculo con un gasto, sugerencia y borrado", async () => {
  const parsed = await api("POST", "/api/outings/parse", { text: "recital de Fito el sábado a las 21 en el Movistar con Juan" });
  assert.equal(parsed.status, 200);
  assert.equal(parsed.data.category, "musica");
  assert.equal(parsed.data.startTime, "21:00");

  assert.equal((await api("POST", "/api/outings", { date: today })).status, 400, "sin título no");
  assert.equal((await api("POST", "/api/outings", { title: "x", date: "2026-13-45" })).data.error, "invalid_date");
  assert.equal((await api("POST", "/api/outings", { title: "x", date: "2026-02-30" })).data.error, "invalid_date");
  assert.equal((await api("POST", "/api/outings", { title: "x", date: today, startTime: "25:99" })).data.error, "invalid_startTime");
  const o = await api("POST", "/api/outings", { title: "Feria del Libro integración", date: today, category: "cultura", status: "confirmed" });
  assert.equal(o.status, 201);
  const id = o.data.id;
  assert.equal((await api("PUT", `/api/outings/${id}`, { status: "attended", place: "La Rural" })).data.place, "La Rural");

  assert.equal((await api("POST", "/api/expenses", { title: "X", amount: 1, date: today, paymentMethod: "efectivo" })).status, 400, "dato inválido: 400, no 500");
  const exp = await api("POST", "/api/expenses", { title: "Entrada feria del libro", amount: 5000, date: today, category: "ocio", paymentMethod: "debito" });
  assert.equal(exp.status, 201);
  const expenseId = exp.data.id;
  const suggest = await api("GET", `/api/outings/suggest?date=${today}&title=${encodeURIComponent("Entrada feria del libro")}&expenseId=${expenseId}`);
  assert.ok(suggest.data.some((s) => s.id === id), "el gasto sugiere la salida");
  const candidates = await api("GET", `/api/outings/${id}/expense-candidates`);
  assert.ok(candidates.data.some((e) => e.id === expenseId));

  assert.equal((await api("POST", `/api/outings/${id}/expenses`, { expenseId })).status, 201);
  const linked = await api("GET", `/api/outings/${id}/expenses`);
  assert.equal(linked.data.length, 1);
  const list = (await api("GET", `/api/outings?month=${today.slice(0, 7)}`)).data;
  assert.equal(list.find((x) => x.id === id)?.spent, 5000, "la salida suma lo gastado");
  assert.equal((await api("DELETE", `/api/outings/${id}/expenses/${expenseId}`)).status, 200);

  assert.equal((await api("DELETE", `/api/outings/${id}`)).status, 204);
  assert.equal((await api("DELETE", `/api/expenses/${expenseId}`)).status, 204);
  assert.ok(!(await api("GET", "/api/outings")).data.some((x) => x.id === id));
});

test("Google sin configurar: avisa y no se cuelga", async () => {
  const status = (await api("GET", "/api/google/status")).data;
  assert.equal(status.configured, false);
  const auth = await api("GET", "/api/google/auth");
  assert.equal(auth.status, 400);
  assert.equal(auth.data.error, "google_not_configured");
  assert.equal((await api("POST", "/api/google/sync", {})).status, 409);
});

test("catálogo: sin keys avisa qué falta; consultas cortas no salen a internet", async () => {
  const st = (await api("GET", "/api/catalog/status")).data;
  assert.equal(st.movie, false);
  assert.equal(st.book, true);
  const movie = await api("GET", "/api/catalog/search?type=movie&q=matrix");
  assert.equal(movie.data.configured, false);
  assert.equal(movie.data.missingKey, "TMDB_READ_TOKEN");
  assert.deepEqual((await api("GET", "/api/catalog/search?type=book&q=a")).data.results, []);
  assert.equal((await api("GET", "/api/catalog/search?type=comic&q=batman")).status, 400);
});

test("catálogo: búsqueda real de libros en Open Library", { skip: !process.env.IT_NETWORK && "solo con IT_NETWORK=1", timeout: 60_000 }, async () => {
  const r = await api("GET", "/api/catalog/search?type=book&q=rayuela%20cortazar");
  assert.ok([200, 502].includes(r.status), `status ${r.status}`);
  if (r.status === 200) assert.ok(r.data.results.length > 0 && r.data.results.every((x) => x.title && x.externalId));
});

test("KOReader: vista previa, importación idempotente y estadísticas de lectura", async () => {
  // Libro que ya está en la biblioteca: tiene que vincularse solo.
  const lib = await api("POST", "/api/ocio/library", { work: { type: "book", title: "El Libro de Integración", creators: ["Autora Y"], metadata: { pages: 200 } }, entry: { status: "in_progress" } });
  const workId = lib.data.item.workId;

  const file = join(dataDir, "statistics.sqlite3");
  const k = new DatabaseSync(file);
  k.exec("CREATE TABLE book (id INTEGER PRIMARY KEY, title TEXT, authors TEXT, md5 TEXT, pages INTEGER)");
  k.exec("CREATE TABLE page_stat_data (id_book INTEGER, page INTEGER, start_time INTEGER, duration INTEGER, total_pages INTEGER)");
  k.prepare("INSERT INTO book VALUES (1, 'El Libro de Integración', 'Autora Y', 'md5-uno', 200), (2, 'Otro libro nuevo', 'Autor Z', 'md5-dos', 120)").run();
  const ins = k.prepare("INSERT INTO page_stat_data VALUES (?, ?, ?, ?, 200)");
  const t0 = Math.floor(new Date(year, 0, 10, 22, 0).getTime() / 1000);
  for (let p = 1; p <= 20; p++) ins.run(1, p, t0 + p * 60, 55); // una sesión de ~20 min
  for (let p = 1; p <= 10; p++) ins.run(1, 20 + p, t0 + 86_400 + p * 60, 50); // otra al día siguiente
  for (let p = 1; p <= 5; p++) ins.run(2, p, t0 + 2 * 86_400 + p * 60, 40);
  k.close();

  const upload = async (buf, name) => {
    const fd = new FormData();
    fd.append("file", new Blob([buf]), name);
    return api("POST", "/api/ocio/koreader/preview", fd);
  };
  assert.equal((await upload(Buffer.from("no soy sqlite"), "statistics.sqlite3")).status, 422);
  const preview = await upload(readFileSync(file), "statistics.sqlite3");
  assert.equal(preview.status, 200, JSON.stringify(preview.data));
  const b1 = preview.data.books.find((b) => b.title === "El Libro de Integración");
  const b2 = preview.data.books.find((b) => b.title === "Otro libro nuevo");
  assert.equal(b1.match?.workId, workId, "se vincula solo por título y autor");
  assert.equal(b1.sessionCount, 2);

  const mapping = { [b1.key]: String(workId), [b2.key]: "new" };
  const imp = await api("POST", "/api/ocio/koreader/import", { importId: preview.data.importId, mapping });
  assert.equal(imp.status, 200, JSON.stringify(imp.data));
  assert.equal(imp.data.sessionsNew, 3);
  assert.equal(imp.data.created, 1);
  const again = await api("POST", "/api/ocio/koreader/import", { importId: preview.data.importId, mapping });
  assert.equal(again.data.sessionsNew, 0, "reimportar no duplica");
  assert.equal(again.data.created, 0, "ni crea el libro otra vez");

  const status = (await api("GET", "/api/ocio/koreader/status")).data;
  assert.ok(status.sessions >= 3 && status.lastImportAt);
  const books = (await api("GET", `/api/ocio/stats?type=book&year=${year}`)).data;
  assert.ok(books.reading.pages >= 30 && books.reading.daysWithReading >= 2);
  assert.equal((await api("POST", "/api/ocio/koreader/import", { importId: "../fisico.db", mapping })).status, 404, "no sale de la carpeta de importaciones");
});

test("galería: subir, validar, servir el archivo, ficha, atril y borrar", async () => {
  const send = (buf, name, thumb, fields = {}) => {
    const fd = new FormData();
    fd.append("image", new Blob([buf]), name);
    if (thumb) fd.append("thumb", new Blob([thumb]), "thumb.png");
    for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
    return api("POST", "/api/ocio/artworks", fd);
  };
  const png = makePng(16, 16);
  const a = await send(png, "rana_pixel.png", makePng(8, 8), { technique: "Aseprite", createdOn: today });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  assert.match(a.data.inventoryCode, /^PX-\d{3}$/);
  assert.equal(a.data.width, 16);

  const fake = await send(Buffer.from("<svg onload=alert(1)></svg>"), "trucho.png");
  assert.equal(fake.status, 415);
  assert.equal(fake.data.message, "Solo PNG, JPG o GIF.");
  const huge = await send(Buffer.alloc(21 * 1024 * 1024, 1), "enorme.png");
  assert.equal(huge.status, 413);

  const file = await fetch(BASE + a.data.url);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-type"), "image/png");
  assert.equal(Buffer.from(await file.arrayBuffer()).equals(png), true, "se guarda el original tal cual");
  assert.equal((await fetch(BASE + "/artworks/..%2Ffisico.db")).status, 404);

  const b = await send(makePng(4, 4), "hongo.png");
  assert.equal((await api("PATCH", `/api/ocio/artworks/${b.data.id}`, { inventoryCode: a.data.inventoryCode.toLowerCase() })).status, 409);
  assert.equal((await api("PATCH", `/api/ocio/artworks/${b.data.id}`, { isFavorite: true, title: "Hongo" })).data.isFavorite, true);

  const set = await api("PUT", "/api/ocio/easel/settings", { interval: "daily", order: "favorites", showOnHome: false });
  assert.deepEqual(set.data, { interval: "daily", order: "favorites", showOnHome: false });
  const easel = (await api("GET", "/api/ocio/easel")).data;
  assert.deepEqual(easel.items.map((i) => i.title), ["Hongo"]);
  await api("PUT", "/api/ocio/easel/settings", { interval: "nunca", order: "chronological", showOnHome: true });
  assert.equal((await api("GET", "/api/ocio/easel")).data.settings.interval, "15s", "valor inválido → por defecto");

  assert.ok((await api("GET", "/api/ocio/counts")).data.artworks >= 2);
  for (const x of [a.data, b.data]) assert.equal((await api("DELETE", `/api/ocio/artworks/${x.id}`)).status, 204);
  assert.equal((await fetch(BASE + a.data.url)).status, 404, "el archivo se borró");
  assert.equal(existsSync(join(dataDir, "artworks", a.data.imagePath)), false);
});

test("exportación incluye las tablas nuevas de Ocio", async () => {
  const data = (await api("GET", "/api/export")).data;
  for (const k of ["works", "libraryEntries", "passes", "reviews", "highlights", "readingSessions", "koreaderBooks", "artworks", "ocioGoals", "outings", "outingExpenses"]) assert.ok(Array.isArray(data[k]), `falta ${k} en la exportación`);
  assert.ok(!JSON.stringify(data).includes("refreshToken"), "los tokens de Google no se exportan");
});

test("la app web se sirve en las rutas nuevas (si está compilada)", { skip: !existsSync(join(SERVER_DIR, "..", "web", "dist", "index.html")) && "web sin compilar" }, async () => {
  for (const p of ["/ocio/galeria", "/ocio/estadisticas", "/ocio/resumen", "/museo", "/gastos"]) {
    const r = await fetch(BASE + p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get("content-type"), /text\/html/, p);
  }
});

/** Pedido HTTP crudo (para poder mandar el Host que se quiera). */
async function rawRequest(method, path, headers = {}, body) {
  const { request } = await import("node:http");
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: PORT, method, path, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

test("seguridad: otros sitios no pueden modificar datos ni leer la API (CSRF, CORS, rebinding, túnel)", async () => {
  // Un formulario de otra página que intenta subir algo.
  const fd = new FormData();
  fd.append("image", new Blob([makePng(4, 4)]), "x.png");
  const csrf = await fetch(BASE + "/api/ocio/artworks", { method: "POST", body: fd, headers: { Origin: "https://evil.example" } });
  assert.equal(csrf.status, 403);
  assert.equal((await api("GET", "/api/ocio/artworks")).data.length, 0, "no se subió nada");
  // CORS: a otro sitio no se le habilita leer las respuestas.
  const cors = await fetch(BASE + "/api/expenses", { headers: { Origin: "https://evil.example" } });
  assert.equal(cors.headers.get("access-control-allow-origin"), null);
  assert.equal((await fetch(BASE + "/api/expenses", { headers: { Origin: "http://localhost:5173" } })).headers.get("access-control-allow-origin"), "http://localhost:5173");
  // Cabeceras de seguridad.
  assert.equal(cors.headers.get("x-content-type-options"), "nosniff");
  assert.equal(cors.headers.get("x-frame-options"), "SAMEORIGIN");
  // DNS rebinding: un dominio de internet apuntando acá.
  assert.equal((await rawRequest("GET", "/api/expenses", { Host: "evil.example" })).status, 403);
  assert.equal((await rawRequest("GET", "/api/ocio/counts", { Host: "192.168.0.10:4000" })).status, 200, "la red de la casa sí");
  // Sin usuario y contraseña, lo que llega por el túnel de Cloudflare se rechaza.
  const tunnel = await rawRequest("GET", "/api/expenses", { Host: "abc.trycloudflare.com", "CF-Connecting-IP": "1.2.3.4", "CF-Ray": "x" });
  assert.equal(tunnel.status, 403);
  assert.match(tunnel.body, /AUTH_USER/);
});

test("seguridad: la portada no puede usarse para que el server pida direcciones internas (SSRF)", async () => {
  const { createServer } = await import("node:http");
  let hits = 0;
  const victim = createServer((req, res) => {
    hits += 1;
    res.end("secreto");
  });
  await new Promise((r) => victim.listen(0, "127.0.0.1", r));
  const port = victim.address().port;
  try {
    for (const url of [`http://127.0.0.1:${port}/admin`, `https://127.0.0.1:${port}/admin`, `http://localhost:${port}/x.jpg`]) {
      const r = await api("POST", "/api/ocio/library", { work: { type: "book", title: `SSRF ${url}`, coverUrl: url } });
      assert.equal(r.status, 201);
      await api("DELETE", `/api/ocio/library/${r.data.item.id}`);
    }
    await new Promise((r) => setTimeout(r, 800));
    assert.equal(hits, 0, "el server no hizo ningún pedido a la dirección interna");
  } finally {
    victim.close();
  }
});
