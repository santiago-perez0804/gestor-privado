import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./helpers/pgdb.js";
import { DatabaseSync } from "node:sqlite";
import { gastosSchema } from "../src/db/schema/gastos.js";
import { ocioSchema } from "../src/db/schema/ocio.js";
import { migrateOcioV2 } from "../src/db/migrations/ocioV2.js";
import { runMigrations } from "../src/db/migrate.js";
import { createOutings, keyTokens } from "../src/services/ocio/outings.js";

/** Base con las salidas y los gastos reales de octubre alrededor de la Oktoberfest. */
async function setup() {
  const db = await testDb({ seed: false });
  const ts = "2026-10-01T00:00:00Z";
  const outing = db.prepare("INSERT INTO outings (title, category, date, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)");
  const okt = (await outing.run("Oktoberfest", "fiesta", "2026-10-10", "confirmed", ts, ts)).lastInsertRowid;
  const aniv = (await outing.run("Aniversario Kiara", "celebracion", "2026-10-14", "confirmed", ts, ts)).lastInsertRowid;
  const halloween = (await outing.run("La Fábrica · Halloween", "musica", "2026-10-31", "tentative", ts, ts)).lastInsertRowid;
  await outing.run("Recital cancelado", "musica", "2026-10-11", "not_attended", ts, ts);
  const expense = db.prepare("INSERT INTO expenses (title, description, amount, originalAmount, date, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const e = {
    uber: (await expense.run("Uber a VGB", "oktober a la tarde", 7200, 7200, "2026-10-11", "transporte", ts, ts)).lastInsertRowid,
    birras: (await expense.run("Alfajores + Cerveza", "oktober", 27000, 27000, "2026-10-11", "ocio", ts, ts)).lastInsertRowid,
    marto: (await expense.run("Oktoberfest (Marto)", null, 16450, 16450, "2026-10-16", "ocio", ts, ts)).lastInsertRowid,
    super: (await expense.run("Supermercado", null, 15608, 15608, "2026-10-09", "comida", ts, ts)).lastInsertRowid,
    astor: (await expense.run("Astor", "Aniversario con kiara", 82000, 82000, "2026-10-14", "ocio", ts, ts)).lastInsertRowid,
    lejos: (await expense.run("Pan", null, 2616, 2616, "2026-10-20", "comida", ts, ts)).lastInsertRowid,
  };
  return { db, svc: createOutings(db), okt, aniv, halloween, e };
}

test("palabras clave de un título", () => {
  assert.deepEqual(keyTokens("Oktoberfest"), ["oktob"]);
  assert.deepEqual(keyTokens("La Fábrica · Halloween"), ["fabri", "hallo"]);
  assert.deepEqual(keyTokens("Cumple de Fede"), ["fede"]);
});

test("candidatos: primero los que mencionan la salida, después los del día ±1", async () => {
  const { svc, okt, e } = await setup();
  const list = await svc.candidates(okt);
  const ids = list.map((x) => x.id);
  // El Uber y las birras (día siguiente y dicen "oktober"), lo de Marto (6 días después, lo menciona)
  // y el súper del día anterior (solo por fecha).
  assert.deepEqual(new Set(ids), new Set([e.uber, e.birras, e.marto, e.super]));
  assert.equal(list.find((x) => x.id === e.super).reason, "fecha");
  assert.equal(list.find((x) => x.id === e.marto).reason, "texto");
  assert.equal(list.at(-1).id, e.super, "los de solo fecha van al final");
  assert.ok(!ids.includes(e.lejos));
});

test("vincular, desvincular y no duplicar el vínculo", async () => {
  const { svc, okt, e } = await setup();
  await svc.link(okt, e.uber);
  await svc.link(okt, e.uber);
  assert.deepEqual((await svc.linked(okt)).map((x) => x.id), [e.uber]);
  assert.ok(!(await svc.candidates(okt)).some((x) => x.id === e.uber), "lo ya vinculado no se vuelve a ofrecer");
  assert.deepEqual(await svc.unlink(okt, e.uber), []);
  await assert.rejects(async () => await svc.link(okt, 99999), /expense_not_found/);
});

test("al cargar un gasto sugiere la salida que corresponde", async () => {
  const { svc, okt, aniv } = await setup();
  assert.equal((await svc.suggestForExpense({ date: "2026-10-16", title: "Oktoberfest (Javo)" }))[0].id, okt, "lo menciona aunque sea días después");
  assert.equal((await svc.suggestForExpense({ date: "2026-10-14", title: "Astor" }))[0].id, aniv, "mismo día");
  assert.deepEqual(await svc.suggestForExpense({ date: "2026-10-20", title: "Pan" }), []);
  assert.ok(!(await svc.suggestForExpense({ date: "2026-10-11", title: "x" })).some((o) => o.title === "Recital cancelado"), "las que no fuiste no se sugieren");
});

test("resumen del mes: cuenta salidas, suma cada gasto una vez y lista lo pendiente", async () => {
  const { svc, okt, aniv, e } = await setup();
  await svc.link(okt, e.uber);
  await svc.link(okt, e.birras);
  await svc.link(aniv, e.astor);
  await svc.link(aniv, e.birras); // un gasto en dos salidas: se suma una vez
  const s = await svc.summary({ month: "2026-10", today: "2026-10-26" });
  assert.equal(s.yearCount, 3, "la que no fuiste no cuenta");
  assert.equal(s.monthCount, 3);
  assert.equal(s.monthSpent, 7200 + 27000 + 82000);
  assert.deepEqual(s.topCategory, { id: "fiesta", count: 1, of: 3 });
  assert.deepEqual(s.unconfirmed.map((o) => o.title), ["Oktoberfest", "Aniversario Kiara"]);
  assert.deepEqual(s.upcoming.map((o) => o.title), ["La Fábrica · Halloween"]);
  const listed = (await svc.list()).find((o) => o.id === okt);
  assert.equal(listed.spent, 34200);
  assert.equal(listed.linkedCount, 2);
});

test("borrar un gasto vinculado lo saca de la salida (no rompe Gastos)", async () => {
  const { db, svc, okt, e } = await setup();
  await svc.link(okt, e.uber);
  await db.prepare("DELETE FROM expenses WHERE id = ?").run(e.uber);
  assert.deepEqual(await svc.linked(okt), []);
});
