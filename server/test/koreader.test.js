import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gastosSchema } from "../src/db/schema/gastos.js";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { migrateOcioV2 } from "../src/db/migrations/ocioV2.js";
import { createLibrary } from "../src/services/ocio/library.js";
import { inspectSchema, toSessions, readKoreader, matchBooks, importKoreader, bookKey } from "../src/services/ocio/koreader.js";

// Esquema del plugin de estadísticas de KOReader (statistics.sqlite3).
const KOREADER_SCHEMA = `
CREATE TABLE book (id integer PRIMARY KEY autoincrement, title text, authors text, notes integer, last_open integer,
  highlights integer, pages integer, series text, language text, md5 text, total_read_time integer, total_read_pages integer);
CREATE TABLE page_stat_data (id_book integer, page integer NOT NULL DEFAULT 0, start_time integer NOT NULL DEFAULT 0,
  duration integer NOT NULL DEFAULT 0, total_pages integer NOT NULL DEFAULT 0, UNIQUE (id_book, page, start_time),
  FOREIGN KEY(id_book) REFERENCES book(id));`;

const t0 = Date.parse("2026-03-02T22:00:00-03:00") / 1000; // 2 de marzo, 22 h
const MIN = 60;

/** Archivo de KOReader de prueba: 1984 (2 sesiones), Un mundo feliz (1) y un libro sin lectura. */
function makeKoreaderFile(dir, extraRows = []) {
  const path = join(dir, `statistics-${Math.random().toString(36).slice(2)}.sqlite3`);
  const k = new DatabaseSync(path);
  k.exec(KOREADER_SCHEMA);
  k.prepare("INSERT INTO book (id, title, authors, md5, pages) VALUES (1, '1984', 'George Orwell', 'aaa111', 328)").run();
  k.prepare("INSERT INTO book (id, title, authors, md5, pages) VALUES (2, 'Un mundo feliz', 'Aldous Huxley', 'bbb222', 256)").run();
  k.prepare("INSERT INTO book (id, title, authors, md5, pages) VALUES (3, 'Sin abrir', 'Nadie', 'ccc333', 100)").run();
  k.prepare("INSERT INTO book (id, title, authors, md5, pages) VALUES (4, 'El nombre del viento', 'Patrick Rothfuss', 'ddd444', 880)").run();
  const row = k.prepare("INSERT INTO page_stat_data (id_book, page, start_time, duration, total_pages) VALUES (?, ?, ?, ?, ?)");
  // 1984, sesión 1: páginas 1-5, una por minuto. Sesión 2 al día siguiente: 6-8.
  for (let p = 1; p <= 5; p++) row.run(1, p, t0 + (p - 1) * MIN, 55, 328);
  for (let p = 6; p <= 8; p++) row.run(1, p, t0 + 86400 + (p - 6) * MIN, 60, 328);
  // Un mundo feliz: una sesión con una pausa de 5 min en el medio (sigue siendo la misma).
  row.run(2, 10, t0 + 2 * 86400, 120, 256);
  row.run(2, 11, t0 + 2 * 86400 + 7 * MIN, 90, 256);
  // El nombre del viento: no está en la biblioteca.
  row.run(4, 1, t0 + 3 * 86400, 300, 880);
  for (const r of extraRows) row.run(...r);
  k.close();
  return path;
}

function library() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(gastosSchema);
  db.exec(ocioSchema);
  migrateOcioV2(db);
  const lib = createLibrary(db);
  const orwell = lib.add({ work: { type: "book", title: "1984", creators: ["George Orwell"] }, entry: { status: "done" } }).item;
  const huxley = lib.add({ work: { type: "book", title: "Un mundo feliz", originalTitle: "Brave New World" }, entry: { status: "in_progress" } }).item;
  return { db, lib, orwell, huxley };
}

test("sesiones: las lecturas seguidas se agrupan; una pausa larga corta", () => {
  const rows = [
    { page: 1, start_time: 0, duration: 60 },
    { page: 2, start_time: 60, duration: 60 },
    { page: 2, start_time: 120, duration: 30 }, // volvió a la misma página
    { page: 3, start_time: 120 + 30 + 9 * MIN, duration: 60 }, // pausa de 9 min: sigue
    { page: 4, start_time: 2000 + 20 * MIN, duration: 60 }, // pausa larga: sesión nueva
    { page: 5, start_time: 9999, duration: 0 }, // sin duración: se ignora
  ];
  const s = toSessions(rows, 10);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0], { start: 0, durationSeconds: 210, pagesRead: 3, lastPage: 3 });
  assert.equal(s[1].pagesRead, 1);
});

test("inspecciona el esquema y avisa qué falta (no asume columnas)", () => {
  const dir = mkdtempSync(join(tmpdir(), "kor-"));
  try {
    const okPath = makeKoreaderFile(dir);
    const ok = new DatabaseSync(okPath, { readOnly: true });
    assert.equal(inspectSchema(ok).ok, true);
    ok.close();
    const badPath = join(dir, "bad.sqlite3");
    const bad = new DatabaseSync(badPath);
    bad.exec("CREATE TABLE book (id integer, title text); CREATE TABLE page_stat_data (id_book integer, page integer)");
    bad.close();
    const r = readKoreader(badPath);
    assert.equal(r.schema.ok, false);
    assert.deepEqual(r.schema.missing, ["page_stat_data.start_time", "page_stat_data.duration"]);
    assert.deepEqual(r.books, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lee libros con sus sesiones y los vincula con la biblioteca", () => {
  const dir = mkdtempSync(join(tmpdir(), "kor-"));
  try {
    const { db, orwell, huxley } = library();
    const { books } = readKoreader(makeKoreaderFile(dir));
    assert.deepEqual(books.map((b) => b.title), ["1984", "Un mundo feliz", "El nombre del viento"], "el libro sin lectura no aparece");
    const b1984 = books[0];
    assert.equal(b1984.sessions.length, 2);
    assert.equal(b1984.totalSeconds, 5 * 55 + 3 * 60);
    assert.equal(b1984.pagesRead, 8);
    assert.equal(b1984.key, "md5:aaa111");
    const matched = matchBooks(db, books);
    assert.deepEqual(matched[0].match, { workId: orwell.workId, confidence: "exact" });
    assert.deepEqual(matched[1].match, { workId: huxley.workId, confidence: "exact" }, "sin autor en la biblioteca, el título alcanza");
    assert.equal(matched[2].match, null, "no está: hay que elegir");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("importar es idempotente, extiende sesiones y recuerda el vínculo", () => {
  const dir = mkdtempSync(join(tmpdir(), "kor-"));
  try {
    const { db, lib, orwell, huxley } = library();
    const books = matchBooks(db, readKoreader(makeKoreaderFile(dir)).books);
    const mapping = Object.fromEntries(books.map((b) => [b.key, b.match ? b.match.workId : "new"]));
    const first = importKoreader(db, lib, books, mapping);
    assert.deepEqual(first, { books: 3, created: 1, skipped: 0, sessionsNew: 4, sessionsUpdated: 0 });
    assert.ok(lib.list({ q: "rothfuss" }).length === 1, "se creó el libro que faltaba");
    assert.equal(lib.item(huxley.id).currentPass.startedAt, "2026-03-04", "completa la fecha de inicio que faltaba");

    // El mismo archivo otra vez: nada nuevo.
    const again = importKoreader(db, lib, matchBooks(db, readKoreader(makeKoreaderFile(dir)).books), mapping);
    assert.equal(again.sessionsNew, 0);
    assert.equal(again.sessionsUpdated, 0);
    assert.equal(again.created, 0, "el libro creado ya quedó vinculado");

    // Un archivo más nuevo: la sesión del día 2 siguió (página 9) y hay una sesión nueva.
    const newer = makeKoreaderFile(dir, [
      [1, 9, t0 + 86400 + 3 * MIN, 60, 328],
      [1, 10, t0 + 5 * 86400, 60, 328],
    ]);
    const relinked = matchBooks(db, readKoreader(newer).books);
    assert.equal(relinked[0].match.confidence, "linked");
    const third = importKoreader(db, lib, relinked, mapping);
    assert.equal(third.sessionsNew, 1);
    assert.equal(third.sessionsUpdated, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reading_sessions WHERE workId = ?").get(orwell.workId).n, 3);
    assert.equal(bookKey({ title: "Sin md5", authors: "X" }), "t:sin md5|x");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
