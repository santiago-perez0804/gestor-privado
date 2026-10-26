import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { gastosSchema } from "../src/db/schema/gastos.js";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { migrateOcioV2 } from "../src/db/migrations/ocioV2.js";
import { createLibrary } from "../src/services/ocio/library.js";

function freshLibrary() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(gastosSchema);
  db.exec(ocioSchema);
  migrateOcioV2(db);
  return { db, lib: createLibrary(db) };
}

const book = (extra = {}) => ({ type: "book", title: "1984", creators: ["George Orwell"], year: 1949, genres: ["distopia", "ciencia_ficcion"], ...extra });

test("ciclo de lectura: quiero → leyendo → terminado → releer", () => {
  const { lib } = freshLibrary();
  const { item } = lib.add({ work: book() });
  assert.equal(item.status, "want");
  assert.equal(item.currentPass, null);

  const reading = lib.setStatus(item.id, "in_progress", { date: "2026-03-02" });
  assert.equal(reading.currentPass.number, 1);
  assert.equal(reading.currentPass.startedAt, "2026-03-02");

  const done = lib.setStatus(item.id, "done", { date: "2026-03-19" });
  assert.equal(done.status, "done");
  assert.equal(done.currentPass.finishedAt, "2026-03-19");
  assert.equal(done.timesFinished, 1);

  const again = lib.reread(item.id, { date: "2026-10-01" });
  assert.equal(again.status, "in_progress");
  assert.equal(again.currentPass.number, 2);
  assert.equal(again.timesFinished, 1, "la primera lectura sigue contando");
  const twice = lib.setStatus(item.id, "done", { date: "2026-10-20" });
  assert.equal(twice.timesFinished, 2);
  assert.equal(twice.lastFinishedAt, "2026-10-20");
  assert.equal(lib.detail(item.id).passes.length, 2);
});

test("terminar algo que nunca empezaste crea una pasada terminada; abandonar y retomar reabre la misma", () => {
  const { lib } = freshLibrary();
  const { item } = lib.add({ work: { type: "movie", title: "Perfect Days", year: 2023 }, entry: { status: "done" }, pass: { finishedAt: "2026-10-02" } });
  assert.equal(item.currentPass.status, "done");
  assert.equal(item.currentPass.finishedAt, "2026-10-02");

  const { item: game } = lib.add({ work: { type: "game", title: "Disco Elysium" }, entry: { status: "in_progress" } });
  lib.setStatus(game.id, "dropped", { date: "2026-05-01", dropReason: "me trabé" });
  assert.equal(lib.item(game.id).currentPass.dropReason, "me trabé");
  const back = lib.setStatus(game.id, "in_progress");
  assert.equal(back.passCount, 1, "retomar no crea otra pasada");
  assert.equal(back.currentPass.finishedAt, null);
});

test("volver a 'quiero' descarta una pasada recién abierta sin progreso", () => {
  const { lib } = freshLibrary();
  const { item } = lib.add({ work: book(), entry: { status: "in_progress" } });
  assert.equal(item.passCount, 1);
  assert.equal(lib.setStatus(item.id, "want").passCount, 0);
});

test("no duplica: mismo id externo, o mismo título y año parecido", () => {
  const { db, lib } = freshLibrary();
  const first = lib.add({ work: { type: "movie", title: "Dune", year: 2021, externalSource: "tmdb", externalId: 438631 } });
  const second = lib.add({ work: { type: "movie", title: "Dune", year: 2021, externalSource: "tmdb", externalId: "438631", coverUrl: "https://x/poster.jpg" }, entry: { status: "done" } });
  assert.equal(second.existed, true);
  assert.equal(second.item.id, first.item.id);
  assert.equal(second.item.cover, "https://x/poster.jpg", "completa la portada que faltaba");
  assert.equal(second.item.status, "done", "guardar actualiza la entrada existente");

  const manual = lib.add({ work: { type: "book", title: "Dune", year: 1965 } });
  assert.equal(manual.existed, false, "otro tipo: es otra obra");
  assert.equal(lib.findDuplicate({ type: "book", title: "dune", year: 1966 })?.id, manual.item.id, "año ±1 y sin tildes ni mayúsculas");
  assert.equal(lib.findDuplicate({ type: "movie", title: "Duna", year: 1984 }), null);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM works").get().n, 2);
});

test("puntuación con medias estrellas; reseña y progreso", () => {
  const { lib } = freshLibrary();
  const { item } = lib.add({ work: book(), entry: { status: "in_progress", rating: 4.5 }, review: { text: "Más actual de lo que esperaba.", hasSpoilers: false } });
  assert.equal(item.rating, 4.5);
  assert.throws(() => lib.updateEntry(item.id, { rating: 4.3 }), /CHECK/);
  const progressed = lib.updatePass(item.currentPass.id, { progress: { unit: "page", current: 142, total: 256 } });
  assert.deepEqual(progressed.currentPass.progress, { unit: "page", current: 142, total: 256 });
  const d = lib.detail(item.id);
  assert.equal(d.reviews.length, 1);
  assert.equal(d.reviews[0].passId, d.passes[0].id, "la reseña queda asociada a la pasada");
});

test("buscar por título, autor o género, y borrar en cascada", () => {
  const { db, lib } = freshLibrary();
  const { item } = lib.add({ work: book(), review: { text: "x" } });
  lib.addHighlight(item.workId, { text: "La guerra es la paz.", location: "p. 8" });
  lib.add({ work: { type: "book", title: "Un mundo feliz", creators: ["Aldous Huxley"], genres: ["distopia"] } });
  assert.equal(lib.list({ q: "orwell" }).length, 1);
  assert.equal(lib.list({ q: "distopia" }).length, 2);
  assert.equal(lib.list({ type: "movie" }).length, 0);
  assert.equal(lib.detail(item.id).related[0].title, "Un mundo feliz");
  lib.remove(item.id);
  assert.equal(lib.list().length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM highlights").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reviews").get().n, 0);
});

test("metas anuales", () => {
  const { lib } = freshLibrary();
  assert.deepEqual(lib.setGoal(2026, "book", 12), [{ type: "book", target: 12 }]);
  assert.deepEqual(lib.setGoal(2026, "book", 6), [{ type: "book", target: 6 }]);
  assert.deepEqual(lib.setGoal(2026, "book", 0), []);
});

test("duplicados por título: el original cuenta y un homónimo de otro autor no", () => {
  const { lib } = freshLibrary();
  const { item } = lib.add({ work: { type: "book", title: "Un mundo feliz", creators: ["Aldous Huxley"] } });
  assert.equal(lib.findDuplicate({ type: "book", title: "Brave New World", originalTitle: "Un mundo feliz", creators: ["Aldous Huxley"] })?.id, item.id);
  assert.equal(lib.findDuplicate({ type: "book", title: "Un mundo feliz", creators: ["Manuel Aguirre"] }), null, "otro autor: es otro libro");
  assert.equal(lib.findDuplicate({ type: "book", title: "Un mundo feliz" })?.match, "title");
});
