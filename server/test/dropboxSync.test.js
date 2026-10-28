import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./helpers/pgdb.js";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { gastosSchema } from "../src/db/schema/gastos.js";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { migrateOcioV2 } from "../src/db/migrations/ocioV2.js";
import { createLibrary } from "../src/services/ocio/library.js";
import { createKoreaderSync, SYNCED_FILE } from "../src/services/ocio/koreaderSync.js";
import { createDropboxAuth, createDropboxFiles, saveAccount, getAccount, normalizePath } from "../src/services/dropbox/client.js";
import { encryptSecret } from "../src/lib/secretBox.js";

process.env.TOKEN_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
process.env.DROPBOX_APP_KEY = "key";
process.env.DROPBOX_APP_SECRET = "secret";

/** statistics.sqlite3 sintético: [{ id, title, authors, pages: [[page, start, duration], …] }]. */
function koreaderFile(dir, name, books) {
  const path = join(dir, name);
  const k = new DatabaseSync(path);
  k.exec("CREATE TABLE book (id INTEGER PRIMARY KEY, title TEXT, authors TEXT, md5 TEXT, pages INTEGER)");
  k.exec("CREATE TABLE page_stat_data (id_book INTEGER, page INTEGER, start_time INTEGER, duration INTEGER, total_pages INTEGER)");
  for (const b of books) {
    k.prepare("INSERT INTO book VALUES (?, ?, ?, ?, 300)").run(b.id, b.title, b.authors, `md5-${b.id}`);
    for (const [page, start, duration] of b.pages) k.prepare("INSERT INTO page_stat_data VALUES (?, ?, ?, ?, 300)").run(b.id, page, start, duration);
  }
  k.close();
  return readFileSync(path);
}

const T0 = Math.floor(new Date(2026, 9, 1, 22, 0).getTime() / 1000);
const pagesFrom = (start, n) => Array.from({ length: n }, (_, i) => [i + 1, start + i * 60, 55]);

/** Dropbox falso: un archivo con `rev`, y contadores de lo que se pidió. */
function fakeDropbox() {
  const state = { file: null, rev: null, calls: { token: 0, metadata: 0, download: 0 }, tokenError: null, metadataStatus: null };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const impl = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith("/oauth2/token")) {
      state.calls.token += 1;
      if (state.tokenError) return json({ error: state.tokenError }, 400);
      return json({ access_token: `at-${state.calls.token}`, expires_in: 14400 });
    }
    if (u.endsWith("/2/files/get_metadata")) {
      state.calls.metadata += 1;
      if (state.metadataStatus) {
        const s = state.metadataStatus;
        state.metadataStatus = null;
        return json({ error_summary: "expired_access_token/" }, s);
      }
      assert.equal(JSON.parse(init.body).path, "/statistics.sqlite3");
      if (!state.file) return json({ error_summary: "path/not_found/..", error: { ".tag": "path" } }, 409);
      return json({ ".tag": "file", rev: state.rev, size: state.file.length, server_modified: "2026-10-27T10:00:00Z" });
    }
    if (u.endsWith("/2/files/download")) {
      state.calls.download += 1;
      return new Response(state.file, { status: 200 });
    }
    throw new Error(`pedido inesperado ${u}`);
  };
  return { state, impl };
}

async function setup() {
  const db = await testDb();
  const lib = createLibrary(db);
  const dir = mkdtempSync(join(tmpdir(), "kosync-"));
  const fake = fakeDropbox();
  const auth = createDropboxAuth(db, { fetchImpl: fake.impl });
  const files = createDropboxFiles(auth.getAccessToken, { fetchImpl: fake.impl, backoff: () => 0 });
  const sync = createKoreaderSync({ db, lib, files, importsDir: dir });
  const connect = async () => await saveAccount(db, { refreshTokenEnc: encryptSecret("rt-123"), status: "connected" });
  return { db, lib, dir, fake, sync, connect, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("ruta en Dropbox: carpeta o archivo, siempre con / adelante y sin ..", () => {
  assert.equal(normalizePath(""), "/statistics.sqlite3");
  assert.equal(normalizePath("/"), "/statistics.sqlite3");
  assert.equal(normalizePath("kindle"), "/kindle/statistics.sqlite3");
  assert.equal(normalizePath("/kindle/"), "/kindle/statistics.sqlite3");
  assert.equal(normalizePath("\\Kindle\\statistics.sqlite3"), "/Kindle/statistics.sqlite3");
  assert.throws(() => normalizePath("/../otra"), { message: "invalid_path" });
});

test("sin cuenta conectada no hace nada", async (t) => {
  const s = await setup();
  t.after(s.cleanup);
  assert.deepEqual(await s.sync.syncNow(), { changed: false, skipped: "not_connected" });
  assert.equal(s.fake.state.calls.metadata, 0);
});

test("sincroniza: importa lo conocido, deja pendiente lo desconocido y no baja de nuevo si no cambió", async (t) => {
  const s = await setup();
  t.after(s.cleanup);
  await s.connect();
  const known = (await s.lib.add({ work: { type: "book", title: "1984", creators: ["George Orwell"] }, entry: { status: "in_progress" } })).item;
  s.fake.state.file = koreaderFile(s.dir, "a.sqlite3", [
    { id: 1, title: "1984", authors: "George Orwell", pages: pagesFrom(T0, 20) },
    { id: 2, title: "Un libro raro", authors: "Nadie", pages: pagesFrom(T0 + 86_400, 10) },
  ]);
  s.fake.state.rev = "r1";

  const first = await s.sync.syncNow();
  assert.equal(first.changed, true);
  assert.equal(first.books, 1, "solo el que coincide");
  assert.equal(first.sessionsNew, 1);
  assert.equal(first.pending, 1);
  assert.equal((await s.db.prepare("SELECT COUNT(*) n FROM reading_sessions WHERE workId = ?").get(known.workId)).n, 1);
  assert.ok(existsSync(join(s.dir, SYNCED_FILE)));
  assert.equal((await getAccount(s.db)).lastRev, "r1");
  assert.equal((await getAccount(s.db)).lastError, null);

  const again = await s.sync.syncNow();
  assert.deepEqual(again, { changed: false });
  assert.equal(s.fake.state.calls.download, 1, "mismo rev: no vuelve a bajar");

  const { books } = await s.sync.pending();
  assert.equal(books.length, 1);
  assert.equal(books[0].title, "Un libro raro");
  assert.equal(books[0].sessionCount, 1);

  const resolved = await s.sync.resolve({ [books[0].key]: "new" });
  assert.equal(resolved.created, 1);
  assert.equal(resolved.pending, 0);
  assert.ok((await s.lib.list({ type: "book" })).some((i) => i.title === "Un libro raro"));

  // Archivo nuevo en Dropbox: el vinculado sigue solo, uno nuevo se ignora para siempre.
  s.fake.state.file = koreaderFile(s.dir, "b.sqlite3", [
    { id: 1, title: "1984", authors: "George Orwell", pages: [...pagesFrom(T0, 20), ...pagesFrom(T0 + 3 * 86_400, 5)] },
    { id: 2, title: "Un libro raro", authors: "Nadie", pages: pagesFrom(T0 + 86_400, 10) },
    { id: 3, title: "Manual del router", authors: "", pages: pagesFrom(T0 + 4 * 86_400, 3) },
  ]);
  s.fake.state.rev = "r2";
  const second = await s.sync.syncNow();
  assert.equal(second.sessionsNew, 1, "solo la sesión nueva de 1984");
  assert.equal(second.books, 2, "1984 y el que se agregó antes (ya vinculado)");
  assert.equal(second.pending, 1);
  const router = (await s.sync.pending()).books[0];
  assert.equal((await s.sync.resolve({ [router.key]: "ignore" })).ignored, 1);
  s.fake.state.rev = "r3";
  assert.equal((await s.sync.syncNow()).pending, 0, "lo ignorado no vuelve a aparecer");
});

test("pendiente a una obra existente; valores inválidos", async (t) => {
  const s = await setup();
  t.after(s.cleanup);
  await s.connect();
  const dune = (await s.lib.add({ work: { type: "book", title: "Dune (edición de bolsillo)" } })).item;
  s.fake.state.file = koreaderFile(s.dir, "a.sqlite3", [{ id: 1, title: "Dune", authors: "Frank Herbert", pages: pagesFrom(T0, 8) }]);
  s.fake.state.rev = "r1";
  assert.equal((await s.sync.syncNow()).pending, 1, "título parecido pero no igual: pregunta");
  const [b] = (await s.sync.pending()).books;
  assert.equal(b.candidates[0].workId, dune.workId, "sugiere el parecido");
  await assert.rejects(async () => await s.sync.resolve({ [b.key]: "999999" }), { message: "invalid_work" });
  const r = await s.sync.resolve({ [b.key]: String(dune.workId) });
  assert.equal(r.sessionsNew, 1);
  assert.equal(r.pending, 0);
});

test("errores: archivo que no existe, archivo que no es SQLite, token revocado y 401 con reintento", async (t) => {
  const s = await setup();
  t.after(s.cleanup);
  await s.connect();
  const missing = await s.sync.syncNow();
  assert.equal(missing.missing, true);
  assert.match((await getAccount(s.db)).lastError, /sincronizá una vez desde el Kindle/);

  s.fake.state.file = Buffer.from("<html>no soy una base</html>".padEnd(64, " "));
  s.fake.state.rev = "r1";
  await assert.rejects(s.sync.syncNow(), { code: "not_sqlite" });
  assert.equal((await getAccount(s.db)).status, "error");
  assert.equal((await getAccount(s.db)).lastRev, null, "no se marca como leído");

  // 401: renueva el token y reintenta una vez.
  s.fake.state.file = koreaderFile(s.dir, "ok.sqlite3", [{ id: 1, title: "X", authors: "", pages: pagesFrom(T0, 2) }]);
  s.fake.state.metadataStatus = 401;
  const tokensBefore = s.fake.state.calls.token;
  assert.equal((await s.sync.syncNow()).changed, true);
  assert.equal(s.fake.state.calls.token, tokensBefore + 1);
  assert.equal((await getAccount(s.db)).status, "connected");

  // Acceso revocado del lado de Dropbox.
  const s2 = await setup();
  t.after(s2.cleanup);
  await s2.connect();
  s2.fake.state.tokenError = "invalid_grant";
  await assert.rejects(s2.sync.syncNow());
  assert.equal((await getAccount(s2.db)).status, "revoked");
  assert.match((await getAccount(s2.db)).lastError, /reconectar/);
});
