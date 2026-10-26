import { test } from "node:test";
import assert from "node:assert/strict";
import { finishedByMonth, countByType, topGenres, averageRating, goalProjection, weekendRange, perMonth, yearProgress } from "../src/lib/ocio/stats.js";
import { mapGenre, mapGenres } from "../src/lib/ocio/genres.js";

const finished = [
  { type: "book", date: "2026-03-19", title: "1984", rating: 4, genres: ["distopia", "ciencia_ficcion"] },
  { type: "movie", date: "2026-03-02", title: "Chihiro", rating: 5, genres: ["animacion", "fantasia"] },
  { type: "movie", date: "2026-10-02", title: "Perfect Days", rating: 4.5, genres: ["drama"] },
  { type: "book", date: "2025-12-30", title: "Viejo", rating: null, genres: ["drama"] },
];

test("terminados por mes y por tipo (solo el año pedido)", () => {
  const months = finishedByMonth(finished, 2026);
  assert.equal(months.length, 12);
  assert.equal(months[2].total, 2);
  assert.deepEqual(months[2].byType, { movie: 1, series: 0, book: 1, game: 0 });
  assert.equal(months[9].items[0].title, "Perfect Days");
  assert.equal(months.reduce((s, m) => s + m.total, 0), 3);
  assert.deepEqual(countByType(finished), { movie: 2, series: 0, book: 2, game: 0 });
});

test("géneros favoritos y puntuación promedio", () => {
  assert.deepEqual(topGenres(finished, 2), [
    { id: "drama", count: 2 },
    { id: "animacion", count: 1 },
  ]);
  assert.equal(averageRating(finished), 4.5);
  assert.equal(averageRating([{ rating: null }]), null);
});

test("meta anual: dónde deberías estar y cuántos terminás a este ritmo", () => {
  // 26 de octubre: día 299 de 365. 3 de 12 libros.
  const g = goalProjection({ done: 3, target: 12, today: "2026-10-26" });
  assert.deepEqual(yearProgress("2026-10-26"), { day: 299, length: 365 });
  assert.equal(g.expectedNow, 10);
  assert.equal(g.onTrack, false);
  assert.equal(g.projected, 4);
  assert.equal(g.everyDays, 7, "faltan 9 libros en 66 días");
  assert.equal(g.realistic, 4);
  assert.equal(goalProjection({ done: 12, target: 12, today: "2026-10-26" }).everyDays, null);
});

test("fin de semana: de viernes a domingo", () => {
  assert.deepEqual(weekendRange("2026-10-26"), { from: "2026-10-30", to: "2026-11-01" }, "lunes → el que viene");
  assert.deepEqual(weekendRange("2026-10-31"), { from: "2026-10-31", to: "2026-11-01" }, "sábado → desde hoy");
  assert.deepEqual(weekendRange("2026-11-01"), { from: "2026-11-01", to: "2026-11-01" }, "domingo → hoy");
});

test("promedio por mes en lo que va del año", () => {
  assert.equal(perMonth(14, 2026, "2026-10-26"), 1.4);
  assert.equal(perMonth(12, 2025, "2026-10-26"), 1);
});

test("géneros de cada fuente se traducen a la lista propia", () => {
  assert.deepEqual(mapGenre("Science Fiction"), ["ciencia_ficcion"]);
  assert.deepEqual(mapGenre("Sci-Fi & Fantasy"), ["ciencia_ficcion", "fantasia"]);
  assert.deepEqual(mapGenre("Ciencia ficción"), ["ciencia_ficcion"]);
  assert.deepEqual(mapGenre("Action & Adventure"), ["accion", "aventura"]);
  assert.deepEqual(mapGenre("Role-playing (RPG)"), ["rpg"]);
  assert.deepEqual(mapGenre("Control"), [], "'rol' dentro de otra palabra no es RPG");
  assert.deepEqual(mapGenres(["Fiction", "Dystopias", "Totalitarianism", "Science fiction"]), ["distopia", "ciencia_ficcion"]);
});

import { readingStats, streaks, intensityLevels, bookRecords } from "../src/lib/ocio/stats.js";

const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

test("rachas: la actual llega hasta hoy (o ayer) y la mejor es la más larga", () => {
  const days = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-24", "2026-10-25", "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"];
  assert.deepEqual(streaks(days, "2026-10-26"), { current: 2, best: 4 }, "hoy no leyó: cuenta hasta ayer");
  assert.deepEqual(streaks([...days, "2026-10-26"], "2026-10-26"), { current: 3, best: 4 });
  assert.deepEqual(streaks(["2026-10-20"], "2026-10-26"), { current: 0, best: 1 });
});

test("niveles del calendario: 0 sin lectura y 1–4 por cuartiles", () => {
  assert.deepEqual(intensityLevels([0, 5, 10, 20, 40, 0]), [0, 1, 2, 3, 4, 0]);
  assert.deepEqual(intensityLevels([0, 0]), [0, 0]);
});

test("estadísticas de lectura del año: páginas, ritmo, días, franja y día récord", () => {
  const sessions = [
    { startTime: at(2026, 3, 8, 22), durationSeconds: 3600, pagesRead: 40, workId: 1 }, // noche
    { startTime: at(2026, 3, 9, 23, 30), durationSeconds: 1800, pagesRead: 20, workId: 1 }, // noche
    { startTime: at(2026, 3, 10, 2), durationSeconds: 1800, pagesRead: 15, workId: 1 }, // madrugada
    { startTime: at(2026, 7, 1, 9), durationSeconds: 1200, pagesRead: 10, workId: 2 }, // mañana
    { startTime: at(2025, 12, 31, 22), durationSeconds: 999, pagesRead: 99, workId: 3 }, // otro año
  ];
  const r = readingStats(sessions, { year: 2026, today: "2026-10-26" });
  assert.equal(r.pages, 85);
  assert.equal(r.seconds, 8400);
  assert.equal(r.pagesPerHour, 36);
  assert.equal(r.daysWithReading, 4);
  assert.equal(r.daysInPeriod, 299, "hasta hoy");
  assert.equal(r.bestStreak, 3);
  assert.deepEqual(r.recordDay, { date: "2026-03-08", pages: 40, workId: 1 });
  assert.equal(r.pagesByMonth[2], 75);
  assert.equal(r.pagesByMonth[6], 10);
  assert.deepEqual(r.hourBuckets.map((b) => [b.id, b.sessions]), [["morning", 1], ["afternoon", 0], ["night", 2], ["late", 1]]);
  assert.equal(r.calendar.find((c) => c.date === "2026-03-08").level, 4);
  assert.equal(r.calendar.find((c) => c.date === "2026-01-01").level, 0);
});

test("récords de libros del año", () => {
  const books = [
    { entryId: 1, title: "1984", startedAt: "2026-03-02", date: "2026-03-19", rating: 4, metadata: { pages: 328 } },
    { entryId: 2, title: "La vegetariana", startedAt: "2026-06-01", date: "2026-06-13", rating: 4, metadata: { pages: 192 } },
    { entryId: 3, title: "Un mago de Terramar", startedAt: "2026-08-01", date: "2026-09-16", rating: 3, metadata: {} },
    { entryId: 4, title: "Sin fechas", startedAt: null, date: "2026-10-01", metadata: { pages: 100 } },
  ];
  const r = bookRecords(books);
  assert.equal(r.longest.title, "1984");
  assert.equal(r.fastest.title, "La vegetariana");
  assert.equal(r.fastest.days, 13);
  assert.equal(r.slowest.title, "Un mago de Terramar");
  assert.equal(r.slowest.days, 47);
  assert.equal(r.averageDays, 26);
  assert.deepEqual(bookRecords([]), { longest: null, fastest: null, slowest: null, averageDays: null });
});
