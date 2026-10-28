import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./helpers/pgdb.js";
import { DatabaseSync } from "node:sqlite";
import { gastosSchema } from "../src/db/schema/gastos.js";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { migrateOcioV2 } from "../src/db/migrations/ocioV2.js";
import { createLibrary } from "../src/services/ocio/library.js";

async function freshLibrary() {
  const db = await testDb();
  return { db, lib: createLibrary(db) };
}

const book = (extra = {}) => ({ type: "book", title: "1984", creators: ["George Orwell"], year: 1949, genres: ["distopia", "ciencia_ficcion"], ...extra });

test("ciclo de lectura: quiero → leyendo → terminado → releer", async () => {
  const { lib } = await freshLibrary();
  const { item } = await lib.add({ work: book() });
  assert.equal(item.status, "want");
  assert.equal(item.currentPass, null);

  const reading = await lib.setStatus(item.id, "in_progress", { date: "2026-03-02" });
  assert.equal(reading.currentPass.number, 1);
  assert.equal(reading.currentPass.startedAt, "2026-03-02");

  const done = await lib.setStatus(item.id, "done", { date: "2026-03-19" });
  assert.equal(done.status, "done");
  assert.equal(done.currentPass.finishedAt, "2026-03-19");
  assert.equal(done.timesFinished, 1);

  const again = await lib.reread(item.id, { date: "2026-10-01" });
  assert.equal(again.status, "in_progress");
  assert.equal(again.currentPass.number, 2);
  assert.equal(again.timesFinished, 1, "la primera lectura sigue contando");
  const twice = await lib.setStatus(item.id, "done", { date: "2026-10-20" });
  assert.equal(twice.timesFinished, 2);
  assert.equal(twice.lastFinishedAt, "2026-10-20");
  assert.equal((await lib.detail(item.id)).passes.length, 2);
});

test("terminar algo que nunca empezaste crea una pasada terminada; abandonar y retomar reabre la misma", async () => {
  const { lib } = await freshLibrary();
  const { item } = await lib.add({ work: { type: "movie", title: "Perfect Days", year: 2023 }, entry: { status: "done" }, pass: { finishedAt: "2026-10-02" } });
  assert.equal(item.currentPass.status, "done");
  assert.equal(item.currentPass.finishedAt, "2026-10-02");

  const { item: game } = await lib.add({ work: { type: "game", title: "Disco Elysium" }, entry: { status: "in_progress" } });
  await lib.setStatus(game.id, "dropped", { date: "2026-05-01", dropReason: "me trabé" });
  assert.equal((await lib.item(game.id)).currentPass.dropReason, "me trabé");
  const back = await lib.setStatus(game.id, "in_progress");
  assert.equal(back.passCount, 1, "retomar no crea otra pasada");
  assert.equal(back.currentPass.finishedAt, null);
});

test("volver a 'quiero' descarta una pasada recién abierta sin progreso", async () => {
  const { lib } = await freshLibrary();
  const { item } = await lib.add({ work: book(), entry: { status: "in_progress" } });
  assert.equal(item.passCount, 1);
  assert.equal((await lib.setStatus(item.id, "want")).passCount, 0);
});

test("no duplica: mismo id externo, o mismo título y año parecido", async () => {
  const { db, lib } = await freshLibrary();
  const first = await lib.add({ work: { type: "movie", title: "Dune", year: 2021, externalSource: "tmdb", externalId: 438631 } });
  const second = await lib.add({ work: { type: "movie", title: "Dune", year: 2021, externalSource: "tmdb", externalId: "438631", coverUrl: "https://x/poster.jpg" }, entry: { status: "done" } });
  assert.equal(second.existed, true);
  assert.equal(second.item.id, first.item.id);
  assert.equal(second.item.cover, "https://x/poster.jpg", "completa la portada que faltaba");
  assert.equal(second.item.status, "done", "guardar actualiza la entrada existente");

  const manual = await lib.add({ work: { type: "book", title: "Dune", year: 1965 } });
  assert.equal(manual.existed, false, "otro tipo: es otra obra");
  assert.equal((await lib.findDuplicate({ type: "book", title: "dune", year: 1966 }))?.id, manual.item.id, "año ±1 y sin tildes ni mayúsculas");
  assert.equal(await lib.findDuplicate({ type: "movie", title: "Duna", year: 1984 }), null);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM works").get()).n, 2);
});

test("puntuación con medias estrellas; reseña y progreso", async () => {
  const { lib } = await freshLibrary();
  const { item } = await lib.add({ work: book(), entry: { status: "in_progress", rating: 4.5 }, review: { text: "Más actual de lo que esperaba.", hasSpoilers: false } });
  assert.equal(item.rating, 4.5);
  await assert.rejects(async () => await lib.updateEntry(item.id, { rating: 4.3 }), { message: "invalid_rating" });
  const progressed = await lib.updatePass(item.currentPass.id, { progress: { unit: "page", current: 142, total: 256 } });
  assert.deepEqual(progressed.currentPass.progress, { unit: "page", current: 142, total: 256 });
  const d = await lib.detail(item.id);
  assert.equal(d.reviews.length, 1);
  assert.equal(d.reviews[0].passId, d.passes[0].id, "la reseña queda asociada a la pasada");
});

test("buscar por título, autor o género, y borrar en cascada", async () => {
  const { db, lib } = await freshLibrary();
  const { item } = await lib.add({ work: book(), review: { text: "x" } });
  await lib.addHighlight(item.workId, { text: "La guerra es la paz.", location: "p. 8" });
  await lib.add({ work: { type: "book", title: "Un mundo feliz", creators: ["Aldous Huxley"], genres: ["distopia"] } });
  assert.equal((await lib.list({ q: "orwell" })).length, 1);
  assert.equal((await lib.list({ q: "distopia" })).length, 2);
  assert.equal((await lib.list({ type: "movie" })).length, 0);
  assert.equal((await lib.detail(item.id)).related[0].title, "Un mundo feliz");
  await lib.remove(item.id);
  assert.equal((await lib.list()).length, 1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM highlights").get()).n, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM reviews").get()).n, 0);
});

test("metas anuales", async () => {
  const { lib } = await freshLibrary();
  assert.deepEqual(await lib.setGoal(2026, "book", 12), [{ type: "book", target: 12 }]);
  assert.deepEqual(await lib.setGoal(2026, "book", 6), [{ type: "book", target: 6 }]);
  assert.deepEqual(await lib.setGoal(2026, "book", 0), []);
});

test("duplicados por título: el original cuenta y un homónimo de otro autor no", async () => {
  const { lib } = await freshLibrary();
  const { item } = await lib.add({ work: { type: "book", title: "Un mundo feliz", creators: ["Aldous Huxley"] } });
  assert.equal((await lib.findDuplicate({ type: "book", title: "Brave New World", originalTitle: "Un mundo feliz", creators: ["Aldous Huxley"] }))?.id, item.id);
  assert.equal(await lib.findDuplicate({ type: "book", title: "Un mundo feliz", creators: ["Manuel Aguirre"] }), null, "otro autor: es otro libro");
  assert.equal((await lib.findDuplicate({ type: "book", title: "Un mundo feliz" }))?.match, "title");
});

test("validaciones: puntuación, obra faltante, reseñas y subrayados de algo que no existe, metas", async () => {
  const db = await testDb();
  const lib = createLibrary(db);
  await assert.rejects(async () => await lib.add({}), { message: "work_required" });
  await assert.rejects(async () => await lib.add({ work: { type: "book", title: "X" }, entry: { rating: 7 } }), { message: "invalid_rating" });
  await assert.rejects(async () => await lib.add({ work: { type: "book", title: "X" }, entry: { rating: 3.3 } }), { message: "invalid_rating" });
  const { item } = await lib.add({ work: { type: "book", title: "X" }, entry: { rating: "4.5" } });
  assert.equal(item.rating, 4.5);
  assert.equal((await lib.updateEntry(item.id, { rating: "" })).rating, null, "vacía = sin puntuación");
  await assert.rejects(async () => await lib.updateEntry(item.id, { rating: 0 }), { message: "invalid_rating" });
  await assert.rejects(async () => await lib.addReview(9999, { text: "hola" }), { message: "not_found" });
  await assert.rejects(async () => await lib.addHighlight(9999, { text: "hola" }), { message: "not_found" });
  await assert.rejects(async () => await lib.setGoal(2026, "comic", 3), { message: "invalid_type" });
  await assert.rejects(async () => await lib.setGoal(2026, "book", 2.5), { message: "invalid_goal" });
  assert.deepEqual(await lib.setGoal(2026, "book", 0), [], "0 borra la meta");
  const passId = (await lib.updateEntry(item.id, { status: "in_progress" })).currentPass.id;
  await assert.rejects(async () => await lib.updatePass(passId, { finishedAt: "2026-13-01" }), { message: "invalid_finishedAt" });
  await assert.rejects(async () => await lib.updatePass(passId, { startedAt: "2026-02-30" }), { message: "invalid_startedAt" });
  assert.equal((await lib.updatePass(passId, { startedAt: "2026-02-03T10:00:00Z" })).currentPass.startedAt, "2026-02-03", "se queda con el día");
  await assert.rejects(async () => await lib.updateEntry(item.id, { status: "done", statusDate: "ayer" }), { message: "invalid_date" });
  await assert.rejects(async () => await lib.reread(item.id, { date: "31/12/2026" }), { message: "invalid_date" });
});
