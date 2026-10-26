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
