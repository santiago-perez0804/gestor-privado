import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./helpers/pgdb.js";
import { DatabaseSync } from "node:sqlite";
import { gastosSchema } from "../src/db/schema/gastos.js";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { migrateOcioV2 } from "../src/db/migrations/ocioV2.js";
import { createLibrary } from "../src/services/ocio/library.js";
import { createOcioStats } from "../src/services/ocio/stats.js";

async function setup() {
  const db = await testDb();
  const lib = createLibrary(db);
  const year = new Date().getFullYear();
  const y = (md) => `${year}-${md}`;
  const b1984 = (await lib.add({ work: { type: "book", title: "1984", creators: ["George Orwell"], genres: ["distopia"], metadata: { pages: 328 } }, entry: { status: "done", rating: 4 }, pass: { finishedAt: y("01-19") } })).item;
  await lib.updatePass(b1984.currentPass.id, { startedAt: y("01-02") });
  await lib.add({ work: { type: "movie", title: "Perfect Days", creators: ["Wim Wenders"], genres: ["drama"], metadata: { runtime: 124 } }, entry: { status: "done", rating: 5 }, pass: { finishedAt: y("01-05") } });
  await lib.add({ work: { type: "movie", title: "Chihiro", creators: ["Hayao Miyazaki"], genres: ["animacion"], metadata: { runtime: 125 } }, entry: { status: "done", rating: 4.5 }, pass: { finishedAt: y("01-20") } });
  const ts = new Date().toISOString();
  const session = db.prepare("INSERT INTO reading_sessions (workId, startTime, durationSeconds, pagesRead, source, createdAt) VALUES (?, ?, ?, ?, 'manual', ?)");
  await session.run(b1984.workId, new Date(year, 0, 8, 22).toISOString(), 3600, 40, ts);
  await session.run(b1984.workId, new Date(year, 0, 9, 21).toISOString(), 1800, 20, ts);
  await lib.setGoal(year, "book", 12);
  const outing = db.prepare("INSERT INTO outings (title, category, date, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)");
  await outing.run("Oktoberfest", "fiesta", y("01-10"), "attended", ts, ts);
  await outing.run("Recital", "musica", y("01-12"), "not_attended", ts, ts);
  return { db, lib, stats: createOcioStats(db, lib), year, b1984 };
}

test("estadísticas de libros: meta, lectura, récords y géneros", async () => {
  const { stats, year } = await setup();
  const s = await stats.stats(year, "book");
  assert.equal(s.finished, 1);
  assert.equal(s.goal.target, 12);
  assert.equal(s.reading.pages, 60);
  assert.equal(s.reading.pagesPerHour, 40);
  assert.equal(s.reading.daysWithReading, 2);
  assert.equal(s.reading.recordDay.title, "1984");
  assert.equal(s.records.longest.title, "1984");
  assert.equal(s.records.averageDays, 18);
  assert.deepEqual(s.genres, [{ id: "distopia", count: 1 }]);
});

test("estadísticas de películas: horas vistas, promedio y directores", async () => {
  const { stats, year } = await setup();
  const m = await stats.stats(year, "movie");
  assert.equal(m.finished, 2);
  assert.equal(m.hours, 4, "124 + 125 minutos");
  assert.equal(m.averageRating, 4.8);
  assert.equal(m.best[0].title, "Perfect Days");
  assert.equal(m.monthly[0], 2);
  assert.ok("cover" in m.best[0], "lo mejor trae la portada");
});

test("resumen anual: todo de una vez (y las salidas a las que no fuiste no cuentan)", async () => {
  const { stats, year } = await setup();
  const w = await stats.wrapped(year);
  assert.equal(w.totalFinished, 3);
  assert.deepEqual(w.finishedCount, { movie: 2, series: 0, book: 1, game: 0 });
  assert.equal(w.first.title, "Perfect Days");
  assert.equal(w.last.title, "Chihiro");
  assert.equal(w.favoriteMonth.month, 0);
  assert.equal(w.reading.pages, 60);
  assert.equal(w.movieHours, 4);
  assert.equal(w.outings.count, 1);
  assert.deepEqual(w.outings.topCategory, { id: "fiesta", count: 1 });
  assert.equal(w.best[0].rating, 5);
});

test("caché: devuelve lo mismo mientras no cambien los datos y recalcula cuando cambian", async () => {
  const { stats, lib, year } = await setup();
  const a = await stats.stats(year);
  assert.equal(await stats.stats(year), a, "mismo objeto: no recalculó");
  await lib.add({ work: { type: "game", title: "Hades" }, entry: { status: "done" }, pass: { finishedAt: `${year}-02-01` } });
  const b = await stats.stats(year);
  assert.notEqual(b, a);
  assert.equal(b.totalFinished, 4);
});
